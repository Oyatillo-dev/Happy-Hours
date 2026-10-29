import type { Partner, User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rules } from '../config.js';
import { prisma } from '../db.js';
import { currentUser, requireAuth } from '../lib/auth.js';
import { parse } from '../lib/validate.js';

export function userDto(user: User & { partner?: Partner | null }) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    language: user.language,
    role: user.role,
    partnerId: user.partnerId,
    locationId: user.locationId,
    partner: user.partner
      ? { id: user.partner.id, brandName: user.partner.brandName, status: user.partner.status }
      : null,
  };
}

export async function meRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth());

  app.get('/me', async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: currentUser(request).id },
      include: { partner: true },
    });
    return userDto(user);
  });

  app.patch('/me', async (request) => {
    const body = parse(
      z.object({ name: z.string().trim().min(1).max(80).optional(), language: z.enum(['ru', 'ky']).optional() }),
      request.body,
    );
    const user = await prisma.user.update({
      where: { id: currentUser(request).id },
      data: body,
      include: { partner: true },
    });
    return userDto(user);
  });

  // NFR-06: account deletion from the app. Orders stay for accounting, personal data is removed.
  app.delete('/me', async (request) => {
    const { id } = currentUser(request);
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), phone: `deleted:${id}`, name: null },
      }),
      prisma.refreshToken.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } }),
      prisma.pushToken.deleteMany({ where: { userId: id } }),
      prisma.favorite.deleteMany({ where: { userId: id } }),
    ]);
    return { ok: true };
  });

  app.post('/me/push-tokens', async (request) => {
    const body = parse(
      z.object({ token: z.string().min(10), platform: z.enum(['ios', 'android', 'web']) }),
      request.body,
    );
    const userId = currentUser(request).id;
    await prisma.pushToken.upsert({
      where: { token: body.token },
      create: { ...body, userId },
      update: { userId, platform: body.platform },
    });
    return { ok: true };
  });

  app.get('/me/notifications', async (request) => {
    const userId = currentUser(request).id;
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  });

  app.post('/me/notifications/read', async (request) => {
    const { ids } = parse(z.object({ ids: z.array(z.string()).optional() }), request.body ?? {});
    await prisma.notification.updateMany({
      where: { userId: currentUser(request).id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });

  // FR-B11: personal impact counter
  app.get('/me/impact', async (request) => {
    const orders = await prisma.order.findMany({
      where: { userId: currentUser(request).id, status: 'ISSUED' },
      select: { quantity: true, amountKgs: true, offer: { select: { valueKgs: true, template: { select: { weightKg: true } } } } },
    });
    const boxes = orders.reduce((s, o) => s + o.quantity, 0);
    const foodKg = orders.reduce((s, o) => s + o.quantity * o.offer.template.weightKg, 0);
    const savedKgs = orders.reduce((s, o) => s + o.offer.valueKgs * o.quantity - o.amountKgs, 0);
    return {
      boxes,
      foodKg: Math.round(foodKg * 10) / 10,
      savedKgs,
      co2Kg: Math.round(boxes * rules.co2PerBoxKg * 10) / 10,
    };
  });
}
