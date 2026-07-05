/** Value to render for a placeholder-capable field: em dash when flagged-and-empty. */
export function phValue(value: string, placeholder?: boolean): string {
  return placeholder && value.trim() === '' ? '—' : value;
}
