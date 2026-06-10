import { sql } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/database/db';
import { rateLimitBuckets } from '@/lib/database/schema';
import { logger } from '@/lib/observability/logger';

const BUCKET_MS = 60_000;

/**
 * Sliding-window rate limit with one minute buckets, backed by Postgres
 * (RateLimitBucket).
 *
 * On each request we upsert `(key, currentMinute)` with `count = count + 1`
 * and reject when the post-increment count exceeds the limit. Older buckets
 * are pruned by the daily cron in `/api/cron/rate-limit-cleanup` so the
 * table stays small.
 *
 * Demo mode (db === null) short-circuits to "allowed" — same convention
 * as the rest of the codebase.
 */
export async function enforceRateLimit(opts: {
  key: string;
  limit: number;
}): Promise<NextResponse | null> {
  if (!db) return null;

  try {
    const bucket = currentMinuteBucket();
    const [row] = await db
      .insert(rateLimitBuckets)
      .values({ key: opts.key, windowStart: bucket, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
        set: { count: sql`${rateLimitBuckets.count} + 1` },
      })
      .returning({ count: rateLimitBuckets.count });

    const used = row?.count ?? 0;
    if (used > opts.limit) {
      return NextResponse.json(
        { error: 'rate_limit_exceeded', limit: opts.limit, used, retryAfter: 60 },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }
    return null;
  } catch (err) {
    // Fail open. The rate limiter is defence-in-depth; a missing table
    // (migration not applied), a connection blip, or any other Postgres
    // hiccup must not be allowed to break authentication. The incident
    // shows up in logs and Sentry instead.
    logger.warn('rate-limit check failed, allowing request', { key: opts.key, limit: opts.limit }, err);
    return null;
  }
}

export function ipKey(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || req.ip || 'unknown';
  return `ip:${ip}`;
}

export function workspaceKey(orgId: string): string {
  return `ws:${orgId}`;
}

function currentMinuteBucket(): Date {
  return new Date(Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS);
}
