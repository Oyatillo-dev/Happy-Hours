import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MockPaymentProvider, paymentProvider } from '../src/providers/payments.js';
import { tick } from '../src/jobs/scheduler.js';
import { computePayouts } from '../src/services/payouts.js';
import { expireReservations, markNoShows, markReady } from '../src/services/orders.js';
import { refreshPartnerRating } from '../src/services/ratings.js';
import { addDays, localDate, weekStart } from '../src/lib/time.js';
import { api, createApp, createOffer, login, pay, prisma, resetDb, setupPartner, shiftOffer } from './helpers.js';

const refunds = (paymentProvider as MockPaymentProvider).refunds;

let app: FastifyInstance;
beforeAll(async () => {
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  refunds.length = 0;
});

describe('auth', () => {
  it('logs in by phone, normalises numbers and makes configured phones admins', async () => {
    const buyer = await login(app, '0555 123 456');
    expect(buyer.user.phone).toBe('+996555123456');
    expect(buyer.user.role).toBe('BUYER');
    const admin = await login(app, '+996700000001');
    expect(admin.user.role).toBe('ADMIN');

    const me = await api(app, buyer.token).get('/me');
    expect(me.json().phone).toBe('+996555123456');
  });

  it('rejects a wrong code and blocks after too many attempts', async () => {
    const phone = '+996555000111';
    const { devCode } = (await api(app).post('/auth/otp/request', { phone })).json();
    const wrong = devCode === '0000' ? '1111' : '0000';
    for (let i = 0; i < 5; i++) {
      const res = await api(app).post('/auth/otp/verify', { phone, code: wrong });
      expect(res.json().error.code).toBe('code_invalid');
    }
    // even the right code no longer works after 5 failed attempts
    const blocked = await api(app).post('/auth/otp/verify', { phone, code: devCode });
    expect(blocked.json().error.code).toBe('code_expired');
  });

  it('rotates refresh tokens', async () => {
    const user = await login(app);
    const first = await api(app).post('/auth/refresh', { refreshToken: user.refreshToken });
    expect(first.statusCode).toBe(200);
    const reuse = await api(app).post('/auth/refresh', { refreshToken: user.refreshToken });
    expect(reuse.statusCode).toBe(401);
  });
});

describe('partner onboarding and box rules', () => {
  it('requires admin approval before publishing', async () => {
    const owner = await login(app);
    const apply = await api(app, owner.token).post('/partner/apply', {
      brandName: 'Кафе',
      legalName: 'ИП Кафе',
      inn: '01234567890123',
      category: 'CAFE',
      contactPhone: owner.phone,
      bankName: 'Optima',
      bankAccount: '1234567890123456',
      location: { name: 'Точка', address: 'ул. Токтогула, 1', lat: 42.87, lng: 74.6, openTime: '08:00', closeTime: '22:00' },
    });
    expect(apply.statusCode).toBe(201);
    expect(apply.json().status).toBe('PENDING');

    // the new role is picked up from the database on the next request
    const tpl = await api(app, owner.token).post('/partner/templates', {
      title: 'Бокс',
      category: 'MIXED',
      priceKgs: 200,
      valueKgs: 600,
    });
    expect(tpl.statusCode).toBe(201);
    const offer = await api(app, owner.token).post('/partner/offers', {
      templateId: tpl.json().id,
      locationId: apply.json().locations[0].id,
      date: addDays(localDate(), 1),
      quantity: 3,
      pickupFromTime: '20:00',
      pickupToTime: '21:00',
    });
    expect(offer.statusCode).toBe(403);
    expect(offer.json().error.code).toBe('partner_not_active');
  });

  it('enforces FR-R01 prices and FR-R02 pickup windows', async () => {
    const ctx = await setupPartner(app);
    const owner = api(app, ctx.owner.token);
    const cheap = await owner.post('/partner/templates', { title: 'Дёшево', category: 'MIXED', priceKgs: 50, valueKgs: 300 });
    expect(cheap.json().error.code).toBe('price_too_low');
    const noValue = await owner.post('/partner/templates', { title: 'Мало', category: 'MIXED', priceKgs: 200, valueKgs: 300 });
    expect(noValue.json().error.code).toBe('value_too_low');

    const base = { templateId: ctx.template.id, locationId: ctx.location.id, date: addDays(localDate(), 1), quantity: 2 };
    const short = await owner.post('/partner/offers', { ...base, pickupFromTime: '20:00', pickupToTime: '20:15' });
    expect(short.json().error.code).toBe('invalid_window_length');
    const long = await owner.post('/partner/offers', { ...base, pickupFromTime: '18:00', pickupToTime: '22:00' });
    expect(long.json().error.code).toBe('invalid_window_length');
  });
});

describe('buyer order flow', () => {
  it('reserves, pays, issues by code and accepts a review', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 3, startInMin: 60 });
    const buyer = await login(app, undefined, 'Айгерим');
    const b = api(app, buyer.token);

    const feed = await b.get('/offers?lat=42.87&lng=74.6');
    expect(feed.json().items.map((o: { id: string }) => o.id)).toContain(offer.id);

    const created = await b.post('/orders', { offerId: offer.id, quantity: 1 });
    expect(created.statusCode).toBe(201);
    const order = created.json();
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.payUrl).toContain('/mock-pay/');
    expect(order.pickupCode).toBeNull();

    const paid = await pay(app, order.id);
    expect(paid.statusCode).toBe(200);
    // FR-R06: a repeated webhook is a no-op
    const again = await pay(app, order.id);
    expect(again.json().duplicate).toBe(true);

    const afterPay = (await b.get(`/orders/${order.id}`)).json();
    expect(afterPay.status).toBe('PAID');
    expect(afterPay.pickupCode).toMatch(/^\d{6}$/);
    expect((await prisma.boxOffer.findUniqueOrThrow({ where: { id: offer.id } })).sold).toBe(1);

    const partnerNotes = await prisma.notification.findMany({ where: { userId: ctx.owner.user.id, type: 'partner_new_order' } });
    expect(partnerNotes).toHaveLength(1);

    // too early to issue
    const early = await api(app, ctx.owner.token).post('/partner/orders/issue', { code: afterPay.pickupCode });
    expect(early.json().error.code).toBe('too_early');

    await shiftOffer(offer.id, -5);
    await markReady();
    const issued = await api(app, ctx.owner.token).post('/partner/orders/issue', { code: afterPay.pickupCode });
    expect(issued.statusCode).toBe(200);
    expect(issued.json().status).toBe('ISSUED');
    const twice = await api(app, ctx.owner.token).post('/partner/orders/issue', { qrToken: afterPay.qrToken });
    expect(twice.json().error.code).toBe('already_issued');

    const review = await b.post(`/orders/${order.id}/review`, { rating: 5, text: 'Очень вкусно' });
    expect(review.statusCode).toBe(200);
    const partner = await prisma.partner.findUniqueOrThrow({ where: { id: ctx.partner.id } });
    expect(partner.rating).toBe(5);

    const impact = (await b.get('/me/impact')).json();
    expect(impact).toMatchObject({ boxes: 1, foodKg: 1.5, savedKgs: 400 });
  });

  it('never sells more boxes than listed under concurrent orders', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 2 });
    const buyers = await Promise.all([login(app), login(app), login(app), login(app)]);
    const results = await Promise.all(
      buyers.map((u) => api(app, u.token).post('/orders', { offerId: offer.id, quantity: 1 })),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([201, 201, 409, 409]);
    expect((await prisma.boxOffer.findUniqueOrThrow({ where: { id: offer.id } })).sold).toBe(2);
  });

  it('limits unpaid reservations per buyer', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 10 });
    const b = api(app, (await login(app)).token);
    expect((await b.post('/orders', { offerId: offer.id })).statusCode).toBe(201);
    expect((await b.post('/orders', { offerId: offer.id })).statusCode).toBe(201);
    const third = await b.post('/orders', { offerId: offer.id });
    expect(third.json().error.code).toBe('too_many_pending_orders');
  });

  it('expires unpaid reservations and refunds payments that arrive late', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 1 });
    const buyer = await login(app);
    const order = (await api(app, buyer.token).post('/orders', { offerId: offer.id })).json();

    expect(await expireReservations(new Date(Date.now() + 11 * 60_000))).toBe(1);
    expect((await prisma.boxOffer.findUniqueOrThrow({ where: { id: offer.id } })).sold).toBe(0);

    const late = await pay(app, order.id);
    expect(late.json().refunded).toBe(true);
    expect(refunds).toHaveLength(1);
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe('EXPIRED');
    expect(stored.refundedKgs).toBe(200);
  });

  it('lets the buyer cancel a paid order until 2 hours before pickup', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 2 });
    const buyer = await login(app);
    const b = api(app, buyer.token);
    const order = (await b.post('/orders', { offerId: offer.id })).json();
    await pay(app, order.id);

    const cancelled = await b.post(`/orders/${order.id}/cancel`);
    expect(cancelled.json().status).toBe('CANCELLED_BY_BUYER');
    expect(refunds).toEqual([expect.objectContaining({ amountKgs: 200 })]);
    expect((await prisma.boxOffer.findUniqueOrThrow({ where: { id: offer.id } })).sold).toBe(0);

    const second = (await b.post('/orders', { offerId: offer.id })).json();
    await pay(app, second.id);
    await shiftOffer(offer.id, 60); // pickup in 1 hour: too late to cancel
    const denied = await b.post(`/orders/${second.id}/cancel`);
    expect(denied.json().error.code).toBe('cancel_deadline_passed');
  });

  it('refunds and notifies buyers when the partner cancels the offer', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 3 });
    const buyer = await login(app);
    const order = (await api(app, buyer.token).post('/orders', { offerId: offer.id })).json();
    await pay(app, order.id);

    const res = await api(app, ctx.owner.token).post(`/partner/offers/${offer.id}/cancel`, { reason: 'Всё раскупили' });
    expect(res.json().status).toBe('CANCELLED');
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe('CANCELLED_BY_PARTNER');
    expect(stored.refundedKgs).toBe(200);
    const notes = await prisma.notification.findMany({ where: { userId: buyer.user.id } });
    expect(notes.map((n) => n.type)).toEqual(expect.arrayContaining(['order_cancelled_by_partner', 'refund_issued']));
    expect((await prisma.partner.findUniqueOrThrow({ where: { id: ctx.partner.id } })).cancellationsCount).toBe(1);
  });

  it('does not let quantity drop below sold boxes', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 3 });
    const buyer = await login(app);
    await api(app, buyer.token).post('/orders', { offerId: offer.id, quantity: 2 });
    const res = await api(app, ctx.owner.token).patch(`/partner/offers/${offer.id}`, { quantity: 1 });
    expect(res.json().error.code).toBe('quantity_below_sold');
    const ok = await api(app, ctx.owner.token).patch(`/partner/offers/${offer.id}`, { quantity: 2 });
    expect(ok.json().quantity).toBe(2);
  });
});

describe('after pickup', () => {
  it('marks no-shows without refund and tells the partner', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 1 });
    const buyer = await login(app);
    const order = (await api(app, buyer.token).post('/orders', { offerId: offer.id })).json();
    await pay(app, order.id);
    await shiftOffer(offer.id, -120, 60); // window ended an hour ago

    expect(await markNoShows()).toBe(1);
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe('NO_SHOW');
    expect(stored.refundedKgs).toBe(0);
    const note = await prisma.notification.findFirst({ where: { userId: ctx.owner.user.id, type: 'partner_unpicked' } });
    expect(note?.body).toContain('1');
  });

  it('handles a complaint refund and settles the weekly payout', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 5, startInMin: -5 });
    const buyer = await login(app);
    const b = api(app, buyer.token);

    const orders = [];
    for (let i = 0; i < 2; i++) {
      const o = (await b.post('/orders', { offerId: offer.id })).json();
      await pay(app, o.id);
      orders.push((await b.get(`/orders/${o.id}`)).json());
    }
    for (const o of orders) {
      const res = await api(app, ctx.owner.token).post('/partner/orders/issue', { qrToken: o.qrToken });
      expect(res.statusCode).toBe(200);
    }

    const complaint = await b.post(`/orders/${orders[0].id}/complaint`, { text: 'Бокс был испорчен' });
    expect(complaint.json().review.complaintStatus).toBe('OPEN');
    const list = await api(app, ctx.admin.token).get('/admin/complaints');
    expect(list.json().items).toHaveLength(1);
    const resolved = await api(app, ctx.admin.token).post(`/admin/complaints/${list.json().items[0].id}/resolve`, {
      decision: 'APPROVED',
      resolution: 'Вернули деньги',
    });
    expect(resolved.json().refundedKgs).toBe(200);

    const [payout] = await computePayouts(weekStart(localDate()));
    // 2 × 200 som; one fully refunded; commission 20% only on the kept order
    expect(payout).toMatchObject({ orders: 2, grossKgs: 400, refundsKgs: 200, commission: 40, netKgs: 160 });

    const csv = await api(app, ctx.admin.token).get(`/admin/payouts/export?periodFrom=${weekStart(localDate())}`);
    expect(csv.body).toContain('Тестовая пекарня');
  });

  it('auto-pauses a partner with a rating below 3.5 after 10 reviews', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 10 });
    const buyer = await login(app);
    for (let i = 0; i < 10; i++) {
      const order = await prisma.order.create({
        data: {
          number: `HH-T${i}`,
          userId: buyer.user.id,
          offerId: offer.id,
          amountKgs: 200,
          commissionKgs: 40,
          status: 'ISSUED',
          pickupCode: '000000',
          qrToken: `qr-${i}`,
          reservedUntil: new Date(),
        },
      });
      await prisma.review.create({ data: { orderId: order.id, userId: buyer.user.id, partnerId: ctx.partner.id, rating: 3 } });
    }
    await refreshPartnerRating(ctx.partner.id);
    const partner = await prisma.partner.findUniqueOrThrow({ where: { id: ctx.partner.id } });
    expect(partner.status).toBe('SUSPENDED');
    expect(await prisma.auditLog.count({ where: { action: 'partner.auto_suspend' } })).toBe(1);
  });
});

describe('regressions', () => {
  it('keeps the review text when a complaint is filed and reports re-issue by code', async () => {
    const ctx = await setupPartner(app);
    const offer = await createOffer(app, ctx, { quantity: 2, startInMin: -5 });
    const buyer = await login(app);
    const b = api(app, buyer.token);
    const o = (await b.post('/orders', { offerId: offer.id })).json();
    await pay(app, o.id);
    const { pickupCode } = (await b.get(`/orders/${o.id}`)).json();
    const owner = api(app, ctx.owner.token);
    expect((await owner.post('/partner/orders/issue', { code: pickupCode })).statusCode).toBe(200);
    expect((await owner.post('/partner/orders/issue', { code: pickupCode })).json().error.code).toBe('already_issued');

    await b.post(`/orders/${o.id}/review`, { rating: 2, text: 'Мало еды' });
    const after = (await b.post(`/orders/${o.id}/complaint`, { text: 'Булочки были чёрствые' })).json();
    expect(after.review).toMatchObject({ rating: 2, text: 'Мало еды', complaintText: 'Булочки были чёрствые' });
    const page = (await api(app).get(`/partners/${ctx.partner.id}`)).json();
    expect(page.reviews).toHaveLength(1);
  });

  it('limits location-bound staff to their own location', async () => {
    const ctx = await setupPartner(app);
    const owner = api(app, ctx.owner.token);
    const other = (
      await owner.post('/partner/locations', {
        name: 'Вторая', address: 'ул. Киевская, 2', lat: 42.87, lng: 74.59, openTime: '00:00', closeTime: '23:59',
      })
    ).json();
    const staffPhone = '+996555777001';
    await owner.post('/partner/staff', { phone: staffPhone, name: 'Кассир', locationId: other.id });
    const staff = api(app, (await login(app, staffPhone)).token);
    const offer = await createOffer(app, ctx); // at the first location
    expect((await staff.patch(`/partner/offers/${offer.id}`, { quantity: 1 })).statusCode).toBe(404);
    expect((await staff.post(`/partner/offers/${offer.id}/cancel`, { reason: 'тест' })).statusCode).toBe(404);
    expect((await staff.get('/partner/stats')).statusCode).toBe(403);
  });

  it('treats favorites=false as false', async () => {
    const ctx = await setupPartner(app);
    await createOffer(app, ctx, { startInMin: 60 });
    const b = api(app, (await login(app)).token);
    expect((await b.get('/offers?favorites=false')).json().items).toHaveLength(1);
    expect((await b.get('/offers?favorites=true')).json().items).toHaveLength(0);
  });
});

describe('schedules', () => {
  it('generates offers from a recurring schedule once per day', async () => {
    const ctx = await setupPartner(app);
    const res = await api(app, ctx.owner.token).post('/partner/schedules', {
      templateId: ctx.template.id,
      locationId: ctx.location.id,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      quantity: 4,
      pickupFromTime: '23:00',
      pickupToTime: '23:59',
    });
    expect(res.statusCode).toBe(201);
    const { generateScheduledOffers } = await import('../src/services/offers.js');
    const tomorrow = addDays(localDate(), 1);
    expect(await generateScheduledOffers(tomorrow)).toBe(1);
    expect(await generateScheduledOffers(tomorrow)).toBe(0);
    const r = await tick();
    expect(r.expired).toBe(0);
  });
});
