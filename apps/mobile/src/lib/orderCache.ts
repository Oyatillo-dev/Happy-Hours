import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Order } from '@/api/types';

/**
 * NFR-09: the pickup QR and code must be available without network.
 * Every order the app sees is written here and read back when the API is unreachable.
 */
const PREFIX = 'hh.order.';
const LIST_KEY = 'hh.orders.active';

export const orderCache = {
  async save(order: Order) {
    await AsyncStorage.setItem(PREFIX + order.id, JSON.stringify(order)).catch(() => undefined);
  },
  async get(id: string): Promise<Order | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + id);
      return raw ? (JSON.parse(raw) as Order) : null;
    } catch {
      return null;
    }
  },
  async saveActiveList(orders: Order[]) {
    await AsyncStorage.setItem(LIST_KEY, JSON.stringify(orders)).catch(() => undefined);
    await Promise.all(orders.map((o) => orderCache.save(o)));
  },
  async getActiveList(): Promise<Order[] | null> {
    try {
      const raw = await AsyncStorage.getItem(LIST_KEY);
      return raw ? (JSON.parse(raw) as Order[]) : null;
    } catch {
      return null;
    }
  },
  /** On logout / account deletion. */
  async clear() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX) || k === LIST_KEY));
    } catch {
      // ignore
    }
  },
};
