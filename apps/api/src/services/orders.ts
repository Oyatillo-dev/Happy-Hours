import type { OrderStatus } from '@prisma/client';
import { rules } from '../config.js';
import { prisma, type Tx } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { orderNumber, pickupCode, qrToken } from '../lib/codes.js';
import { hours, localTime, minutes } from '../lib/time.js';
import { paymentProvider, type PaymentEvent } from '../providers/payments.js';
import { notify, partnerRecipients } from './notifications.js';

const ACTIVE_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'READY'];

const orderInclude = {
  offer: { include: { template: true, location: { include: { partner: true } } } },
} as const;

/** Returns boxes to the offer's stock. */
function release(tx: Tx, offerId: string, quantity: number) {
  return tx.$executeRaw`UPDATE "BoxOffer" SET "sold" = GREATEST("sold" - ${quantity}, 0) WHERE "id" = ${offerId}`;
}

/** Moves an order from one of `from` statuses to `to`; returns false if someone else moved it first. */
async function transition(
  tx: Tx,
  orderId: string,
  from: OrderStatus[],
  to: OrderStatus,
  data: Record<string, unknown> = {},
) {
  const res = await tx.order.updateMany({
    where: { id: orderId, status: { in: from } },
    data: { status: to, ...data },
  });
  return res.count === 1;
}

/** FR-B04: reserve boxes for 10 minutes and start a payment. */
export async function reserveOrder(userId: string, offerId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > rules.maxBoxesPerOrder) {
    throw new AppError('invalid_quantity');
  }
  const now = new Date();
  // Unpaid reservations hold stock for 10 minutes; cap them so one account cannot block a shop.
  const pending = await prisma.order.count({
    where: { userId, status: 'PENDING_PAYMENT', reservedUntil: { gt: now } },
  });
  if (pending >= rules.maxPendingOrders) throw new AppError('too_many_pending_orders', 409);

  const order = await prisma.$transaction(async (tx) => {
    const offer = await tx.boxOffer.findUnique({
      where: { id: offerId },
      include: { template: true, location: { include: { partner: true } } },
    });
    if (!offer) throw notFound('offer');
    const partner = offer.location.partner;
    if (offer.status !== 'ACTIVE' || partner.status !== 'ACTIVE' || !offer.location.active) {
      throw new AppError('offer_unavailable', 409);
    }
    if (offer.pickupTo.getTime() - minutes(rules.issueGraceMinutes) <= now.getTime()) {
      throw new AppError('offer_closed', 409);
    }
    const taken = await tx.$executeRaw`
      UPDATE "BoxOffer" SET "sold" = "sold" + ${quantity}
      WHERE "id" = ${offerId} AND "status" = 'ACTIVE' AND "sold" + ${quantity} <= "quantity"`;
    if (taken !== 1) throw new AppError('sold_out', 409);

    const amountKgs = offer.priceKgs * quantity;
    const promo = partner.promoUntil && partner.promoUntil > now;
    const commissionKgs = promo ? 0 : Math.round((amountKgs * partner.commissionPct) / 100);

    return tx.order.create({
      data: {
        number: orderNumber(),
        userId,
        offerId,
        quantity,
        amountKgs,
        commissionKgs,
        pickupCode: pickupCode(),
        qrToken: qrToken(),
        reservedUntil: new Date(now.getTime() + minutes(rules.reservationHoldMinutes)),
      },
      include: orderInclude,
    });
  });

  try {
    const payment = await startPayment(order.id);
    return { order, payUrl: payment.payUrl };
  } catch (err) {
    await prisma.$transaction(async (tx) => {
      if (await transition(tx, order.id, ['PENDING_PAYMENT'], 'EXPIRED')) {
        await release(tx, order.offerId, order.quantity);
      }
    });
    throw err;
  }
}

/** Creates a payment at the provider, or reuses a pending one. */
export async function startPayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { where: { status: 'PENDING' } }, offer: { include: { template: true } } },
  });
  if (!order) throw notFound('order');
  if (order.status !== 'PENDING_PAYMENT') throw new AppError('order_not_payable', 409);
  if (order.reservedUntil < new Date()) throw new AppError('reservation_expired', 409);
  const pending = order.payments.find((p) => p.payUrl);
  if (pending) return pending;

  const payment = await prisma.payment.create({
    data: {
      orderId,
      provider: paymentProvider.name,
      providerRef: `pending_${orderId}_${Date.now()}`,
      amountKgs: order.amountKgs,
    },
  });
  const created = await paymentProvider.createPayment({
    paymentId: payment.id,
    orderNumber: order.number,
    amountKgs: order.amountKgs,
    description: `${order.number}: ${order.offer.template.title}`,
  });
  return prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef: created.providerRef, payUrl: created.payUrl },
  });
}

/** FR-R06: provider webhooks are idempotent — a repeated event changes nothing. */
export async function handlePaymentEvent(event: PaymentEvent) {
  const payment = await prisma.payment.findUnique({ where: { providerRef: event.providerRef } });
  if (!payment) throw notFound('payment');
  if (payment.status !== 'PENDING') return { duplicate: true };

  if (event.status === 'FAILED') {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    return { duplicate: false };
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'SUCCEEDED' },
    });
    if (res.count === 0) return 'duplicate' as const;
    const paid = await transition(tx, payment.orderId, ['PENDING_PAYMENT'], 'PAID', {
      paidAt: new Date(),
    });
    return paid ? ('paid' as const) : ('late' as const);
  });

  if (outcome === 'duplicate') return { duplicate: true };
  if (outcome === 'late') {
    // The reservation expired or was cancelled before money arrived: give it back.
    await refundPayment(payment.id, payment.amountKgs);
    return { duplicate: false, refunded: true };
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: payment.orderId },
    include: orderInclude,
  });
  const vars = {
    title: order.offer.template.title,
    place: order.offer.location.partner.brandName,
    number: order.number,
    from: localTime(order.offer.pickupFrom),
    to: localTime(order.offer.pickupTo),
  };
  await notify([order.userId], 'order_paid', vars, { orderId: order.id });
  await notify(
    await partnerRecipients(order.offer.location.partnerId, order.offer.locationId),
    'partner_new_order',
    vars,
    { orderId: order.id },
  );
  return { duplicate: false };
}

async function refundPayment(paymentId: string, amountKgs: number) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const refundable = payment.amountKgs - payment.refundedKgs;
  const amount = Math.min(amountKgs, refundable);
  if (amount <= 0) return 0;
  await paymentProvider.refund({ providerRef: payment.providerRef, amountKgs: amount });
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      refundedKgs: { increment: amount },
      status: amount === refundable ? 'REFUNDED' : payment.status,
    },
  });
  await prisma.order.update({
    where: { id: payment.orderId },
    data: { refundedKgs: { increment: amount } },
  });
  return amount;
}

/** FR-R04: refunds the money actually captured for an order. */
export async function refundOrder(orderId: string, amountKgs?: number) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: { where: { status: 'SUCCEEDED' } } },
  });
  let left = amountKgs ?? order.amountKgs - order.refundedKgs;
  let total = 0;
  for (const payment of order.payments) {
    if (left <= 0) break;
    const done = await refundPayment(payment.id, left);
    left -= done;
    total += done;
  }
  if (total > 0) {
    await notify([order.userId], 'refund_issued', { number: order.number, amount: total }, { orderId });
  }
  return total;
}

/** FR-B07: buyer cancels; paid orders only up to 2 hours before the window. */
export async function cancelByBuyer(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { offer: true } });
  if (!order || order.userId !== userId) throw notFound('order');

  if (order.status === 'PENDING_PAYMENT') {
    await prisma.$transaction(async (tx) => {
      if (!(await transition(tx, orderId, ['PENDING_PAYMENT'], 'CANCELLED_BY_BUYER', { cancelledAt: new Date() }))) {
        throw new AppError('order_not_cancellable', 409);
      }
      await release(tx, order.offerId, order.quantity);
    });
    return;
  }
  if (order.status !== 'PAID') throw new AppError('order_not_cancellable', 409);
  const deadline = order.offer.pickupFrom.getTime() - hours(rules.buyerCancelHoursBefore);
  if (Date.now() > deadline) throw new AppError('cancel_deadline_passed', 409);

  await prisma.$transaction(async (tx) => {
    if (!(await transition(tx, orderId, ['PAID'], 'CANCELLED_BY_BUYER', { cancelledAt: new Date() }))) {
      throw new AppError('order_not_cancellable', 409);
    }
    await release(tx, order.offerId, order.quantity);
  });
  await refundOrder(orderId);
}

/** FR-P06: cancelling an offer cancels and refunds every active order on it. */
export async function cancelOrdersOfOffer(offerId: string, reason: string) {
  const orders = await prisma.order.findMany({
    where: { offerId, status: { in: ACTIVE_STATUSES } },
    include: orderInclude,
  });
  for (const order of orders) {
    const moved = await prisma.$transaction(async (tx) => {
      const ok = await transition(tx, order.id, ACTIVE_STATUSES, 'CANCELLED_BY_PARTNER', {
        cancelledAt: new Date(),
        cancelReason: reason,
      });
      if (ok) await release(tx, order.offerId, order.quantity);
      return ok;
    });
    if (!moved) continue;
    if (order.status !== 'PENDING_PAYMENT') await refundOrder(order.id);
    await notify(
      [order.userId],
      'order_cancelled_by_partner',
      { place: order.offer.location.partner.brandName, number: order.number },
      { orderId: order.id },
    );
  }
  return orders.length;
}

/** FR-P07: staff issues an order by QR token or 6-digit code. */
export async function issueOrder(
  staff: { id: string; partnerId: string; locationId: string | null },
  input: { qrToken?: string; code?: string },
) {
  const now = new Date();
  const scope = {
    offer: {
      location: { partnerId: staff.partnerId, ...(staff.locationId ? { id: staff.locationId } : {}) },
    },
  };
  let order;
  if (input.qrToken) {
    order = await prisma.order.findFirst({ where: { qrToken: input.qrToken, ...scope }, include: orderInclude });
  } else if (input.code) {
    order = await prisma.order.findFirst({
      where: {
        pickupCode: input.code,
        status: { in: ['PAID', 'READY', 'ISSUED'] },
        offer: { ...scope.offer, pickupTo: { gte: new Date(now.getTime() - hours(12)) } },
      },
      // an active order wins over an already issued one with the same code
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: orderInclude,
    });
  } else {
    throw new AppError('code_required');
  }
  if (!order) throw notFound('order');
  if (order.status === 'ISSUED') throw new AppError('already_issued', 409, undefined, { issuedAt: order.issuedAt });
  if (order.status !== 'PAID' && order.status !== 'READY') throw new AppError('order_not_issuable', 409);

  const grace = minutes(rules.issueGraceMinutes);
  if (now.getTime() < order.offer.pickupFrom.getTime() - grace) throw new AppError('too_early', 409);
  if (now.getTime() > order.offer.pickupTo.getTime() + grace) throw new AppError('window_closed', 409);

  const ok = await prisma.$transaction((tx) =>
    transition(tx, order.id, ['PAID', 'READY'], 'ISSUED', { issuedAt: now, issuedById: staff.id }),
  );
  if (!ok) throw new AppError('order_not_issuable', 409);
  return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { ...orderInclude, user: true } });
}

// ---------- background transitions (run every minute) ----------

export async function expireReservations(now = new Date()) {
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', reservedUntil: { lt: now } },
    select: { id: true, offerId: true, quantity: true },
  });
  for (const order of stale) {
    await prisma.$transaction(async (tx) => {
      if (await transition(tx, order.id, ['PENDING_PAYMENT'], 'EXPIRED')) {
        await release(tx, order.offerId, order.quantity);
      }
    });
  }
  return stale.length;
}

export async function markReady(now = new Date()) {
  const res = await prisma.order.updateMany({
    where: { status: 'PAID', offer: { pickupFrom: { lte: now } } },
    data: { status: 'READY' },
  });
  return res.count;
}

export async function sendPickupReminders(now = new Date()) {
  const soon = new Date(now.getTime() + minutes(rules.reminderMinutesBefore));
  const orders = await prisma.order.findMany({
    where: {
      status: 'PAID',
      reminderSentAt: null,
      offer: { pickupFrom: { gt: now, lte: soon } },
    },
    include: orderInclude,
  });
  for (const order of orders) {
    const res = await prisma.order.updateMany({
      where: { id: order.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (res.count) {
      await notify([order.userId], 'pickup_reminder', { place: order.offer.location.partner.brandName }, {
        orderId: order.id,
      });
    }
  }
  return orders.length;
}

/** FR-R03: boxes not collected by the end of the window are not refunded. */
export async function markNoShows(now = new Date()) {
  const cutoff = new Date(now.getTime() - minutes(rules.issueGraceMinutes));
  const orders = await prisma.order.findMany({
    where: { status: { in: ['PAID', 'READY'] }, offer: { pickupTo: { lt: cutoff } } },
    include: orderInclude,
  });
  const byLocation = new Map<string, { partnerId: string; place: string; count: number }>();
  for (const order of orders) {
    const ok = await prisma.$transaction((tx) => transition(tx, order.id, ['PAID', 'READY'], 'NO_SHOW'));
    if (!ok) continue;
    const loc = order.offer.location;
    const entry = byLocation.get(loc.id) ?? { partnerId: loc.partnerId, place: loc.name, count: 0 };
    entry.count += 1;
    byLocation.set(loc.id, entry);
  }
  for (const [locationId, entry] of byLocation) {
    await notify(await partnerRecipients(entry.partnerId, locationId), 'partner_unpicked', {
      place: entry.place,
      count: entry.count,
    });
  }
  return orders.length;
}
