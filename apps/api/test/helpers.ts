import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { signPayload } from '../src/providers/payments.js';
import { addDays, localDate, localTime } from '../src/lib/time.js';

export { prisma };

export async function createApp() {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

let phoneSeq = 100;
export const nextPhone = () => `+99655500${String(phoneSeq++).padStart(4, '0')}`;

export async function login(app: FastifyInstance, phone = nextPhone(), name = 'Тест') {
  const req = await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { phone } });
  if (req.statusCode !== 200) throw new Error(`otp request failed: ${req.body}`);
  const res = await app.inject({
    method: 'POST',
    url: '/auth/otp/verify',
    payload: { phone, code: req.json().devCode, name },
  });
  if (res.statusCode !== 200) throw new Error(`otp verify failed: ${res.body}`);
  const body = res.json();
  return { token: body.accessToken as string, refreshToken: body.refreshToken as string, user: body.user, phone };
}

export function api(app: FastifyInstance, token?: string) {
  const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE') => (url: string, payload?: object) =>
    app.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  return { get: call('GET'), post: call('POST'), patch: call('PATCH'), put: call('PUT'), del: call('DELETE') };
}

/** Approved partner with one all-day location and one box template. */
export async function setupPartner(app: FastifyInstance) {
  const admin = await login(app, '+996700000001', 'Админ');
  const owner = await login(app, nextPhone(), 'Владелец');
  const apply = await api(app, owner.token).post('/partner/apply', {
    brandName: 'Тестовая пекарня',
    legalName: 'ОсОО Тест',
    inn: '01234567890123',
    category: 'BAKERY',
    contactPhone: owner.phone,
    bankName: 'MBank',
    bankAccount: '1234567890123456',
    location: { name: 'Центр', address: 'пр. Чуй, 1', lat: 42.87, lng: 74.6, openTime: '00:00', closeTime: '23:59' },
  });
  if (apply.statusCode !== 201) throw new Error(apply.body);
  const partner = apply.json();
  const approve = await api(app, admin.token).post(`/admin/partners/${partner.id}/approve`, {
    commissionPct: 20,
    promoMonths: 0,
  });
  if (approve.statusCode !== 200) throw new Error(approve.body);
  const tpl = await api(app, owner.token).post('/partner/templates', {
    title: 'Пакет выпечки',
    category: 'BAKERY',
    priceKgs: 200,
    valueKgs: 600,
    weightKg: 1.5,
  });
  if (tpl.statusCode !== 201) throw new Error(tpl.body);
  return { admin, owner, partner, location: partner.locations[0], template: tpl.json() };
}

/**
 * Publishes an offer for tomorrow, then optionally moves it to "today" with a
 * window relative to now (in minutes), so tests do not depend on the clock.
 */
export async function createOffer(
  app: FastifyInstance,
  ctx: Awaited<ReturnType<typeof setupPartner>>,
  opts: { quantity?: number; startInMin?: number; lengthMin?: number } = {},
) {
  const res = await api(app, ctx.owner.token).post('/partner/offers', {
    templateId: ctx.template.id,
    locationId: ctx.location.id,
    date: addDays(localDate(), 1),
    quantity: opts.quantity ?? 5,
    pickupFromTime: '20:00',
    pickupToTime: '21:00',
  });
  if (res.statusCode !== 201) throw new Error(res.body);
  const offer = res.json();
  if (opts.startInMin !== undefined) {
    return shiftOffer(offer.id, opts.startInMin, opts.lengthMin ?? 60);
  }
  return offer;
}

export async function shiftOffer(offerId: string, startInMin: number, lengthMin = 60) {
  const from = new Date(Date.now() + startInMin * 60_000);
  const to = new Date(from.getTime() + lengthMin * 60_000);
  return prisma.boxOffer.update({
    where: { id: offerId },
    data: { pickupFrom: from, pickupTo: to, date: localDate() },
  });
}

export async function pay(app: FastifyInstance, orderId: string, status: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED') {
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  const raw = JSON.stringify({ providerRef: payment.providerRef, status });
  return app.inject({
    method: 'POST',
    url: '/payments/webhook/mock',
    payload: raw,
    headers: { 'content-type': 'application/json', 'x-signature': signPayload(raw) },
  });
}

export { localTime };
