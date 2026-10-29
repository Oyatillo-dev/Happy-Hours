import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { orderCache } from '@/lib/orderCache';
import { api, ApiError, isNetworkError } from './client';
import type {
  AppNotification,
  FavoritePartner,
  Impact,
  Language,
  Offer,
  OfferFilters,
  Order,
  PartnerPage,
  User,
} from './types';

export const keys = {
  offers: (f: OfferFilters, lat: number, lng: number) => ['offers', f, lat, lng] as const,
  offer: (id: string) => ['offer', id] as const,
  partner: (id: string) => ['partner', id] as const,
  orders: (scope: 'active' | 'history') => ['orders', scope] as const,
  order: (id: string) => ['order', id] as const,
  favorites: ['favorites'] as const,
  notifications: ['notifications'] as const,
  impact: ['impact'] as const,
};

// ---------- feed ----------

export function useOffers(filters: OfferFilters, origin: { lat: number; lng: number; ready: boolean }) {
  return useQuery({
    queryKey: keys.offers(filters, origin.lat, origin.lng),
    enabled: origin.ready,
    queryFn: () =>
      api<{ items: Offer[]; date: string }>('GET', '/offers', {
        optionalAuth: true,
        query: {
          lat: origin.lat,
          lng: origin.lng,
          radiusKm: filters.radiusKm,
          category: filters.category,
          maxPrice: filters.maxPrice,
          pickupAfter: filters.pickupAfter,
          pickupBefore: filters.pickupBefore,
          q: filters.q?.trim() || undefined,
          // The API coerces any value to true (z.coerce.boolean), so only send it when on.
          favorites: filters.favorites ? 'true' : undefined,
          sort: filters.sort,
        },
      }),
  });
}

export function useOffer(id: string) {
  return useQuery({
    queryKey: keys.offer(id),
    queryFn: () => api<Offer>('GET', `/offers/${id}`, { optionalAuth: true }),
  });
}

export function usePartner(id: string) {
  return useQuery({
    queryKey: keys.partner(id),
    queryFn: () => api<PartnerPage>('GET', `/partners/${id}`, { optionalAuth: true }),
  });
}

// ---------- orders ----------

export interface Cached<T> {
  data: T;
  fromCache: boolean;
}

/** Orders list; the active list is cached for offline use (NFR-09). */
export function useOrders(scope: 'active' | 'history') {
  const { status } = useAuth();
  return useQuery({
    queryKey: keys.orders(scope),
    enabled: status === 'authed',
    networkMode: 'always',
    queryFn: async (): Promise<Cached<Order[]>> => {
      try {
        const { items } = await api<{ items: Order[] }>('GET', '/orders', { query: { scope } });
        if (scope === 'active') await orderCache.saveActiveList(items);
        return { data: items, fromCache: false };
      } catch (e) {
        if (scope === 'active' && isNetworkError(e)) {
          const cached = await orderCache.getActiveList();
          if (cached) return { data: cached, fromCache: true };
        }
        throw e;
      }
    },
  });
}

/** One order, falling back to the cached copy when the network fails (QR works offline). */
export function useOrder(id: string, opts: { poll?: boolean } = {}) {
  const { status } = useAuth();
  return useQuery({
    queryKey: keys.order(id),
    enabled: status === 'authed',
    networkMode: 'always',
    refetchInterval: opts.poll ? 2500 : false,
    queryFn: async (): Promise<Cached<Order>> => {
      try {
        const order = await api<Order>('GET', `/orders/${id}`);
        await orderCache.save(order);
        return { data: order, fromCache: false };
      } catch (e) {
        if (isNetworkError(e)) {
          const cached = await orderCache.get(id);
          if (cached) return { data: cached, fromCache: true };
        }
        throw e;
      }
    },
  });
}

function useOrderUpdater() {
  const qc = useQueryClient();
  return async (order: Order) => {
    qc.setQueryData<Cached<Order>>(keys.order(order.id), { data: order, fromCache: false });
    await orderCache.save(order);
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['offers'] });
    void qc.invalidateQueries({ queryKey: keys.offer(order.offer.id) });
  };
}

export function useReserve() {
  const update = useOrderUpdater();
  return useMutation({
    mutationFn: (v: { offerId: string; quantity: number }) => api<Order>('POST', '/orders', { body: v }),
    onSuccess: update,
  });
}

export function useStartPayment() {
  return useMutation({
    mutationFn: (orderId: string) => api<{ payUrl: string }>('POST', `/orders/${orderId}/pay`),
  });
}

export function useCancelOrder() {
  const update = useOrderUpdater();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api<Order>('POST', `/orders/${orderId}/cancel`),
    onSuccess: async (order) => {
      await update(order);
      void qc.invalidateQueries({ queryKey: keys.notifications });
    },
  });
}

export function useReview() {
  const update = useOrderUpdater();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { orderId: string; rating: number; text: string }) =>
      api<Order>('POST', `/orders/${v.orderId}/review`, { body: { rating: v.rating, text: v.text } }),
    onSuccess: async (order) => {
      await update(order);
      void qc.invalidateQueries({ queryKey: keys.partner(order.offer.partner.id) });
    },
  });
}

export function useComplaint() {
  const update = useOrderUpdater();
  return useMutation({
    mutationFn: (v: { orderId: string; text: string; photoUrl?: string }) =>
      api<Order>('POST', `/orders/${v.orderId}/complaint`, { body: { text: v.text, photoUrl: v.photoUrl } }),
    onSuccess: update,
  });
}

/** POST /uploads (multipart field `file`) → public URL. */
export async function uploadPhoto(asset: { uri: string; mimeType?: string | null; fileName?: string | null }) {
  const type = asset.mimeType ?? 'image/jpeg';
  const name = asset.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`;
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    form.append('file', blob, name);
  } else {
    // React Native's FormData accepts a { uri, name, type } descriptor for files.
    form.append('file', { uri: asset.uri, name, type } as unknown as Blob);
  }
  const { url } = await api<{ url: string }>('POST', '/uploads', { body: form });
  return url;
}

// ---------- favourites ----------

export function useFavorites() {
  const { status } = useAuth();
  return useQuery({
    queryKey: keys.favorites,
    enabled: status === 'authed',
    queryFn: async () => (await api<{ items: FavoritePartner[] }>('GET', '/favorites')).items,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { partnerId: string; favorite: boolean }) => {
      await api(v.favorite ? 'PUT' : 'DELETE', `/favorites/${v.partnerId}`);
      return v;
    },
    onMutate: (v) => {
      // Optimistic heart in lists and on detail screens.
      const patch = (o: Offer): Offer => (o.partner.id === v.partnerId ? { ...o, isFavorite: v.favorite } : o);
      qc.setQueriesData<{ items: Offer[]; date: string }>({ queryKey: ['offers'] }, (d) =>
        d ? { ...d, items: d.items.map(patch) } : d,
      );
      qc.setQueriesData<Offer>({ queryKey: ['offer'] }, (d) => (d ? patch(d) : d));
      qc.setQueryData<PartnerPage>(keys.partner(v.partnerId), (d) => (d ? { ...d, isFavorite: v.favorite } : d));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['offers'] });
      void qc.invalidateQueries({ queryKey: ['offer'] });
      void qc.invalidateQueries({ queryKey: ['partner'] });
      void qc.invalidateQueries({ queryKey: keys.favorites });
    },
  });
}

// ---------- me ----------

export function useImpact() {
  const { status } = useAuth();
  return useQuery({
    queryKey: keys.impact,
    enabled: status === 'authed',
    queryFn: () => api<Impact>('GET', '/me/impact'),
  });
}

export function useNotifications() {
  const { status } = useAuth();
  return useQuery({
    queryKey: keys.notifications,
    enabled: status === 'authed',
    queryFn: () => api<{ items: AppNotification[]; unread: number }>('GET', '/me/notifications'),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api('POST', '/me/notifications/read', { body: ids ? { ids } : {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function useUpdateMe() {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (v: { name?: string; language?: Language }) => api<User>('PATCH', '/me', { body: v }),
    onSuccess: setUser,
  });
}

export function useDeleteAccount() {
  const { signOut } = useAuth();
  return useMutation({
    mutationFn: () => api('DELETE', '/me'),
    onSuccess: () => signOut({ remote: false }),
  });
}

export const isApiError = (e: unknown, code: string) => e instanceof ApiError && e.code === code;
