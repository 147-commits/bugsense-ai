import crypto from 'crypto';
import { logger } from '@/lib/observability/logger';

const PRIMARY = process.env.TOKEN_ENC_KEY;
const FALLBACK = process.env.JIRA_TOKEN_ENC_KEY;

// Refuse to start when both names are set to different values — that almost
// certainly means a half-finished rename and one of them is wrong.
if (PRIMARY && FALLBACK && PRIMARY !== FALLBACK) {
  throw new Error(
    '[crypto] TOKEN_ENC_KEY and JIRA_TOKEN_ENC_KEY are both set to different values. ' +
      'Remove one. JIRA_TOKEN_ENC_KEY is a deprecated alias for TOKEN_ENC_KEY.',
  );
}

// Single deprecation warning at module load time when only the legacy name
// is set. Module-level boolean keeps this idempotent across re-imports.
let fallbackWarned = false;
if (!PRIMARY && FALLBACK && !fallbackWarned) {
  fallbackWarned = true;
  logger.warn('JIRA_TOKEN_ENC_KEY is deprecated, rename to TOKEN_ENC_KEY. Falling back for now.');
}

function getEncKey(): Buffer {
  const raw = PRIMARY ?? FALLBACK;
  if (!raw) throw new Error('TOKEN_ENC_KEY is required to encrypt secrets at rest');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('TOKEN_ENC_KEY must be 32 bytes (64 hex chars or base64-encoded)');
  }
  return buf;
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ct.toString('base64url')}`;
}

export function decryptToken(enc: string): string {
  const parts = enc.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivB, tagB, ctB] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncKey(), Buffer.from(ivB, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64url')), decipher.final()]).toString('utf8');
}
