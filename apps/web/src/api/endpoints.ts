import { api, download, type Query } from './client';
import type {
  AdminComplaint,
  AdminDashboard,
  AdminOrderDetail,
  AdminOrderListItem,
  AdminPartnerDetail,
  AdminPartnerListItem,
  AdminPayout,
  AdminUser,
  ApplyInput,
  AuditEntry,
  BoxOffer,
  BoxTemplate,
  ComplaintStatus,
  IssuedOrder,
  Items,
  Language,
  Location,
  LocationInput,
  Me,
  Notification,
  OrderStatus,
  OtpRequestResponse,
  Paged,
  Partner,
  PartnerOffer,
  PartnerOrder,
  PartnerReview,
  PartnerStats,
  PartnerStatus,
  PartnerWithLocations,
  Payout,
  PublishOfferInput,
  Role,
  Schedule,
  ScheduleInput,
  StaffMember,
  TemplateInput,
  VerifyResponse,
} from './types';

const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });

export const authApi = {
  requestOtp: (phone: string) =>
    api<OtpRequestResponse>('/auth/otp/request', { method: 'POST', body: { phone }, anonymous: true }),
  verify: (body: { phone: string; code: string; name?: string; language?: Language }) =>
    api<VerifyResponse>('/auth/otp/verify', { method: 'POST', body, anonymous: true }),
  logout: (refreshToken: string) =>
    api<{ ok: true }>('/auth/logout', { method: 'POST', body: { refreshToken }, anonymous: true }),
};

export const meApi = {
  get: () => api<Me>('/me'),
  update: (body: { name?: string; language?: Language }) => patch<Me>('/me', body),
  notifications: () => api<{ items: Notification[]; unread: number }>('/me/notifications'),
  markRead: (ids?: string[]) => post<{ ok: true }>('/me/notifications/read', ids ? { ids } : {}),
};

export const partnerApi = {
  apply: (body: ApplyInput) => post<PartnerWithLocations>('/partner/apply', body),
  get: () => api<PartnerWithLocations>('/partner'),
  update: (body: Partial<Pick<Partner, 'brandName' | 'contactPhone' | 'bankName' | 'bankAccount'>>) =>
    patch<Partner>('/partner', body),

  locations: () => api<Items<Location>>('/partner/locations'),
  createLocation: (body: LocationInput) => post<Location>('/partner/locations', body),
  updateLocation: (id: string, body: Partial<LocationInput> & { active?: boolean }) =>
    patch<Location>(`/partner/locations/${id}`, body),

  staff: () => api<Items<StaffMember>>('/partner/staff'),
  addStaff: (body: { phone: string; name: string; locationId: string | null }) =>
    post<StaffMember>('/partner/staff', body),
  removeStaff: (id: string) => api<{ ok: true }>(`/partner/staff/${id}`, { method: 'DELETE' }),

  templates: () => api<Items<BoxTemplate>>('/partner/templates'),
  createTemplate: (body: TemplateInput) => post<BoxTemplate>('/partner/templates', body),
  updateTemplate: (id: string, body: Partial<TemplateInput> & { active?: boolean }) =>
    patch<BoxTemplate>(`/partner/templates/${id}`, body),

  schedules: () => api<Items<Schedule>>('/partner/schedules'),
  createSchedule: (body: ScheduleInput) => post<Schedule>('/partner/schedules', body),
  updateSchedule: (id: string, body: Partial<Omit<ScheduleInput, 'templateId' | 'locationId'>>) =>
    patch<Schedule>(`/partner/schedules/${id}`, body),
  deleteSchedule: (id: string) => api<{ ok: true }>(`/partner/schedules/${id}`, { method: 'DELETE' }),

  offers: (date?: string) => api<Items<PartnerOffer>>('/partner/offers', { query: { date } }),
  publishOffer: (body: PublishOfferInput) => post<BoxOffer>('/partner/offers', body),
  updateOffer: (id: string, quantity: number) => patch<BoxOffer>(`/partner/offers/${id}`, { quantity }),
  cancelOffer: (id: string, reason: string) => post<BoxOffer>(`/partner/offers/${id}/cancel`, { reason }),

  orders: (date?: string) => api<Items<PartnerOrder>>('/partner/orders', { query: { date } }),
  issue: (body: { qrToken: string } | { code: string }) => post<IssuedOrder>('/partner/orders/issue', body),

  stats: (from?: string, to?: string) => api<PartnerStats>('/partner/stats', { query: { from, to } }),
  payouts: () => api<Items<Payout>>('/partner/payouts'),
  reviews: () => api<Items<PartnerReview>>('/partner/reviews'),
};

export const adminApi = {
  dashboard: (from?: string, to?: string) => api<AdminDashboard>('/admin/dashboard', { query: { from, to } }),

  partners: (q: { status?: PartnerStatus; q?: string; limit?: number; offset?: number }) =>
    api<Paged<AdminPartnerListItem>>('/admin/partners', { query: q as Query }),
  partner: (id: string) => api<AdminPartnerDetail>(`/admin/partners/${id}`),
  approve: (id: string, body: { commissionPct?: number; promoMonths: number }) =>
    post<Partner>(`/admin/partners/${id}/approve`, body),
  reject: (id: string, reason: string) => post<Partner>(`/admin/partners/${id}/reject`, { reason }),
  suspend: (id: string, reason: string) => post<Partner>(`/admin/partners/${id}/suspend`, { reason }),
  reactivate: (id: string) => post<Partner>(`/admin/partners/${id}/reactivate`),
  commission: (id: string, body: { commissionPct: number; promoUntil?: string | null }) =>
    patch<Partner>(`/admin/partners/${id}/commission`, body),

  orders: (q: { q?: string; status?: OrderStatus; partnerId?: string; limit?: number; offset?: number }) =>
    api<Paged<AdminOrderListItem>>('/admin/orders', { query: q as Query }),
  order: (id: string) => api<AdminOrderDetail>(`/admin/orders/${id}`),
  refund: (id: string, body: { amountKgs?: number; reason: string }) =>
    post<{ refundedKgs: number }>(`/admin/orders/${id}/refund`, body),

  complaints: (status: ComplaintStatus) => api<Items<AdminComplaint>>('/admin/complaints', { query: { status } }),
  resolveComplaint: (
    id: string,
    body: { decision: 'APPROVED' | 'REJECTED'; resolution: string; refundKgs?: number },
  ) => post<{ ok: true; refundedKgs: number }>(`/admin/complaints/${id}/resolve`, body),

  payouts: (periodFrom?: string) =>
    api<{ periodFrom: string; items: AdminPayout[] }>('/admin/payouts', { query: { periodFrom } }),
  computePayouts: (periodFrom: string) => post<Items<Payout>>('/admin/payouts/compute', { periodFrom }),
  exportPayouts: (periodFrom: string) =>
    download('/admin/payouts/export', { periodFrom }, `payouts-${periodFrom}.csv`),
  markPaid: (id: string) => post<Payout>(`/admin/payouts/${id}/mark-paid`),

  users: (q: { q?: string; limit?: number; offset?: number }) =>
    api<Items<AdminUser>>('/admin/users', { query: q as Query }),
  setRole: (id: string, role: Extract<Role, 'BUYER' | 'SUPPORT' | 'ADMIN'>) =>
    patch<{ id: string; role: Role }>(`/admin/users/${id}/role`, { role }),

  audit: (q: { entity?: string; entityId?: string; limit?: number; offset?: number }) =>
    api<Items<AuditEntry>>('/admin/audit', { query: q as Query }),
};
