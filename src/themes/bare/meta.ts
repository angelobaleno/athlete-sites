import type { ThemeMeta } from '../types';

// Deliberately different from tyler (1:1) so the cropper seam is provably
// manifest-driven, never hardcoded to one theme's frame.
export const themeMeta: ThemeMeta = {
  heroPhotoAspectRatio: 1,
  // bare is a LIGHT theme — its admin is light too, the opposite of tyler's dark
  // Plum skin. Proves the admin palette is manifest-driven, not one hardcoded look.
  brand: {
    bg: '#FFFFFF', surface: '#F6F6F7', surface2: '#EEEEF0', line: '#DDDDE1',
    text: '#111111', muted: '#666666',
    accent: '#0A58CA', accentHi: '#3B7DE0',
    danger: '#C9372C',
  },
};
