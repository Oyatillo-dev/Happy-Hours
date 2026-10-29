// Types mirroring the Happy Hours API responses (apps/api). Instants are ISO UTC strings.

export type Role = 'BUYER' | 'PARTNER_OWNER' | 'PARTNER_STAFF' | 'SUPPORT' | 'ADMIN';
export type Language = 'ru' | 'ky';
export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export type PartnerCategory = 'BAKERY' | 'CAFE' | 'RESTAURANT' | 'GROCERY' | 'OTHER';
export type BoxCategory = 'BAKERY' | 'MEALS' | 'GROCERY' | 'DESSERTS' | 'MIXED';
export type OfferStatus = 'ACTIVE' | 'CANCELLED';
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
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type ComplaintStatus = 'OPEN' | 'APPROVED' | 'REJECTED';
export type PayoutStatus = 'PENDING' | 'PAID';

export const PARTNER_STATUSES: PartnerStatus[] = ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'];
export const PARTNER_CATEGORIES: PartnerCategory[] = ['BAKERY', 'CAFE', 'RESTAURANT', 'GROCERY', 'OTHER'];
export const BOX_CATEGORIES: BoxCategory[] = ['BAKERY', 'MEALS', 'GROCERY', 'DESSERTS', 'MIXED'];
export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'EXPIRED',
  'PAID',
  'READY',
  'ISSUED',
  'NO_SHOW',
  'CANCELLED_BY_BUYER',
  'CANCELLED_BY_PARTNER',
  'REFUNDED',
];

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Me {
  id: string;
  phone: string;
  name: string | null;
  language: Language;
  role: Role;
  partnerId: string | null;
  locationId: string | null;
  partner: { id: string; brandName: string; status: PartnerStatus } | null;
}

export interface OtpRequestResponse {
  ok: true;
  phone: string;
  devCode?: string;
}

export interface VerifyResponse extends Tokens {
  user: Me;
  isNew: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

export interface Location {
  id: string;
  partnerId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  openTime: string;
  closeTime: string;
  active: boolean;
  createdAt: string;
}

export interface Partner {
  id: string;
  brandName: string;
  legalName: string;
  inn: string;
  category: PartnerCategory;
  contactPhone: string;
  bankName: string;
  bankAccount: string;
  commissionPct: number;
  promoUntil: string | null;
  status: PartnerStatus;
  rejectReason: string | null;
  rating: number | null;
  ratingCount: number;
  cancellationsCount: number;
  createdAt: string;
}

export interface PartnerWithLocations extends Partner {
  locations: Location[];
}

export interface StaffMember {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  locationId: string | null;
}

export interface BoxTemplate {
  id: string;
  partnerId: string;
  title: string;
  category: BoxCategory;
  description: string;
  allergens: string;
  priceKgs: number;
  valueKgs: number;
  weightKg: number;
  photoUrl: string | null;
  active: boolean;
  createdAt: string;
}

export interface Schedule {
  id: string;
  templateId: string;
  locationId: string;
  weekdays: number[];
  quantity: number;
  pickupFromTime: string;
  pickupToTime: string;
  active: boolean;
  createdAt: string;
  template: { title: string };
  location: { name: string };
}

export interface BoxOffer {
  id: string;
  templateId: string;
  locationId: string;
  scheduleId: string | null;
  date: string;
  quantity: number;
  sold: number;
  priceKgs: number;
  valueKgs: number;
  pickupFrom: string;
  pickupTo: string;
  status: OfferStatus;
  createdAt: string;
}

export interface PartnerOffer extends BoxOffer {
  template: BoxTemplate;
  location: { id: string; name: string };
  _count: { orders: number };
}

export interface PartnerOrder {
  id: string;
  number: string;
  status: OrderStatus;
  quantity: number;
  amountKgs: number;
  buyerName: string;
  buyerPhoneTail: string;
  boxTitle: string;
  locationName: string;
  pickupFrom: string;
  pickupTo: string;
  issuedAt: string | null;
  paidAt: string | null;
}

export interface IssuedOrder {
  id: string;
  number: string;
  status: OrderStatus;
  quantity: number;
  boxTitle: string;
  buyerName: string;
  issuedAt: string;
}

export interface PartnerStats {
  from: string;
  to: string;
  listedBoxes: number;
  soldBoxes: number;
  sellThrough: number;
  revenueKgs: number;
  commissionKgs: number;
  netKgs: number;
  foodKg: number;
  noShows: number;
  rating: number | null;
  ratingCount: number;
  cancellations: number;
  daily: { date: string; listed: number; sold: number; revenueKgs: number }[];
}

export interface Payout {
  id: string;
  partnerId: string;
  periodFrom: string;
  periodTo: string;
  orders: number;
  grossKgs: number;
  commission: number;
  refundsKgs: number;
  netKgs: number;
  status: PayoutStatus;
  paidAt: string | null;
  createdAt: string;
}

export interface PartnerReview {
  id: string;
  orderNumber: string;
  author: string;
  rating: number | null;
  text: string;
  photoUrl: string | null;
  complaintText?: string | null;
  isComplaint: boolean;
  complaintStatus: ComplaintStatus | null;
  resolution: string | null;
  createdAt: string;
}

export interface ApplyInput {
  brandName: string;
  legalName: string;
  inn: string;
  category: PartnerCategory;
  contactPhone: string;
  bankName: string;
  bankAccount: string;
  location: LocationInput;
}

export interface LocationInput {
  name: string;
  address: string;
  lat: number;
  lng: number;
  openTime: string;
  closeTime: string;
}

export interface TemplateInput {
  title: string;
  category: BoxCategory;
  description: string;
  allergens: string;
  priceKgs: number;
  valueKgs: number;
  weightKg: number;
  photoUrl: string | null;
}

export interface ScheduleInput {
  templateId: string;
  locationId: string;
  weekdays: number[];
  quantity: number;
  pickupFromTime: string;
  pickupToTime: string;
  active?: boolean;
}

export interface PublishOfferInput {
  templateId: string;
  locationId: string;
  date?: string;
  quantity: number;
  pickupFromTime: string;
  pickupToTime: string;
}

// ---------- admin ----------

export interface AdminDashboard {
  from: string;
  to: string;
  gmvKgs: number;
  revenueKgs: number;
  orders: number;
  boxesSold: number;
  boxesListed: number;
  sellThrough: number;
  noShowRate: number;
  repeatRate: number;
  partnersWithSales: number;
  partnersByStatus: Partial<Record<PartnerStatus, number>>;
  buyers: number;
  openComplaints: number;
  daily: { date: string; orders: number; gmvKgs: number; listed: number; sold: number }[];
}

export interface AdminPartnerListItem extends Partner {
  locations: Location[];
  users: { name: string | null; phone: string }[];
}

export interface AdminPartnerDetail extends Partner {
  locations: Location[];
  users: { id: string; name: string | null; phone: string; role: Role; locationId: string | null }[];
  templates: BoxTemplate[];
  payouts: Payout[];
}

export interface Order {
  id: string;
  number: string;
  userId: string;
  offerId: string;
  quantity: number;
  amountKgs: number;
  commissionKgs: number;
  status: OrderStatus;
  pickupCode: string;
  qrToken: string;
  reservedUntil: string;
  paidAt: string | null;
  issuedAt: string | null;
  issuedById: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  refundedKgs: number;
  createdAt: string;
}

export interface AdminOrderListItem extends Order {
  user: { name: string | null; phone: string };
  offer: BoxOffer & {
    template: { title: string };
    location: Location & { partner: { brandName: string } };
  };
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  providerRef: string;
  amountKgs: number;
  status: PaymentStatus;
  refundedKgs: number;
  payUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  orderId: string;
  userId: string;
  partnerId: string;
  rating: number | null;
  text: string;
  photoUrl: string | null;
  complaintText?: string | null;
  isComplaint: boolean;
  complaintStatus: ComplaintStatus | null;
  resolution: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  data: unknown;
  createdAt: string;
}

export interface AdminOrderDetail extends Order {
  user: { id: string; name: string | null; phone: string };
  payments: Payment[];
  review: Review | null;
  offer: BoxOffer & { template: BoxTemplate; location: Location & { partner: Partner } };
  history: AuditEntry[];
}

export interface AdminComplaint extends Review {
  user: { name: string | null; phone: string };
  partner: { id: string; brandName: string };
  order: { id: string; number: string; amountKgs: number; refundedKgs: number; status: OrderStatus };
}

export interface AdminPayout extends Payout {
  partner: { brandName: string; bankName: string; bankAccount: string };
}

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  partnerId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface Items<T> {
  items: T[];
}
