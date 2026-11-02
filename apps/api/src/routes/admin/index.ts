import type { OrderStatus, PartnerStatus } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { audit } from '../../lib/audit.js';
import { currentUser, requireAdmin, requireStaffAdmin } from '../../lib/auth.js';
import { normalizePhone } from '../../lib/codes.js';
import { AppError, notFound } from '../../lib/errors.js';
import { addDays, localDate, weekStart } from '../../lib/time.js';
import { idParam, isoDate, pagination, parse } from '../../lib/validate.js';
import { notify, partnerRecipients } from '../../services/notifications.js';
import { cancelUpcomingOffers } from '../../services/offers.js';
import { REFUND_STUCK_ATTEMPTS, refundOrder } from '../../services/orders.js';
import { computePayouts, payoutsCsv } from '../../services/payouts.js';

const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'EXPIRED',
  'PAID',
  'READY',
  'ISSUED',
  'NO_SHOW',
  'CANCELLED_BY_BUYER',
  'CANCELLED_BY_PARTNER',
  'REFUNDED',
] as const satisfies readonly OrderStatus[];

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireStaffAdmin);

  // ---------- dashboard (FR-A06) ----------
  app.get('/admin/dashboard', async (request) => {
    const q = parse(z.object({ from: isoDate.optional(), to: isoDate.optional() }), request.query);
    const to = q.to ?? localDate();
    const from = q.from ?? addDays(to, -29);
    const dateRange = { gte: from, lte: to };
    const [offers, orders, partners, buyers, openComplaints, pendingRefunds, stuckRefunds] = await Promise.all([
      prisma.boxOffer.findMany({ where: { date: dateRange, status: 'ACTIVE' }, select: { date: true, quantity: true } }),
      prisma.order.findMany({
        where: { offer: { date: dateRange }, status: { in: ['PAID', 'READY', 'ISSUED', 'NO_SHOW', 'REFUNDED'] } },
        select: {
          quantity: true,
          amountKgs: true,
          commissionKgs: true,
          refundedKgs: true,
          status: true,
          userId: true,
          offer: { select: { date: true, location: { select: { partnerId: true } } } },
        },
      }),
      prisma.partner.groupBy({ by: ['status'], _count: true }),
      prisma.user.count({ where: { role: 'BUYER', deletedAt: null } }),
      prisma.review.count({ where: { isComplaint: true, complaintStatus: 'OPEN' } }),
      prisma.refund.aggregate({ where: { status: 'PENDING' }, _count: true, _sum: { amountKgs: true } }),
      prisma.refund.count({ where: { status: 'PENDING', attempts: { gte: REFUND_STUCK_ATTEMPTS } } }),
    ]);
    const daily = new Map<string, { date: string; orders: number; gmvKgs: number; listed: number; sold: number }>();
    const day = (date: string) => {
      const d = daily.get(date) ?? { date, orders: 0, gmvKgs: 0, listed: 0, sold: 0 };
      daily.set(date, d);
      return d;
    };
    for (const o of offers) day(o.date).listed += o.quantity;
    let gmv = 0;
    let revenue = 0;
    let sold = 0;
    let noShows = 0;
    const activePartners = new Set<string>();
    const buyerOrders = new Map<string, number>();
    for (const o of orders) {
      const d = day(o.offer.date);
      d.orders += 1;
      d.gmvKgs += o.amountKgs;
      d.sold += o.quantity;
      gmv += o.amountKgs;
      sold += o.quantity;
      const kept = o.amountKgs - o.refundedKgs;
      revenue += o.amountKgs ? Math.round((o.commissionKgs * kept) / o.amountKgs) : 0;
      if (o.status === 'NO_SHOW') noShows += 1;
      activePartners.add(o.offer.location.partnerId);
      buyerOrders.set(o.userId, (buyerOrders.get(o.userId) ?? 0) + 1);
    }
    const listed = offers.reduce((s, o) => s + o.quantity, 0);
    const repeatBuyers = [...buyerOrders.values()].filter((n) => n >= 2).length;
    return {
      from,
      to,
      gmvKgs: gmv,
      revenueKgs: revenue,
      orders: orders.length,
      boxesSold: sold,
      boxesListed: listed,
      sellThrough: listed ? Math.round((sold / listed) * 1000) / 10 : 0,
      noShowRate: orders.length ? Math.round((noShows / orders.length) * 1000) / 10 : 0,
      repeatRate: buyerOrders.size ? Math.round((repeatBuyers / buyerOrders.size) * 1000) / 10 : 0,
      partnersWithSales: activePartners.size,
      partnersByStatus: Object.fromEntries(partners.map((p) => [p.status, p._count])),
      buyers,
      openComplaints,
      // Refunds the bank has not confirmed yet; "stuck" ones failed several times in a row.
      pendingRefunds: {
        count: pendingRefunds._count,
        amountKgs: pendingRefunds._sum.amountKgs ?? 0,
        stuck: stuckRefunds,
      },
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  // ---------- partners (FR-A01, FR-A02) ----------
  app.get('/admin/partners', async (request) => {
    const q = parse(
      pagination.extend({
        status: z.enum(['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED']).optional(),
        q: z.string().trim().optional(),
      }),
      request.query,
    );
    const where = {
      status: q.status,
      ...(q.q
        ? { OR: [{ brandName: { contains: q.q, mode: 'insensitive' as const } }, { inn: { contains: q.q } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        include: { locations: true, users: { where: { role: 'PARTNER_OWNER' }, select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: q.limit,
        skip: q.offset,
      }),
      prisma.partner.count({ where }),
    ]);
    return { items, total };
  });

  app.get('/admin/partners/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        locations: true,
        users: { select: { id: true, name: true, phone: true, role: true, locationId: true } },
        templates: true,
        payouts: { orderBy: { periodFrom: 'desc' }, take: 12 },
      },
    });
    if (!partner) throw notFound('partner');
    return partner;
  });

  async function setStatus(
    partnerId: string,
    status: PartnerStatus,
    action: string,
    actorId: string,
    extra: Record<string, unknown> = {},
  ) {
    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw notFound('partner');
    const updated = await prisma.partner.update({ where: { id: partnerId }, data: { status, ...extra } });
    await audit(`partner.${action}`, 'Partner', partnerId, actorId, { from: partner.status, ...extra } as never);
    return updated;
  }

  app.post('/admin/partners/:id/approve', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(
      z.object({
        commissionPct: z.number().int().min(0).max(50).optional(),
        promoMonths: z.number().int().min(0).max(12).default(3),
      }),
      request.body ?? {},
    );
    const promoUntil = body.promoMonths ? new Date(Date.now() + body.promoMonths * 30 * 86_400_000) : null;
    const partner = await setStatus(id, 'ACTIVE', 'approve', currentUser(request).id, {
      rejectReason: null,
      promoUntil,
      ...(body.commissionPct !== undefined ? { commissionPct: body.commissionPct } : {}),
    });
    await notify(await partnerRecipients(id), 'partner_approved', { place: partner.brandName });
    return partner;
  });

  app.post('/admin/partners/:id/reject', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { reason } = parse(z.object({ reason: z.string().trim().min(3) }), request.body);
    const partner = await setStatus(id, 'REJECTED', 'reject', currentUser(request).id, { rejectReason: reason });
    await notify(await partnerRecipients(id), 'partner_rejected', { reason });
    return partner;
  });

  // cancelOffers=false keeps paid orders valid: the partner can still hand them out.
  app.post('/admin/partners/:id/suspend', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { reason, cancelOffers } = parse(
      z.object({ reason: z.string().trim().min(3), cancelOffers: z.boolean().default(true) }),
      request.body,
    );
    const actorId = currentUser(request).id;
    const partner = await setStatus(id, 'SUSPENDED', 'suspend', actorId, { rejectReason: reason });
    const cancelled = cancelOffers ? await cancelUpcomingOffers(id, actorId) : { offers: 0, orders: 0 };
    await notify(await partnerRecipients(id), 'partner_suspended', { reason });
    return { ...partner, cancelled };
  });

  app.post('/admin/partners/:id/reactivate', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    return setStatus(id, 'ACTIVE', 'reactivate', currentUser(request).id, { rejectReason: null });
  });

  app.patch('/admin/partners/:id/commission', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(
      z.object({ commissionPct: z.number().int().min(0).max(50), promoUntil: z.string().datetime().nullable().optional() }),
      request.body,
    );
    if (!(await prisma.partner.findUnique({ where: { id } }))) throw notFound('partner');
    const partner = await prisma.partner.update({
      where: { id },
      data: {
        commissionPct: body.commissionPct,
        ...(body.promoUntil !== undefined ? { promoUntil: body.promoUntil ? new Date(body.promoUntil) : null } : {}),
      },
    });
    await audit('partner.commission', 'Partner', id, currentUser(request).id, body);
    return partner;
  });

  // ---------- orders & refunds (FR-A03) ----------
  app.get('/admin/orders', async (request) => {
    const q = parse(
      pagination.extend({
        q: z.string().trim().optional(),
        status: z.enum(ORDER_STATUSES).optional(),
        partnerId: z.string().optional(),
        refunds: z.enum(['pending']).optional(),
      }),
      request.query,
    );
    const phone = q.q ? normalizePhone(q.q) : null;
    const where = {
      status: q.status,
      ...(q.refunds ? { refunds: { some: { status: 'PENDING' as const } } } : {}),
      ...(q.partnerId ? { offer: { location: { partnerId: q.partnerId } } } : {}),
      ...(q.q
        ? { OR: [{ number: { contains: q.q.toUpperCase() } }, ...(phone ? [{ user: { phone } }] : [])] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { name: true, phone: true } },
          offer: { include: { template: { select: { title: true } }, location: { include: { partner: { select: { brandName: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: q.limit,
        skip: q.offset,
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total };
  });

  app.get('/admin/orders/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        payments: true,
        refunds: { orderBy: { createdAt: 'asc' } },
        review: true,
        offer: { include: { template: true, location: { include: { partner: true } } } },
      },
    });
    if (!order) throw notFound('order');
    const history = await prisma.auditLog.findMany({ where: { entity: 'Order', entityId: id }, orderBy: { createdAt: 'asc' } });
    return { ...order, history };
  });

  app.post('/admin/orders/:id/refund', async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(
      z.object({ amountKgs: z.number().int().positive().optional(), reason: z.string().trim().min(3) }),
      request.body,
    );
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw notFound('order');
    if (!['ISSUED', 'NO_SHOW', 'REFUNDED'].includes(order.status)) throw new AppError('order_not_refundable', 409);
    const refunded = await refundOrder(id, body.amountKgs);
    if (refunded === 0) throw new AppError('nothing_to_refund', 409);
    await prisma.order.update({ where: { id }, data: { status: 'REFUNDED' } });
    await audit('order.refund', 'Order', id, currentUser(request).id, { amountKgs: refunded, reason: body.reason });
    return { refundedKgs: refunded };
  });

  // ---------- complaints (FR-A04) ----------
  app.get('/admin/complaints', async (request) => {
    const q = parse(z.object({ status: z.enum(['OPEN', 'APPROVED', 'REJECTED']).default('OPEN') }), request.query);
    const items = await prisma.review.findMany({
      where: { isComplaint: true, complaintStatus: q.status },
      include: {
        user: { select: { name: true, phone: true } },
        partner: { select: { id: true, brandName: true } },
        order: { select: { id: true, number: true, amountKgs: true, refundedKgs: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { items };
  });

  app.post('/admin/complaints/:id/resolve', async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(
      z.object({
        decision: z.enum(['APPROVED', 'REJECTED']),
        resolution: z.string().trim().min(3),
        refundKgs: z.number().int().positive().optional(),
      }),
      request.body,
    );
    const review = await prisma.review.findUnique({ where: { id }, include: { order: true } });
    if (!review?.isComplaint) throw notFound('complaint');
    if (review.complaintStatus !== 'OPEN') throw new AppError('complaint_already_resolved', 409);
    let refunded = 0;
    if (body.decision === 'APPROVED') {
      refunded = await refundOrder(review.orderId, body.refundKgs);
      if (refunded > 0) await prisma.order.update({ where: { id: review.orderId }, data: { status: 'REFUNDED' } });
    }
    await prisma.review.update({
      where: { id },
      data: { complaintStatus: body.decision, resolution: body.resolution },
    });
    await audit('complaint.resolve', 'Order', review.orderId, currentUser(request).id, {
      decision: body.decision,
      resolution: body.resolution,
      refundedKgs: refunded,
    });
    return { ok: true, refundedKgs: refunded };
  });

  // ---------- payouts (FR-A05) ----------
  app.get('/admin/payouts', async (request) => {
    const q = parse(z.object({ periodFrom: isoDate.optional() }), request.query);
    const periodFrom = q.periodFrom ?? addDays(weekStart(localDate()), -7);
    const items = await prisma.payout.findMany({
      where: { periodFrom },
      include: { partner: { select: { brandName: true, bankName: true, bankAccount: true } } },
      orderBy: { netKgs: 'desc' },
    });
    return { periodFrom, items };
  });

  app.post('/admin/payouts/compute', { preHandler: requireAdmin }, async (request) => {
    const { periodFrom } = parse(z.object({ periodFrom: isoDate }), request.body);
    if (weekStart(periodFrom) !== periodFrom) throw new AppError('period_must_start_monday');
    const items = await computePayouts(periodFrom);
    await audit('payouts.compute', 'Payout', periodFrom, currentUser(request).id, { count: items.length });
    return { items };
  });

  app.get('/admin/payouts/export', async (request, reply) => {
    const { periodFrom } = parse(z.object({ periodFrom: isoDate }), request.query);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="payouts-${periodFrom}.csv"`)
      .send('﻿' + (await payoutsCsv(periodFrom)));
  });

  app.post('/admin/payouts/:id/mark-paid', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const existing = await prisma.payout.findUnique({ where: { id } });
    if (!existing) throw notFound('payout');
    if (existing.status === 'PAID') throw new AppError('payout_already_paid', 409);
    const payout = await prisma.payout.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
    await audit('payout.paid', 'Payout', id, currentUser(request).id, { netKgs: payout.netKgs });
    return payout;
  });

  // ---------- users & audit (FR-A08) ----------
  app.get('/admin/users', async (request) => {
    const q = parse(pagination.extend({ q: z.string().trim().optional() }), request.query);
    const phone = q.q ? normalizePhone(q.q) : null;
    const where = q.q
      ? { OR: [...(phone ? [{ phone }] : []), { name: { contains: q.q, mode: 'insensitive' as const } }] }
      : {};
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, phone: true, name: true, role: true, partnerId: true, createdAt: true, deletedAt: true },
        orderBy: { createdAt: 'desc' },
        take: q.limit,
        skip: q.offset,
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  });

  app.patch('/admin/users/:id/role', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { role } = parse(z.object({ role: z.enum(['BUYER', 'SUPPORT', 'ADMIN']) }), request.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('user');
    if (user.partnerId) throw new AppError('user_is_partner', 409);
    const updated = await prisma.user.update({ where: { id }, data: { role } });
    await audit('user.role', 'User', id, currentUser(request).id, { from: user.role, to: role });
    return { id: updated.id, role: updated.role };
  });

  app.get('/admin/audit', async (request) => {
    const q = parse(pagination.extend({ entity: z.string().optional(), entityId: z.string().optional() }), request.query);
    const items = await prisma.auditLog.findMany({
      where: { entity: q.entity, entityId: q.entityId },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      skip: q.offset,
    });
    return { items };
  });
}
