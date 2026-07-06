import { describe, it, expect } from 'vitest';
import { brandStyle } from '../../src/lib/admin-brand';
import type { ThemeBrand } from '../../src/themes/types';

const sample: ThemeBrand = {
  bg: '#0E0E10', surface: '#151419', surface2: '#1C1B22', line: '#2A2831',
  text: '#F5F3EF', muted: '#9A97A2', accent: '#6C4AA0', accentHi: '#9B78D6',
  danger: '#E5534B',
};

describe('brandStyle', () => {
  it('serializes every --a-* color token as an inline declaration', () => {
    const css = brandStyle(sample);
    expect(css).toContain('--a-bg:#0E0E10');
    expect(css).toContain('--a-surface:#151419');
    expect(css).toContain('--a-surface-2:#1C1B22');
    expect(css).toContain('--a-line:#2A2831');
    expect(css).toContain('--a-text:#F5F3EF');
    expect(css).toContain('--a-muted:#9A97A2');
    expect(css).toContain('--a-accent:#6C4AA0');
    expect(css).toContain('--a-accent-hi:#9B78D6');
    expect(css).toContain('--a-danger:#E5534B');
  });

  it('emits a semicolon-joined string with no :root wrapper (goes on the element)', () => {
    const css = brandStyle(sample);
    expect(css).not.toContain(':root');
    expect(css).not.toContain('{');
    expect(css.split(';').length).toBe(9);
  });

  it('leaves fonts and radius alone — those stay shared across every admin', () => {
    const css = brandStyle(sample);
    expect(css).not.toContain('--a-display');
    expect(css).not.toContain('--a-body');
    expect(css).not.toContain('--a-radius');
  });
});
