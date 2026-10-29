import type { Offer } from '@/api/types';

export interface LocationGroup {
  location: Offer['location'];
  partnerName: string;
  offers: Offer[];
  available: number;
  /** Marker label: cheapest price. */
  label: string;
}

export function groupByLocation(offers: Offer[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>();
  for (const o of offers) {
    let g = map.get(o.location.id);
    if (!g) {
      g = { location: o.location, partnerName: o.partner.brandName, offers: [], available: 0, label: '' };
      map.set(o.location.id, g);
    }
    g.offers.push(o);
    g.available += o.remaining;
  }
  for (const g of map.values()) {
    const min = Math.min(...g.offers.map((o) => o.priceKgs));
    g.label = `${min}`;
  }
  return [...map.values()];
}
