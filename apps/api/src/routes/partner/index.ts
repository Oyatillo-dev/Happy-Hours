import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { currentUser, partnerIdOf, requireAuth, requireOwner, requirePartner } from '../../lib/auth.js';
import { normalizePhone } from '../../lib/codes.js';
import { AppError, notFound } from '../../lib/errors.js';
import { localDate, localDateTime } from '../../lib/time.js';
import { hhmm, idParam, isoDate, parse } from '../../lib/validate.js';
import { cancelOffer, publishOffer, updateOfferQuantity, validatePrices, validateWindow } from '../../services/offers.js';
import { issueOrder } from '../../services/orders.js';

const locationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().min(3).max(200),
  lat: z.number().min(42).max(43.2), // Bishkek and surroundings
  lng: z.number().min(74).max(75.2),
  openTime: hhmm,
  closeTime: hhmm,
});

const templateSchema = z.object({
  title: z.string().trim().min(2).max(80),
  category: z.enum(['BAKERY', 'MEALS', 'GROCERY', 'DESSERTS', 'MIXED']),
  description: z.string().trim().max(500).default(''),
  allergens: z.string().trim().max(200).default(''),
  priceKgs: z.number().int().positive(),
  valueKgs: z.number().int().positive(),
  weightKg: z.number().positive().max(20).default(1),
  photoUrl: z.string().url().nullable().optional(),
});

const scheduleSchema = z.object({
  templateId: z.string(),
  locationId: z.string(),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  quantity: z.number().int().min(1).max(500),
  pickupFromTime: hhmm,
  pickupToTime: hhmm,
  active: z.boolean().default(true),
});

/** Staff bound to a location only see that location. */
function locationScope(request: FastifyRequest) {
  const user = currentUser(request);
  return user.role === 'PARTNER_STAFF' && user.locationId ? { id: user.locationId } : {};
}

export async function partnerRoutes(app: FastifyInstance) {
  // ---------- onboarding (FR-P01) ----------
  app.post('/partner/apply', { preHandler: requireAuth('BUYER') }, async (request, reply) => {
    const body = parse(
      z.object({
        brandName: z.string().trim().min(2).max(80),
        legalName: z.string().trim().min(2).max(200),
        inn: z.string().regex(/^\d{14}$/, 'ИНН — 14 цифр'),
        category: z.enum(['BAKERY', 'CAFE', 'RESTAURANT', 'GROCERY', 'OTHER']),
        contactPhone: z.string(),
        bankName: z.string().trim().min(2).max(100),
        bankAccount: z.string().trim().min(10).max(34),
        location: locationSchema,
      }),
      request.body,
    );
    const contactPhone = normalizePhone(body.contactPhone);
    if (!contactPhone) throw new AppError('invalid_phone');
    const user = currentUser(request);
    if (user.partnerId) throw new AppError('already_partner', 409);
    const partner = await prisma.$transaction(async (tx) => {
      const created = await tx.partner.create({
        data: {
          brandName: body.brandName,
          legalName: body.legalName,
          inn: body.inn,
          category: body.category,
          contactPhone,
          bankName: body.bankName,
          bankAccount: body.bankAccount,
          locations: { create: body.location },
        },
        include: { locations: true },
      });
      await tx.user.update({ where: { id: user.id }, data: { role: 'PARTNER_OWNER', partnerId: created.id } });
      return created;
    });
    return reply.status(201).send(partner);
  });

  app.get('/partner', { preHandler: requirePartner }, async (request) => {
    return prisma.partner.findUniqueOrThrow({
      where: { id: partnerIdOf(request) },
      include: { locations: { orderBy: { createdAt: 'asc' } } },
    });
  });

  app.patch('/partner', { preHandler: requireOwner }, async (request) => {
    const body = parse(
      z.object({
        brandName: z.string().trim().min(2).max(80).optional(),
        contactPhone: z.string().optional(),
        bankName: z.string().trim().min(2).max(100).optional(),
        bankAccount: z.string().trim().min(10).max(34).optional(),
      }),
      request.body,
    );
    const contactPhone = body.contactPhone ? normalizePhone(body.contactPhone) : undefined;
    if (contactPhone === null) throw new AppError('invalid_phone');
    return prisma.partner.update({
      where: { id: partnerIdOf(request) },
      data: { ...body, contactPhone },
    });
  });

  // ---------- locations (FR-P02) ----------
  app.get('/partner/locations', { preHandler: requirePartner }, async (request) => {
    return { items: await prisma.location.findMany({ where: { partnerId: partnerIdOf(request) }, orderBy: { createdAt: 'asc' } }) };
  });

  app.post('/partner/locations', { preHandler: requireOwner }, async (request, reply) => {
    const body = parse(locationSchema, request.body);
    const loc = await prisma.location.create({ data: { ...body, partnerId: partnerIdOf(request) } });
    return reply.status(201).send(loc);
  });

  app.patch('/partner/locations/:id', { preHandler: requireOwner }, async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(locationSchema.partial().extend({ active: z.boolean().optional() }), request.body);
    const res = await prisma.location.updateMany({ where: { id, partnerId: partnerIdOf(request) }, data: body });
    if (!res.count) throw notFound('location');
    return prisma.location.findUniqueOrThrow({ where: { id } });
  });

  // ---------- staff (FR-P02) ----------
  app.get('/partner/staff', { preHandler: requireOwner }, async (request) => {
    const items = await prisma.user.findMany({
      where: { partnerId: partnerIdOf(request), deletedAt: null },
      select: { id: true, phone: true, name: true, role: true, locationId: true },
      orderBy: { createdAt: 'asc' },
    });
    return { items };
  });

  app.post('/partner/staff', { preHandler: requireOwner }, async (request, reply) => {
    const body = parse(
      z.object({ phone: z.string(), name: z.string().trim().min(1).max(80), locationId: z.string().nullable().optional() }),
      request.body,
    );
    const phone = normalizePhone(body.phone);
    if (!phone) throw new AppError('invalid_phone');
    const partnerId = partnerIdOf(request);
    if (body.locationId) {
      const loc = await prisma.location.findFirst({ where: { id: body.locationId, partnerId } });
      if (!loc) throw notFound('location');
    }
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && (existing.partnerId || existing.role !== 'BUYER')) throw new AppError('user_already_assigned', 409);
    const data = { role: 'PARTNER_STAFF' as const, partnerId, locationId: body.locationId ?? null };
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { ...data, name: existing.name ?? body.name } })
      : await prisma.user.create({ data: { ...data, phone, name: body.name } });
    return reply.status(201).send({ id: user.id, phone: user.phone, name: user.name, role: user.role, locationId: user.locationId });
  });

  app.delete('/partner/staff/:id', { preHandler: requireOwner }, async (request) => {
    const { id } = parse(idParam, request.params);
    const res = await prisma.user.updateMany({
      where: { id, partnerId: partnerIdOf(request), role: 'PARTNER_STAFF' },
      data: { role: 'BUYER', partnerId: null, locationId: null },
    });
    if (!res.count) throw notFound('staff');
    return { ok: true };
  });

  // ---------- box templates (FR-P03) ----------
  app.get('/partner/templates', { preHandler: requirePartner }, async (request) => {
    return {
      items: await prisma.boxTemplate.findMany({
        where: { partnerId: partnerIdOf(request) },
        orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
      }),
    };
  });

  app.post('/partner/templates', { preHandler: requireOwner }, async (request, reply) => {
    const body = parse(templateSchema, request.body);
    validatePrices(body.priceKgs, body.valueKgs);
    const t = await prisma.boxTemplate.create({ data: { ...body, partnerId: partnerIdOf(request) } });
    return reply.status(201).send(t);
  });

  app.patch('/partner/templates/:id', { preHandler: requireOwner }, async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(templateSchema.partial().extend({ active: z.boolean().optional() }), request.body);
    const partnerId = partnerIdOf(request);
    const current = await prisma.boxTemplate.findFirst({ where: { id, partnerId } });
    if (!current) throw notFound('template');
    validatePrices(body.priceKgs ?? current.priceKgs, body.valueKgs ?? current.valueKgs);
    return prisma.boxTemplate.update({ where: { id }, data: body });
  });

  // ---------- recurring schedules (FR-P04) ----------
  app.get('/partner/schedules', { preHandler: requirePartner }, async (request) => {
    return {
      items: await prisma.schedule.findMany({
        where: { template: { partnerId: partnerIdOf(request) } },
        include: { template: { select: { title: true } }, location: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    };
  });

  app.post('/partner/schedules', { preHandler: requireOwner }, async (request, reply) => {
    const body = parse(scheduleSchema, request.body);
    const partnerId = partnerIdOf(request);
    const location = await prisma.location.findFirst({ where: { id: body.locationId, partnerId } });
    const template = await prisma.boxTemplate.findFirst({ where: { id: body.templateId, partnerId } });
    if (!location) throw notFound('location');
    if (!template) throw notFound('template');
    validateWindow(location, body.pickupFromTime, body.pickupToTime);
    const s = await prisma.schedule.create({ data: { ...body, weekdays: [...new Set(body.weekdays)].sort() } });
    return reply.status(201).send(s);
  });

  app.patch('/partner/schedules/:id', { preHandler: requireOwner }, async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(scheduleSchema.omit({ templateId: true, locationId: true }).partial(), request.body);
    const current = await prisma.schedule.findFirst({
      where: { id, template: { partnerId: partnerIdOf(request) } },
      include: { location: true },
    });
    if (!current) throw notFound('schedule');
    validateWindow(current.location, body.pickupFromTime ?? current.pickupFromTime, body.pickupToTime ?? current.pickupToTime);
    return prisma.schedule.update({ where: { id }, data: body });
  });

  app.delete('/partner/schedules/:id', { preHandler: requireOwner }, async (request) => {
    const { id } = parse(idParam, request.params);
    const res = await prisma.schedule.updateMany({
      where: { id, template: { partnerId: partnerIdOf(request) } },
      data: { active: false },
    });
    if (!res.count) throw notFound('schedule');
    return { ok: true };
  });

  // ---------- daily offers (FR-P04…P06) ----------
  app.get('/partner/offers', { preHandler: requirePartner }, async (request) => {
    const { date } = parse(z.object({ date: isoDate.optional() }), request.query);
    const items = await prisma.boxOffer.findMany({
      where: { date: date ?? localDate(), location: { partnerId: partnerIdOf(request), ...locationScope(request) } },
      include: {
        template: true,
        location: { select: { id: true, name: true } },
        _count: { select: { orders: { where: { status: { in: ['PAID', 'READY', 'ISSUED', 'NO_SHOW'] } } } } },
      },
      orderBy: { pickupFrom: 'asc' },
    });
    return { items };
  });

  app.post('/partner/offers', { preHandler: requirePartner }, async (request, reply) => {
    const body = parse(
      z.object({
        templateId: z.string(),
        locationId: z.string(),
        date: isoDate.optional(),
        quantity: z.number().int().min(1).max(500),
        pickupFromTime: hhmm,
        pickupToTime: hhmm,
      }),
      request.body,
    );
    const scope = locationScope(request);
    if ('id' in scope && scope.id !== body.locationId) throw new AppError('forbidden', 403);
    return reply.status(201).send(await publishOffer(partnerIdOf(request), body));
  });

  app.patch('/partner/offers/:id', { preHandler: requirePartner }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { quantity } = parse(z.object({ quantity: z.number().int().min(0).max(500) }), request.body);
    return updateOfferQuantity(partnerIdOf(request), id, quantity);
  });

  app.post('/partner/offers/:id/cancel', { preHandler: requirePartner }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(300) }), request.body);
    return cancelOffer(partnerIdOf(request), id, currentUser(request).id, reason);
  });

  // ---------- orders & pickup (FR-P07, FR-P08) ----------
  app.get('/partner/orders', { preHandler: requirePartner }, async (request) => {
    const { date } = parse(z.object({ date: isoDate.optional() }), request.query);
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'READY', 'ISSUED', 'NO_SHOW', 'CANCELLED_BY_PARTNER', 'CANCELLED_BY_BUYER', 'REFUNDED'] },
        offer: { date: date ?? localDate(), location: { partnerId: partnerIdOf(request), ...locationScope(request) } },
      },
      include: {
        user: { select: { name: true, phone: true } },
        offer: { include: { template: { select: { title: true } }, location: { select: { name: true } } } },
      },
      orderBy: [{ offer: { pickupFrom: 'asc' } }, { createdAt: 'asc' }],
    });
    return {
      items: orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        quantity: o.quantity,
        amountKgs: o.amountKgs,
        buyerName: o.user.name ?? '',
        buyerPhoneTail: o.user.phone.slice(-4),
        boxTitle: o.offer.template.title,
        locationName: o.offer.location.name,
        pickupFrom: o.offer.pickupFrom,
        pickupTo: o.offer.pickupTo,
        issuedAt: o.issuedAt,
        paidAt: o.paidAt,
      })),
    };
  });

  app.post('/partner/orders/issue', { preHandler: requirePartner }, async (request) => {
    const body = parse(
      z.object({ qrToken: z.string().min(8).optional(), code: z.string().regex(/^\d{6}$/).optional() }),
      request.body,
    );
    const user = currentUser(request);
    const order = await issueOrder(
      { id: user.id, partnerId: partnerIdOf(request), locationId: user.role === 'PARTNER_STAFF' ? user.locationId : null },
      body,
    );
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      quantity: order.quantity,
      boxTitle: order.offer.template.title,
      buyerName: order.user.name ?? '',
      issuedAt: order.issuedAt,
    };
  });

  // ---------- stats, payouts, reviews (FR-P09, FR-P10) ----------
  app.get('/partner/stats', { preHandler: requireOwner }, async (request) => {
    const q = parse(z.object({ from: isoDate.optional(), to: isoDate.optional() }), request.query);
    const to = q.to ?? localDate();
    const from = q.from ?? to.slice(0, 8) + '01';
    const partnerId = partnerIdOf(request);
    const [offers, orders, partner] = await Promise.all([
      prisma.boxOffer.findMany({
        where: { date: { gte: from, lte: to }, location: { partnerId } },
        select: { date: true, quantity: true, status: true },
      }),
      prisma.order.findMany({
        where: {
          status: { in: ['ISSUED', 'NO_SHOW', 'REFUNDED'] },
          offer: { date: { gte: from, lte: to }, location: { partnerId } },
        },
        select: {
          quantity: true,
          amountKgs: true,
          commissionKgs: true,
          refundedKgs: true,
          status: true,
          offer: { select: { date: true, template: { select: { weightKg: true } } } },
        },
      }),
      prisma.partner.findUniqueOrThrow({ where: { id: partnerId } }),
    ]);
    const days = new Map<string, { date: string; listed: number; sold: number; revenueKgs: number }>();
    const day = (date: string) => {
      const d = days.get(date) ?? { date, listed: 0, sold: 0, revenueKgs: 0 };
      days.set(date, d);
      return d;
    };
    for (const o of offers) if (o.status === 'ACTIVE') day(o.date).listed += o.quantity;
    let soldBoxes = 0;
    let revenue = 0;
    let commission = 0;
    let foodKg = 0;
    let noShows = 0;
    for (const o of orders) {
      const kept = o.amountKgs - o.refundedKgs;
      const d = day(o.offer.date);
      d.sold += o.quantity;
      d.revenueKgs += kept;
      soldBoxes += o.quantity;
      revenue += kept;
      commission += o.amountKgs ? Math.round((o.commissionKgs * kept) / o.amountKgs) : 0;
      foodKg += o.quantity * o.offer.template.weightKg;
      if (o.status === 'NO_SHOW') noShows += 1;
    }
    const listed = [...days.values()].reduce((s, d) => s + d.listed, 0);
    return {
      from,
      to,
      listedBoxes: listed,
      soldBoxes,
      sellThrough: listed ? Math.round((soldBoxes / listed) * 1000) / 10 : 0,
      revenueKgs: revenue,
      commissionKgs: commission,
      netKgs: revenue - commission,
      foodKg: Math.round(foodKg * 10) / 10,
      noShows,
      rating: partner.rating,
      ratingCount: partner.ratingCount,
      cancellations: partner.cancellationsCount,
      daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  app.get('/partner/payouts', { preHandler: requireOwner }, async (request) => {
    return {
      items: await prisma.payout.findMany({
        where: { partnerId: partnerIdOf(request) },
        orderBy: { periodFrom: 'desc' },
        take: 52,
      }),
    };
  });

  app.get('/partner/reviews', { preHandler: requirePartner }, async (request) => {
    const items = await prisma.review.findMany({
      where: { partnerId: partnerIdOf(request) },
      include: { order: { select: { number: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      items: items.map((r) => ({
        id: r.id,
        orderNumber: r.order.number,
        author: r.user.name ?? '',
        rating: r.rating,
        text: r.text,
        photoUrl: r.photoUrl,
        isComplaint: r.isComplaint,
        complaintStatus: r.complaintStatus,
        resolution: r.resolution,
        createdAt: r.createdAt,
      })),
    };
  });

  // Used by the web cabinet to preview a window before publishing.
  app.get('/partner/window-check', { preHandler: requirePartner }, async (request) => {
    const q = parse(z.object({ locationId: z.string(), from: hhmm, to: hhmm, date: isoDate.optional() }), request.query);
    const location = await prisma.location.findFirst({ where: { id: q.locationId, partnerId: partnerIdOf(request) } });
    if (!location) throw notFound('location');
    validateWindow(location, q.from, q.to);
    const date = q.date ?? localDate();
    return { ok: true, pickupFrom: localDateTime(date, q.from), pickupTo: localDateTime(date, q.to) };
  });
}
