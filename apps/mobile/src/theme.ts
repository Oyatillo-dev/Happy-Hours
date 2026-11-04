import type { Category } from '@/api/types';

// Soft UI, "Electric Citrus": a cream page with white raised cards on soft shadows, lime fills
// with dark text, coral accents. Lime is too light for text on cream, so text and icons in
// the brand colour use the darker `brand`; `primary` is only for filled shapes.
export const colors = {
  brand: '#4a6410',
  brandDark: '#3f5a0c',
  brandSoft: '#edf4cc',
  primary: '#b5d92b',
  primaryPressed: '#a5c81f',
  onPrimary: '#222b20',
  accent: '#ff784f',
  sky: '#b5d92b',
  skySoft: '#edf4cc',
  cherry: '#b3401f',
  success: '#2a6f43',
  successSoft: '#e3efdc',
  bg: '#f5f2d8',
  card: '#ffffff',
  // fields look pressed into the page (React Native has no inset shadow)
  inset: '#ebe7c8',
  text: '#222b20',
  muted: '#565f51',
  faint: '#7b8274',
  border: '#e0dcb8',
  danger: '#b42318',
  dangerSoft: '#fbe4dc',
  warning: '#8a5600',
  warningSoft: '#f9ebc9',
  star: '#ff784f',
  white: '#ffffff',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

/** Display face for headings and prices (loaded in app/_layout.tsx); body text stays the system font. */
export const fonts = { display: 'Unbounded_700Bold' };

/** Raised surfaces: one soft warm shadow (React Native has no second, light shadow). */
export const shadow = {
  raise: {
    shadowColor: '#9a956a',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 4, height: 6 },
    elevation: 4,
  },
  raiseSm: {
    shadowColor: '#9a956a',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 4 },
    elevation: 2,
  },
  glow: {
    shadowColor: '#8caa14',
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
