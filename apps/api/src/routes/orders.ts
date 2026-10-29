import type { OrderStatus } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rules } from '../config.js';
import { prisma } from '../db.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { AppError, notFound } from '../lib/errors.js';
import { buyerOrderDto, offerInclude } from '../lib/serialize.js';
import { hours } from '../lib/time.js';
import { idParam, parse } from '../lib/validate.js';
import { cancelByBuyer, reserveOrder, startPayment } from '../services/orders.js';
import { refreshPartnerRating } from '../services/ratings.js';

const include = { offer: { include: offerInclude }, review: true } as const;

async function loadOwnOrder(userId: string, id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { ...include, payments: { where: { status: 'PENDING' } } },
  });
  if (!order || order.userId !== userId) throw notFound('order');
  return order;
}

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth());

  app.post('/orders', async (request, reply) => {
    const body = parse(
      z.object({ offerId: z.string(), quantity: z.number().int().min(1).max(rules.maxBoxesPerOrder).default(1) }),
      request.body,
    );
    const { order, payUrl } = await reserveOrder(currentUser(request).id, body.offerId, body.quantity);
    const full = await loadOwnOrder(order.userId, order.id);
    return reply.status(201).send(buyerOrderDto(full, payUrl));
  });

  app.get('/orders', async (request) => {
    const { scope } = parse(z.object({ scope: z.enum(['active', 'history', 'all']).default('all') }), request.query);
    const active: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'READY'];
    const orders = await prisma.order.findMany({
      where: {
        userId: currentUser(request).id,
        status: scope === 'active' ? { in: active } : scope === 'history' ? { notIn: active } : undefined,
      },
      include: { ...include, payments: { where: { status: 'PENDING' } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: orders.map((o) => buyerOrderDto(o, o.payments[0]?.payUrl)) };
  });

  app.get('/orders/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const order = await loadOwnOrder(currentUser(request).id, id);
    return buyerOrderDto(order, order.payments[0]?.payUrl);
  });

  app.post('/orders/:id/pay', async (request) => {
    const { id } = parse(idParam, request.params);
    await loadOwnOrder(currentUser(request).id, id);
    const payment = await startPayment(id);
    return { payUrl: payment.payUrl };
  });

  app.post('/orders/:id/cancel', async (request) => {
    const { id } = parse(idParam, request.params);
    const userId = currentUser(request).id;
    await cancelByBuyer(userId, id);
    return buyerOrderDto(await loadOwnOrder(userId, id));
  });

  // FR-B10: rating after pickup
  app.post('/orders/:id/review', async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(
      z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().max(1000).default('') }),
      request.body,
    );
    const userId = currentUser(request).id;
    const order = await loadOwnOrder(userId, id);
    if (order.status !== 'ISSUED') throw new AppError('order_not_issued', 409);
    if (order.review?.rating) throw new AppError('already_reviewed', 409);
    const partnerId = order.offer.location.partnerId;
    await prisma.review.upsert({
      where: { orderId: id },
      create: { orderId: id, userId, partnerId, rating: body.rating, text: body.text },
      update: { rating: body.rating, text: body.text || undefined },
    });
    await refreshPartnerRating(partnerId);
    return buyerOrderDto(await loadOwnOrder(userId, id));
  });

  // FR-B10: complaint with photo within 24 hours
  app.post('/orders/:id/complaint', async (request) => {
    const { id } = parse(idParam, request.params);
    const body = parse(
      z.object({ text: z.string().trim().min(5).max(2000), photoUrl: z.string().url().optional() }),
      request.body,
    );
    const userId = currentUser(request).id;
    const order = await loadOwnOrder(userId, id);
    if (order.status !== 'ISSUED' && order.status !== 'NO_SHOW') throw new AppError('order_not_issued', 409);
    if (order.review?.isComplaint) throw new AppError('already_complained', 409);
    const since = order.issuedAt ?? order.offer.pickupTo;
    if (Date.now() > since.getTime() + hours(rules.complaintWindowHours)) {
      throw new AppError('complaint_window_closed', 409);
    }
    const data = {
      isComplaint: true,
      complaintStatus: 'OPEN' as const,
      text: body.text,
      photoUrl: body.photoUrl,
    };
    await prisma.review.upsert({
      where: { orderId: id },
      create: { orderId: id, userId, partnerId: order.offer.location.partnerId, ...data },
      update: data,
    });
    return buyerOrderDto(await loadOwnOrder(userId, id));
  });

  // FR-B09: favourites
  app.get('/favorites', async (request) => {
    const favorites = await prisma.favorite.findMany({
      where: { userId: currentUser(request).id },
      include: { partner: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: favorites.map((f) => ({
        partnerId: f.partnerId,
        brandName: f.partner.brandName,
        category: f.partner.category,
        rating: f.partner.rating,
      })),
    };
  });

  app.put('/favorites/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) throw notFound('partner');
    const userId = currentUser(request).id;
    await prisma.favorite.upsert({
      where: { userId_partnerId: { userId, partnerId: id } },
      create: { userId, partnerId: id },
      update: {},
    });
    return { ok: true };
  });

  app.delete('/favorites/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    await prisma.favorite.deleteMany({ where: { userId: currentUser(request).id, partnerId: id } });
    return { ok: true };
  });
}
