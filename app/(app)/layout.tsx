import { and, eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import AppShell from '@/components/layout/AppShell';
import QuotaBanner from '@/components/billing/QuotaBanner';
import UnverifiedEmailBanner from '@/components/onboarding/UnverifiedEmailBanner';
import { authOptions } from '@/lib/auth/authOptions';
import { currentMonthBucket } from '@/lib/billing/limits';
import { PLANS } from '@/lib/billing/plans';
import { db } from '@/lib/database/db';
import { monthlyUsageCounters, organizationMembers, users } from '@/lib/database/schema';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [banner, verify] = await Promise.all([getBannerState(), getVerifyState()]);
  return (
    <AppShell>
      {verify && <UnverifiedEmailBanner email={verify.email} />}
      {banner && <QuotaBanner limit={banner.limit} used={banner.used} />}
      {children}
    </AppShell>
  );
}

async function getVerifyState(): Promise<{ email: string } | null> {
  if (!db) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { email: true, emailVerified: true },
  });
  if (!user || user.emailVerified) return null;
  return { email: user.email };
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
