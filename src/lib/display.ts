/** Value to render for a placeholder-capable field: em dash when flagged-and-empty. */
export function phValue(value: string, placeholder?: boolean): string {
  return placeholder && value.trim() === '' ? '—' : value;
}

/**
 * Resolve an asset reference to a usable src. Absolute http(s) URLs pass
 * through untouched; repo-relative paths are joined under the site base.
 * (Naive `${base}/${p}` joins collapse the `//` in `https://` — never do that.)
 */
export function assetUrl(path: string, base: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}/${path}`.replace(/\/{2,}/g, '/');
}
