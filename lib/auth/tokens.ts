import crypto from 'crypto';

/** Generate a 256-bit URL-safe token suitable for one-time email links. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** Hash a raw token with SHA-256 for storage. Hashes are 64 hex chars. */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Constant-time comparison of a raw token against a stored hash. */
export function tokenMatches(raw: string, storedHash: string): boolean {
  const computed = hashToken(raw);
  if (computed.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
}
