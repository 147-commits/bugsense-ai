import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/database/db';
import { monthlyUsageCounters, organizations } from '@/lib/database/schema';
import { isBillingEnabled } from './client';
import { PLANS, type BinaryFeature, type PlanTier } from './plans';

export interface AiCallCheck {
  allowed: boolean;
  used: number;
  /** `null` indicates an unlimited plan (Enterprise). */
  limit: number | null;
}

/** UTC YYYY-MM bucket for the monthly usage counter. */
export function currentMonthBucket(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function planForOrg(orgId: string): Promise<PlanTier | null> {
  if (!db) return null;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { planTier: true },
  });
  return org?.planTier ?? null;
}

/**
 * Server-side feature gate. Returns true in dev when STRIPE_SECRET_KEY is
 * missing (per spec) — billing is treated as universally available so local
 * development isn't blocked behind a Stripe account.
 */
export async function hasFeature(orgId: string, feature: BinaryFeature): Promise<boolean> {
  if (!isBillingEnabled()) return true;
  if (!db) return true;
  const tier = await planForOrg(orgId);
  if (!tier) return false;
  return PLANS[tier].features[feature];
}

export async function checkAiCallAllowed(orgId: string): Promise<AiCallCheck> {
  if (!isBillingEnabled() || !db) return { allowed: true, used: 0, limit: null };
  const tier = await planForOrg(orgId);
  if (!tier) return { allowed: true, used: 0, limit: null };
  const limit = PLANS[tier].aiCallsPerMonth;
  // Enterprise (null) = unlimited.
  if (limit === null) return { allowed: true, used: 0, limit: null };

  const counter = await db.query.monthlyUsageCounters.findFirst({
    where: and(
      eq(monthlyUsageCounters.organizationId, orgId),
      eq(monthlyUsageCounters.yearMonth, currentMonthBucket()),
    ),
    columns: { aiCalls: true },
  });
  const used = counter?.aiCalls ?? 0;
  return { allowed: used < limit, used, limit };
}

/**
 * Increment the monthly counter for an org. Idempotent at the row level via
 * onConflictDoUpdate. Safe to call after a failed AI request too; the spec
 * counts attempts against the quota, not just successful generations.
 */
export async function recordAiCall(orgId: string): Promise<void> {
  if (!isBillingEnabled() || !db) return;
  const bucket = currentMonthBucket();
  await db
    .insert(monthlyUsageCounters)
    .values({ organizationId: orgId, yearMonth: bucket, aiCalls: 1 })
    .onConflictDoUpdate({
      target: [monthlyUsageCounters.organizationId, monthlyUsageCounters.yearMonth],
      set: {
        aiCalls: sql`${monthlyUsageCounters.aiCalls} + 1`,
        updatedAt: new Date(),
      },
    });
}
