import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';

describe('crypto/tokens', () => {
  const originalKey = process.env.TOKEN_ENC_KEY;
  const originalFallback = process.env.JIRA_TOKEN_ENC_KEY;

  beforeAll(() => {
    // 32 bytes / 64 hex chars
    process.env.TOKEN_ENC_KEY = crypto.randomBytes(32).toString('hex');
    delete process.env.JIRA_TOKEN_ENC_KEY;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.TOKEN_ENC_KEY;
    else process.env.TOKEN_ENC_KEY = originalKey;
    if (originalFallback !== undefined) process.env.JIRA_TOKEN_ENC_KEY = originalFallback;
  });

  it('encrypts and decrypts round-trip', async () => {
    const mod = await import('@/lib/crypto/tokens');
    const plain = 'super-secret-refresh-token-xyz-12345';
    const enc = mod.encryptToken(plain);
    expect(enc).not.toContain(plain);
    expect(mod.decryptToken(enc)).toBe(plain);
  });

  it('produces a different ciphertext on each encrypt (random IV)', async () => {
    const mod = await import('@/lib/crypto/tokens');
    const plain = 'same-input-every-time';
    const a = mod.encryptToken(plain);
    const b = mod.encryptToken(plain);
    expect(a).not.toBe(b);
    expect(mod.decryptToken(a)).toBe(plain);
    expect(mod.decryptToken(b)).toBe(plain);
  });

  it('rejects a tampered ciphertext via the GCM auth tag', async () => {
    const mod = await import('@/lib/crypto/tokens');
    const enc = mod.encryptToken('original');
    const parts = enc.split('.');
    parts[2] = parts[2].slice(0, -2) + 'XX';
    const tampered = parts.join('.');
    expect(() => mod.decryptToken(tampered)).toThrow();
  });

  it('rejects a malformed token shape', async () => {
    const mod = await import('@/lib/crypto/tokens');
    expect(() => mod.decryptToken('not-three-parts')).toThrow(/Invalid encrypted token format/);
  });
});
