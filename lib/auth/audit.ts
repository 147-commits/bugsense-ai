import type { NextRequest } from 'next/server';
import { db } from '@/lib/database/db';
import { authEvents, type AuthEventKind } from '@/lib/database/schema';
import { logger } from '@/lib/observability/logger';

export interface RecordAuthEventInput {
  kind: AuthEventKind;
  userId?: string | null;
  /** Pass the route handler's NextRequest to capture IP + User-Agent. */
  req?: NextRequest | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Append an auth event to the audit log. Never throws: persistence failure
 * must not break the user-facing auth flow that triggered the write.
 *
 * Use the appropriate AuthEventKind for the action — SIGNIN_FAILED with
 * `userId: null` is fine and useful for tracking attacks on unknown emails.
 */
export async function recordAuthEvent({ kind, userId = null, req = null, metadata = null }: RecordAuthEventInput): Promise<void> {
  if (!db) return;
  try {
    await db.insert(authEvents).values({
      userId: userId ?? null,
      kind,
      ip: req ? extractIp(req) : null,
      userAgent: req ? truncate(req.headers.get('user-agent') ?? null, 500) : null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    logger.warn('failed to record auth event', { kind, userId }, err);
  }
}

function extractIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || req.ip || null;
  return truncate(ip, 60);
}

function truncate(s: string | null, n: number): string | null {
  if (s === null) return null;
  return s.length <= n ? s : s.slice(0, n);
}
