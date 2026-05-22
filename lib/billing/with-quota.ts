import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { withAiContext } from '@/lib/ai/context';
import { AiQuotaExceededError } from '@/lib/ai/runner';
import { db } from '@/lib/database/db';
import { organizations } from '@/lib/database/schema';
import { setSentryContext } from '@/lib/observability/sentry';

/**
 * Wrap a route handler body so any AI runner call inside it is gated
 * against the workspace's monthly quota and counted against it. The
 * 402 response shape matches the spec: limit_reached, limit, used,
 * upgradeUrl.
 *
 * When organizationId is null (no DB, no membership) the body runs
 * unchanged — gating is intentionally optional for self-hosted /
 * single-user installs without billing wired up.
 */
export async function withAiQuota(
  organizationId: string | null,
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  if (!organizationId) return fn();

  // Sentry context for any event captured inside this request.
  if (db) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { planTier: true },
    });
    setSentryContext({ workspaceId: organizationId, plan: org?.planTier });
  } else {
    setSentryContext({ workspaceId: organizationId });
  }

  try {
    return await withAiContext({ organizationId }, fn);
  } catch (err) {
    if (err instanceof AiQuotaExceededError) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          limit: err.limit,
          used: err.used,
          upgradeUrl: '/pricing',
        },
        { status: 402 },
      );
    }
    throw err;
  }
}
