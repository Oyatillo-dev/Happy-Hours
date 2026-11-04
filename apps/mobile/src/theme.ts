import type { Category } from '@/api/types';

// Soft UI in the brand book colours: a cream page with white raised cards, green #176b52 for
// actions and links, dark #173b35 text, gold only for discounts and ratings.
export const colors = {
  brand: '#176b52',
  brandDark: '#0f5a44',
  brandSoft: '#e1eee7',
  primary: '#176b52',
  primaryPressed: '#0f5a44',
  onPrimary: '#ffffff',
  accent: '#e7b66b',
  sky: '#a9c8a0',
  skySoft: '#e1eee7',
  cherry: '#b42318',
  success: '#176b52',
  successSoft: '#e1eee7',
  bg: '#f5f1e8',
  card: '#ffffff',
  // fields look pressed into the page (React Native has no inset shadow)
  inset: '#ebe5d7',
  text: '#173b35',
  muted: '#4c625b',
  faint: '#7a8a84',
  border: '#ddd5c2',
  danger: '#b42318',
  dangerSoft: '#fbe4dc',
  warning: '#8a5600',
  warningSoft: '#f9ebc9',
  star: '#d9a24a',
  white: '#ffffff',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

/** Display face for headings and prices (loaded in app/_layout.tsx); body text stays the system font. */
export const fonts = { display: 'Manrope_800ExtraBold' };

/** Raised surfaces: one soft warm shadow (React Native has no second, light shadow). */
export const shadow = {
  raise: {
    shadowColor: '#8f8670',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 4, height: 6 },
    elevation: 4,
  },
  raiseSm: {
    shadowColor: '#8f8670',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 4 },
    elevation: 2,
  },
  glow: {
    shadowColor: '#176b52',
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
