import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { OfferFilters } from '@/api/types';

export const DEFAULT_FILTERS: OfferFilters = { sort: 'pickup', radiusKm: 10 };

/** Feed filters shared by the list ("Рядом") and the map ("Карта"). */
const FiltersContext = createContext<{
  filters: OfferFilters;
  setFilters: (f: OfferFilters | ((prev: OfferFilters) => OfferFilters)) => void;
  activeCount: number;
} | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<OfferFilters>(DEFAULT_FILTERS);
  const value = useMemo(() => {
    const activeCount =
      (filters.maxPrice ? 1 : 0) +
      (filters.pickupAfter ? 1 : 0) +
      (filters.pickupBefore ? 1 : 0) +
      (filters.sort !== DEFAULT_FILTERS.sort ? 1 : 0) +
      (filters.radiusKm !== DEFAULT_FILTERS.radiusKm ? 1 : 0);
    return { filters, setFilters, activeCount };
  }, [filters]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used inside FiltersProvider');
  return ctx;
}
