import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { optionalAuth } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { offerDto, offerInclude } from '../lib/serialize.js';
import { localDate, localTime } from '../lib/time.js';
import { hhmm, idParam, parse } from '../lib/validate.js';

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// z.coerce.boolean() would turn the string "false" into true
const queryBool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const feedQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).default(10),
  category: z.enum(['BAKERY', 'MEALS', 'GROCERY', 'DESSERTS', 'MIXED']).optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  pickupAfter: hhmm.optional(),
  pickupBefore: hhmm.optional(),
  q: z.string().trim().max(60).optional(),
  favorites: queryBool.optional(),
  includeSoldOut: queryBool.default('false'),
  sort: z.enum(['distance', 'price', 'pickup']).default('pickup'),
});

export async function offerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', optionalAuth);

  // FR-B02: today's boxes near the buyer
  app.get('/offers', async (request) => {
    const q = parse(feedQuery, request.query);
    const userId = request.user?.id;
    const favoriteIds = userId
      ? new Set((await prisma.favorite.findMany({ where: { userId } })).map((f) => f.partnerId))
      : new Set<string>();

    const offers = await prisma.boxOffer.findMany({
      where: {
        date: localDate(),
        status: 'ACTIVE',
        pickupTo: { gt: new Date() },
        location: {
          active: true,
          partner: {
            status: 'ACTIVE',
            ...(q.q ? { brandName: { contains: q.q, mode: 'insensitive' } } : {}),
            ...(q.favorites ? { id: { in: [...favoriteIds] } } : {}),
          },
        },
        template: q.category ? { category: q.category } : undefined,
        priceKgs: q.maxPrice ? { lte: q.maxPrice } : undefined,
      },
      include: offerInclude,
    });

    const origin = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : null;
    let items = offers
      .filter((o) => q.includeSoldOut || o.sold < o.quantity)
      .filter((o) => !q.pickupAfter || localTime(o.pickupTo) > q.pickupAfter)
      .filter((o) => !q.pickupBefore || localTime(o.pickupFrom) < q.pickupBefore)
      .map((o) =>
        offerDto(o, {
          distanceKm: origin ? Math.round(distanceKm(origin, o.location) * 10) / 10 : undefined,
          isFavorite: favoriteIds.has(o.location.partnerId),
        }),
      );
    if (origin) items = items.filter((o) => (o.distanceKm ?? 0) <= q.radiusKm);

    items.sort((a, b) => {
      if (q.sort === 'distance' && origin) return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
      if (q.sort === 'price') return a.priceKgs - b.priceKgs;
      return a.pickupFrom.getTime() - b.pickupFrom.getTime();
    });
    return { items, date: localDate() };
  });

  app.get('/offers/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const offer = await prisma.boxOffer.findUnique({ where: { id }, include: offerInclude });
    if (!offer || offer.location.partner.status !== 'ACTIVE') throw notFound('offer');
    const isFavorite = request.user
      ? !!(await prisma.favorite.findUnique({
          where: { userId_partnerId: { userId: request.user.id, partnerId: offer.location.partnerId } },
        }))
      : false;
    return offerDto(offer, { isFavorite });
  });

  app.get('/partners/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: { locations: { where: { active: true } } },
    });
    if (!partner || partner.status !== 'ACTIVE') throw notFound('partner');
    const [offers, reviews, isFavorite] = await Promise.all([
      prisma.boxOffer.findMany({
        where: { date: localDate(), status: 'ACTIVE', pickupTo: { gt: new Date() }, location: { partnerId: id } },
        include: offerInclude,
        orderBy: { pickupFrom: 'asc' },
      }),
      prisma.review.findMany({
        where: { partnerId: id, rating: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true } } },
      }),
      request.user
        ? prisma.favorite.findUnique({ where: { userId_partnerId: { userId: request.user.id, partnerId: id } } })
        : null,
    ]);
    return {
      id: partner.id,
      brandName: partner.brandName,
      category: partner.category,
      rating: partner.rating,
      ratingCount: partner.ratingCount,
      isFavorite: !!isFavorite,
      locations: partner.locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        lat: l.lat,
        lng: l.lng,
        openTime: l.openTime,
        closeTime: l.closeTime,
      })),
      offers: offers.map((o) => offerDto(o)),
      reviews: reviews.map((r) => ({
        rating: r.rating,
        text: r.text,
        author: r.user.name ?? '',
        createdAt: r.createdAt,
      })),
    };
  });
}
