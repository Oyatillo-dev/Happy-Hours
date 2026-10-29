// Mirrors apps/api/src/lib/serialize.ts (offerDto, buyerOrderDto) and route responses.
// Dates arrive as ISO strings in UTC.

export type Category = 'BAKERY' | 'MEALS' | 'GROCERY' | 'DESSERTS' | 'MIXED';
export const CATEGORIES: Category[] = ['BAKERY', 'MEALS', 'GROCERY', 'DESSERTS', 'MIXED'];

export type Language = 'ru' | 'ky';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'EXPIRED'
  | 'PAID'
  | 'READY'
  | 'ISSUED'
  | 'NO_SHOW'
  | 'CANCELLED_BY_BUYER'
  | 'CANCELLED_BY_PARTNER'
  | 'REFUNDED';

export const ACTIVE_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'READY'];

export interface User {
  id: string;
  phone: string;
  name: string | null;
  language: Language;
  role: 'BUYER' | 'PARTNER_OWNER' | 'PARTNER_STAFF' | 'ADMIN' | string;
  partnerId: string | null;
  locationId: string | null;
  partner: { id: string; brandName: string; status: string } | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  isNew: boolean;
}

export interface Offer {
  id: string;
  date: string;
  status: string;
  quantity: number;
  remaining: number;
  priceKgs: number;
  valueKgs: number;
  pickupFrom: string;
  pickupTo: string;
  template: {
    id: string;
    title: string;
    category: Category;
    description: string | null;
    allergens: string | null;
    weightKg: number;
    photoUrl: string | null;
  };
  location: { id: string; name: string; address: string; lat: number; lng: number };
  partner: { id: string; brandName: string; category: string; rating: number | null; ratingCount: number };
  distanceKm?: number;
  isFavorite?: boolean;
}

export interface Review {
  rating: number | null;
  text: string | null;
  complaintText?: string | null;
  isComplaint: boolean;
  complaintStatus: string | null;
  resolution: string | null;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  quantity: number;
  amountKgs: number;
  refundedKgs: number;
  pickupCode: string | null;
  qrToken: string | null;
  reservedUntil: string;
  paidAt: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  payUrl: string | null;
  canCancel: boolean;
  cancelDeadline: string;
  canReview: boolean;
  canComplain: boolean;
  review: Review | null;
  offer: Offer;
}

export interface PartnerPage {
  id: string;
  brandName: string;
  category: string;
  rating: number | null;
  ratingCount: number;
  isFavorite: boolean;
  locations: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    openTime: string | null;
    closeTime: string | null;
  }[];
  offers: Offer[];
  reviews: { rating: number | null; text: string | null; author: string; createdAt: string }[];
}

export interface FavoritePartner {
  partnerId: string;
  brandName: string;
  category: string;
  rating: number | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface Impact {
  boxes: number;
  foodKg: number;
  savedKgs: number;
  co2Kg: number;
}

export type SortMode = 'distance' | 'price' | 'pickup';

export interface OfferFilters {
  category?: Category;
  maxPrice?: number;
  pickupAfter?: string;
  pickupBefore?: string;
  q?: string;
  favorites?: boolean;
  sort: SortMode;
  radiusKm: number;
}
