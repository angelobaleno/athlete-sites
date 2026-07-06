import type { ThemeBrand } from '../themes/types';

/**
 * Serialize a theme's brand palette into inline CSS-var declarations for the
 * admin's root element. Set as a `style` attribute on <html>, these override
 * admin.css's `:root` defaults deterministically (inline style beats a
 * stylesheet rule, so no source-order fragility) — which is how each athlete's
 * admin wears their site colors WITHOUT importing the theme's CSS. Fonts and
 * radius are intentionally absent; they stay shared across every admin.
 */
export function brandStyle(brand: ThemeBrand): string {
  return [
    `--a-bg:${brand.bg}`,
    `--a-surface:${brand.surface}`,
    `--a-surface-2:${brand.surface2}`,
    `--a-line:${brand.line}`,
    `--a-text:${brand.text}`,
    `--a-muted:${brand.muted}`,
    `--a-accent:${brand.accent}`,
    `--a-accent-hi:${brand.accentHi}`,
    `--a-danger:${brand.danger}`,
  ].join(';');
}
