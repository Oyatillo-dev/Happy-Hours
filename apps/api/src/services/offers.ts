import type { BoxTemplate, Location } from '@prisma/client';
import { rules } from '../config.js';
import { prisma } from '../db.js';
import { audit } from '../lib/audit.js';
import { AppError, notFound } from '../lib/errors.js';
import { localDate, localDateTime, toMinutes, weekday } from '../lib/time.js';
import { notify } from './notifications.js';
import { cancelOrdersOfOffer } from './orders.js';

/** FR-R01: the box must be worth at least twice its price, price from 100 som. */
export function validatePrices(priceKgs: number, valueKgs: number) {
  if (priceKgs < rules.minPriceKgs) throw new AppError('price_too_low', 400, undefined, { min: rules.minPriceKgs });
  if (valueKgs < priceKgs * rules.minValueMultiplier) {
    throw new AppError('value_too_low', 400, undefined, { multiplier: rules.minValueMultiplier });
  }
}

/** FR-R02: window of 30 min … 3 h inside the location's working hours. */
export function validateWindow(location: Pick<Location, 'openTime' | 'closeTime'>, from: string, to: string) {
  const length = toMinutes(to) - toMinutes(from);
  if (length < rules.minWindowMinutes || length > rules.maxWindowMinutes) {
    throw new AppError('invalid_window_length', 400, undefined, {
      min: rules.minWindowMinutes,
      max: rules.maxWindowMinutes,
    });
  }
  if (toMinutes(from) < toMinutes(location.openTime) || toMinutes(to) > toMinutes(location.closeTime)) {
    throw new AppError('window_outside_hours');
  }
}

async function loadOwned(partnerId: string, templateId: string, locationId: string) {
  const [template, location] = await Promise.all([
    prisma.boxTemplate.findFirst({ where: { id: templateId, partnerId } }),
    prisma.location.findFirst({ where: { id: locationId, partnerId } }),
  ]);
  if (!template || !template.active) throw notFound('template');
  if (!location || !location.active) throw notFound('location');
  return { template, location };
}

async function notifyFavorites(partnerId: string, place: string, template: BoxTemplate, offerId: string) {
  const fans = await prisma.favorite.findMany({ where: { partnerId }, select: { userId: true } });
  await notify(
    fans.map((f) => f.userId),
    'favorite_new_offer',
    { place, title: template.title, price: template.priceKgs },
    { offerId },
  );
}

export async function publishOffer(
  partnerId: string,
  input: {
    templateId: string;
    locationId: string;
    date?: string;
    quantity: number;
    pickupFromTime: string;
    pickupToTime: string;
  },
) {
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId } });
  if (partner.status !== 'ACTIVE') throw new AppError('partner_not_active', 403);
  const { template, location } = await loadOwned(partnerId, input.templateId, input.locationId);
  validateWindow(location, input.pickupFromTime, input.pickupToTime);

  const date = input.date ?? localDate();
  if (date < localDate()) throw new AppError('date_in_past');
  const pickupFrom = localDateTime(date, input.pickupFromTime);
  const pickupTo = localDateTime(date, input.pickupToTime);
  if (pickupTo <= new Date()) throw new AppError('window_in_past');

  const offer = await prisma.boxOffer.create({
    data: {
      templateId: template.id,
      locationId: location.id,
      date,
      quantity: input.quantity,
      priceKgs: template.priceKgs,
      valueKgs: template.valueKgs,
      pickupFrom,
      pickupTo,
    },
  });
  await notifyFavorites(partnerId, partner.brandName, template, offer.id);
  return offer;
}

/** FR-P05: quantity can change during the day but never below what is already sold. */
export async function updateOfferQuantity(partnerId: string, offerId: string, quantity: number) {
  const offer = await prisma.boxOffer.findFirst({ where: { id: offerId, location: { partnerId } } });
  if (!offer) throw notFound('offer');
  if (offer.status !== 'ACTIVE') throw new AppError('offer_cancelled', 409);
  const res = await prisma.boxOffer.updateMany({
    where: { id: offerId, sold: { lte: quantity } },
    data: { quantity },
  });
  if (res.count === 0) throw new AppError('quantity_below_sold', 409, undefined, { sold: offer.sold });
  return prisma.boxOffer.findUniqueOrThrow({ where: { id: offerId } });
}

/** FR-P06 */
export async function cancelOffer(partnerId: string, offerId: string, actorId: string, reason: string) {
  const offer = await prisma.boxOffer.findFirst({ where: { id: offerId, location: { partnerId } } });
  if (!offer) throw notFound('offer');
  if (offer.status === 'CANCELLED') return offer;
  await prisma.boxOffer.update({ where: { id: offerId }, data: { status: 'CANCELLED' } });
  const affected = await cancelOrdersOfOffer(offerId, reason);
  if (affected > 0) {
    await prisma.partner.update({ where: { id: partnerId }, data: { cancellationsCount: { increment: 1 } } });
  }
  await audit('offer.cancel', 'BoxOffer', offerId, actorId, { reason, affectedOrders: affected });
  return prisma.boxOffer.findUniqueOrThrow({ where: { id: offerId } });
}

/** FR-P04: creates today's offers from recurring schedules (idempotent). */
export async function generateScheduledOffers(date = localDate()) {
  const day = weekday(date);
  const schedules = await prisma.schedule.findMany({
    where: {
      active: true,
      weekdays: { has: day },
      template: { active: true },
      location: { active: true, partner: { status: 'ACTIVE' } },
    },
    include: { template: true, location: { include: { partner: true } } },
  });
  let created = 0;
  for (const s of schedules) {
    const pickupTo = localDateTime(date, s.pickupToTime);
    if (pickupTo <= new Date()) continue;
    const exists = await prisma.boxOffer.findUnique({ where: { scheduleId_date: { scheduleId: s.id, date } } });
    if (exists) continue;
    const offer = await prisma.boxOffer
      .create({
        data: {
          templateId: s.templateId,
          locationId: s.locationId,
          scheduleId: s.id,
          date,
          quantity: s.quantity,
          priceKgs: s.template.priceKgs,
          valueKgs: s.template.valueKgs,
          pickupFrom: localDateTime(date, s.pickupFromTime),
          pickupTo,
        },
      })
      .catch(() => null); // a concurrent run created it first
    if (!offer) continue;
    created += 1;
    await notifyFavorites(s.location.partnerId, s.location.partner.brandName, s.template, offer.id);
  }
  return created;
}
