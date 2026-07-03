import { describe, it, expect } from 'vitest';
import { parseLoginBody } from '../../src/lib/auth-input';

describe('parseLoginBody', () => {
  it('accepts a well-formed body', () => {
    expect(parseLoginBody({ email: 'a@b.com', password: 'secret12' }))
      .toEqual({ email: 'a@b.com', password: 'secret12' });
  });

  it('rejects a missing/blank email', () => {
    expect(parseLoginBody({ email: '', password: 'secret12' })).toHaveProperty('error');
    expect(parseLoginBody({ password: 'secret12' })).toHaveProperty('error');
  });

  it('rejects a missing password', () => {
    expect(parseLoginBody({ email: 'a@b.com' })).toHaveProperty('error');
  });

  it('rejects a non-object body', () => {
    expect(parseLoginBody(null)).toHaveProperty('error');
    expect(parseLoginBody('nope')).toHaveProperty('error');
  });
});
