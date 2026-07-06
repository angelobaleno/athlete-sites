import type { ThemeMeta } from '../types';

// CSS-free on purpose: the admin reads this without touching the theme's
// components or styles. Keep imports out of this file.
export const themeMeta: ThemeMeta = {
  heroPhotoAspectRatio: 4 / 5, // portrait hero frame (1364x1818-ish)
};
