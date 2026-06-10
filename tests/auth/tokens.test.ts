import { describe, it, expect } from 'vitest';
import { generateToken, hashToken, tokenMatches } from '@/lib/auth/tokens';

describe('auth/tokens', () => {
  it('generateToken returns a base64url string of expected length (~43 chars for 32 bytes)', () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t.length).toBeLessThanOrEqual(48);
  });

  it('generateToken returns a fresh value on each call', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it('hashToken returns 64 hex chars (SHA-256)', () => {
    const h = hashToken('whatever');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashToken is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });

  it('tokenMatches accepts the right raw, rejects the wrong one', () => {
    const raw = generateToken();
    const stored = hashToken(raw);
    expect(tokenMatches(raw, stored)).toBe(true);
    expect(tokenMatches(raw + 'x', stored)).toBe(false);
  });

  it('tokenMatches returns false on length mismatch instead of throwing', () => {
    expect(tokenMatches('whatever', 'short')).toBe(false);
  });
});
