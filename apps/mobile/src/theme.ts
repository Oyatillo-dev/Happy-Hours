import type { Category } from '@/api/types';

// Soft UI: a light sage page with slightly lighter raised surfaces that float on soft shadows.
export const colors = {
  brand: '#157a43',
  brandDark: '#0f5c32',
  brandSoft: '#e2f0e5',
  accent: '#f2b33d',
  bg: '#ecf0eb',
  card: '#f7faf6',
  // fields look pressed into the page (React Native has no inset shadow)
  inset: '#e2e8e1',
  text: '#18241b',
  muted: '#5a6b5e',
  faint: '#7d8b80',
  border: '#d9e0d8',
  danger: '#c0392b',
  dangerSoft: '#fdecea',
  warning: '#b7791f',
  warningSoft: '#fff6e0',
  star: '#f2a30f',
  white: '#ffffff',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

/** Display face for headings and prices (loaded in app/_layout.tsx); body text stays the system font. */
export const fonts = { display: 'Unbounded_700Bold' };

/** Raised surfaces: one soft sage shadow (React Native has no second, light shadow). */
export const shadow = {
  raise: {
    shadowColor: '#7e8e82',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 4, height: 6 },
    elevation: 4,
  },
  raiseSm: {
    shadowColor: '#7e8e82',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 4 },
    elevation: 2,
  },
  glow: {
    shadowColor: '#157a43',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
} as const;
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
