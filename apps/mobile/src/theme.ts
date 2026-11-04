import type { Category } from '@/api/types';

// Soft UI, "chocolate & cream": a cream page with lighter raised surfaces on warm shadows,
// chocolate for actions, ice blue for highlights, cherry for discounts and danger.
export const colors = {
  brand: '#47230f',
  brandDark: '#2a1a12',
  brandSoft: '#efe3cf',
  accent: '#c48a1c',
  sky: '#b5d0f3',
  skySoft: '#dfe9f7',
  cherry: '#8f1418',
  success: '#2a6f43',
  successSoft: '#e3efdc',
  bg: '#f6f1e3',
  card: '#fbf8ef',
  // fields look pressed into the page (React Native has no inset shadow)
  inset: '#ece4cf',
  text: '#2a1a12',
  muted: '#6b5444',
  faint: '#8a7464',
  border: '#e2d8c0',
  danger: '#a0191d',
  dangerSoft: '#f8e4dc',
  warning: '#8a5600',
  warningSoft: '#f9ebc9',
  star: '#d99a1e',
  white: '#ffffff',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

/** Display face for headings and prices (loaded in app/_layout.tsx); body text stays the system font. */
export const fonts = { display: 'Unbounded_700Bold' };

/** Raised surfaces: one soft warm shadow (React Native has no second, light shadow). */
export const shadow = {
  raise: {
    shadowColor: '#8a7356',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 4, height: 6 },
    elevation: 4,
  },
  raiseSm: {
    shadowColor: '#8a7356',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 4 },
    elevation: 2,
  },
  glow: {
    shadowColor: '#47230f',
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
  MEALS: { bg: '#e3efdc', fg: '#2a6f43', icon: 'food-variant' },
  GROCERY: { bg: '#e6f0fa', fg: '#2f6ea8', icon: 'basket' },
  DESSERTS: { bg: '#fbe8f0', fg: '#b0447a', icon: 'cupcake' },
  MIXED: { bg: '#efeaf8', fg: '#6a4fb0', icon: 'shopping-outline' },
};
