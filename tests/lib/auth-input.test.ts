import { describe, it, expect } from 'vitest';
import { parseLoginBody, parseNewPassword } from '../../src/lib/auth-input';

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

describe('parseNewPassword', () => {
  it('accepts matching passwords of 8+ chars', () => {
    expect(parseNewPassword({ password: 'secret12', confirm: 'secret12' }))
      .toEqual({ password: 'secret12' });
  });
  it('rejects a password under 8 chars', () => {
    expect(parseNewPassword({ password: 'short1', confirm: 'short1' })).toHaveProperty('error');
  });
  it('rejects a mismatch', () => {
    expect(parseNewPassword({ password: 'secret12', confirm: 'secret13' })).toHaveProperty('error');
  });
  it('rejects a missing field or non-object body', () => {
    expect(parseNewPassword({ password: 'secret12' })).toHaveProperty('error');
    expect(parseNewPassword(null)).toHaveProperty('error');
  });
});
