import { describe, it, expect } from 'vitest';
import { phValue } from '../../src/lib/display';

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
