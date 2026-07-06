import type { ThemeMeta } from '../types';

// CSS-free on purpose: the admin reads this without touching the theme's
// components or styles. Keep imports out of this file.
export const themeMeta: ThemeMeta = {
  heroPhotoAspectRatio: 4 / 5, // portrait hero frame (1364x1818-ish)
  // Tyler's Plum palette (from global.css): dark ink, purple primary, gold-adjacent
  // highlight. His admin reads unmistakably as his page.
  brand: {
    bg: '#0E0E10', surface: '#151419', surface2: '#1C1B22', line: '#2A2831',
    text: '#F5F3EF', muted: '#9A97A2',
    accent: '#6C4AA0', accentHi: '#9B78D6', // --purple / --purple-hi
    danger: '#E5534B',
  },
};
