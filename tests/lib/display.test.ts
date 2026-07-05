import { describe, it, expect } from 'vitest';
import { phValue, assetUrl } from '../../src/lib/display';

describe('phValue', () => {
  it('shows a dash for an empty placeholder field', () => {
    expect(phValue('', true)).toBe('—');
    expect(phValue('   ', true)).toBe('—');
  });
  it('shows the value when present, even if flagged placeholder', () => {
    expect(phValue('4.44', true)).toBe('4.44');
  });
  it('passes non-placeholder values through untouched', () => {
    expect(phValue('', false)).toBe('');
    expect(phValue('4.0', undefined)).toBe('4.0');
  });
});

describe('assetUrl', () => {
  it('leaves an absolute https URL untouched (no // collapsing)', () => {
    expect(assetUrl('https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png', '/'))
      .toBe('https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png');
  });
  it('leaves an absolute http URL untouched', () => {
    expect(assetUrl('http://a.espncdn.com/x.png', '/')).toBe('http://a.espncdn.com/x.png');
  });
  it('joins a relative path with the base without doubling slashes', () => {
    expect(assetUrl('images/logos/rmu.svg', '/')).toBe('/images/logos/rmu.svg');
    expect(assetUrl('/images/logos/rmu.svg', '/')).toBe('/images/logos/rmu.svg');
  });
  it('joins under a non-root base', () => {
    expect(assetUrl('images/x.png', '/site/')).toBe('/site/images/x.png');
  });
});
