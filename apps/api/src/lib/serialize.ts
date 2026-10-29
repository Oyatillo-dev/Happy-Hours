import type { BoxOffer, BoxTemplate, Location, Order, Partner, Review } from '@prisma/client';
import { rules } from '../config.js';
import { hours } from './time.js';

export type OfferWithRelations = BoxOffer & {
  template: BoxTemplate;
  location: Location & { partner: Partner };
};

export function offerDto(offer: OfferWithRelations, extra: { distanceKm?: number; isFavorite?: boolean } = {}) {
  const { template, location } = offer;
  return {
    id: offer.id,
    date: offer.date,
    status: offer.status,
    quantity: offer.quantity,
    remaining: Math.max(offer.quantity - offer.sold, 0),
    priceKgs: offer.priceKgs,
    valueKgs: offer.valueKgs,
    pickupFrom: offer.pickupFrom,
    pickupTo: offer.pickupTo,
    template: {
      id: template.id,
      title: template.title,
      category: template.category,
      description: template.description,
      allergens: template.allergens,
      weightKg: template.weightKg,
      photoUrl: template.photoUrl,
    },
    location: {
      id: location.id,
      name: location.name,
      address: location.address,
      lat: location.lat,
      lng: location.lng,
    },
    partner: {
      id: location.partner.id,
      brandName: location.partner.brandName,
      category: location.partner.category,
      rating: location.partner.rating,
      ratingCount: location.partner.ratingCount,
    },
    ...extra,
  };
}

export function buyerOrderDto(
  order: Order & { offer: OfferWithRelations; review?: Review | null },
  payUrl?: string | null,
) {
  const active = order.status === 'PAID' || order.status === 'READY';
  const cancelDeadline = new Date(order.offer.pickupFrom.getTime() - hours(rules.buyerCancelHoursBefore));
  const complaintDeadline = order.issuedAt
    ? new Date(order.issuedAt.getTime() + hours(rules.complaintWindowHours))
    : null;
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    quantity: order.quantity,
    amountKgs: order.amountKgs,
    refundedKgs: order.refundedKgs,
    pickupCode: active ? order.pickupCode : null,
    qrToken: active ? order.qrToken : null,
    reservedUntil: order.reservedUntil,
    paidAt: order.paidAt,
    issuedAt: order.issuedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    payUrl: order.status === 'PENDING_PAYMENT' ? (payUrl ?? null) : null,
    canCancel:
      order.status === 'PENDING_PAYMENT' || (order.status === 'PAID' && Date.now() <= cancelDeadline.getTime()),
    cancelDeadline,
    canReview: order.status === 'ISSUED' && !order.review?.rating,
    canComplain:
      (order.status === 'ISSUED' || order.status === 'NO_SHOW') &&
      !order.review?.isComplaint &&
      (!complaintDeadline || Date.now() <= complaintDeadline.getTime()),
    review: order.review
      ? {
          rating: order.review.rating,
          text: order.review.text,
          isComplaint: order.review.isComplaint,
          complaintText: order.review.complaintText,
          complaintStatus: order.review.complaintStatus,
          resolution: order.review.resolution,
        }
      : null,
    offer: offerDto(order.offer),
  };
}

export const offerInclude = {
  template: true,
  location: { include: { partner: true } },
} as const;
