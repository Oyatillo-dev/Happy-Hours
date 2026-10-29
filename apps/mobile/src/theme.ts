import type { Category } from '@/api/types';

export const colors = {
  brand: '#1f8a4c',
  brandDark: '#166b3a',
  brandSoft: '#e8f5ec',
  bg: '#f4f6f3',
  card: '#ffffff',
  text: '#1d2a1f',
  muted: '#5b6b5e',
  faint: '#8a978c',
  border: '#e2e8e3',
  danger: '#c0392b',
  dangerSoft: '#fdecea',
  warning: '#b7791f',
  warningSoft: '#fff6e0',
  star: '#f2a30f',
  white: '#ffffff',
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** Photo placeholder per category: soft background + MaterialCommunityIcons glyph. */
export const categoryLook: Record<
  Category,
  { bg: string; fg: string; icon: 'baguette' | 'food-variant' | 'basket' | 'cupcake' | 'shopping-outline' }
> = {
  BAKERY: { bg: '#fbefdc', fg: '#a86a1d', icon: 'baguette' },
  MEALS: { bg: '#e7f3e9', fg: '#1f8a4c', icon: 'food-variant' },
  GROCERY: { bg: '#e6f0fa', fg: '#2f6ea8', icon: 'basket' },
  DESSERTS: { bg: '#fbe8f0', fg: '#b0447a', icon: 'cupcake' },
  MIXED: { bg: '#efeaf8', fg: '#6a4fb0', icon: 'shopping-outline' },
};
