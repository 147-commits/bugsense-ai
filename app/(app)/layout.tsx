import { and, eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import AppShell from '@/components/layout/AppShell';
import QuotaBanner from '@/components/billing/QuotaBanner';
import { authOptions } from '@/lib/auth/authOptions';
import { currentMonthBucket } from '@/lib/billing/limits';
import { PLANS } from '@/lib/billing/plans';
import { db } from '@/lib/database/db';
import { monthlyUsageCounters, organizationMembers } from '@/lib/database/schema';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const banner = await getBannerState();
  return (
    <AppShell>
      {banner && <QuotaBanner limit={banner.limit} used={banner.used} />}
      {children}
    </AppShell>
  );
}

async function getBannerState(): Promise<{ limit: number; used: number } | null> {
  if (!db) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, session.user.id),
    orderBy: organizationMembers.joinedAt,
    with: { organization: true },
  });
  if (!membership) return null;

  const plan = PLANS[membership.organization.planTier];
  if (plan.aiCallsPerMonth === null) return null;

  const counter = await db.query.monthlyUsageCounters.findFirst({
    where: and(
      eq(monthlyUsageCounters.organizationId, membership.organizationId),
      eq(monthlyUsageCounters.yearMonth, currentMonthBucket()),
    ),
    columns: { aiCalls: true },
  });
  const used = counter?.aiCalls ?? 0;
  if (used < plan.aiCallsPerMonth) return null;
  return { limit: plan.aiCallsPerMonth, used };
}
