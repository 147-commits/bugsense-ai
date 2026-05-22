import { and, eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import BillingControls from '@/components/settings/BillingControls';
import { authOptions } from '@/lib/auth/authOptions';
import { db } from '@/lib/database/db';
import { monthlyUsageCounters, organizationMembers } from '@/lib/database/schema';
import { currentMonthBucket } from '@/lib/billing/limits';
import { PLANS } from '@/lib/billing/plans';

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/settings/billing');

  if (!db) {
    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto">
        <p className="text-sm text-text-secondary">
          Demo mode — billing requires a configured database.
        </p>
      </div>
    );
  }

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, session.user.id),
    orderBy: organizationMembers.joinedAt,
    with: { organization: true },
  });
  if (!membership) {
    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto">
        <p className="text-sm text-text-secondary">No workspace.</p>
      </div>
    );
  }
  const org = membership.organization;
  const plan = PLANS[org.planTier];
  const canManage = membership.role === 'OWNER' || membership.role === 'ADMIN';

  const counter = await db.query.monthlyUsageCounters.findFirst({
    where: and(
      eq(monthlyUsageCounters.organizationId, org.id),
      eq(monthlyUsageCounters.yearMonth, currentMonthBucket()),
    ),
    columns: { aiCalls: true },
  });
  const used = counter?.aiCalls ?? 0;
  const limit = plan.aiCallsPerMonth;

  return (
    <div className="min-h-screen">
      <TopBar title="Billing" subtitle="Workspace plan and AI usage" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="glass-panel p-6">
          <p className="text-xs text-text-muted mb-1">Current plan</p>
          <p className="text-2xl font-semibold text-text-primary">{plan.label}</p>
          <p className="text-xs text-text-muted mt-1">
            {plan.priceUsd === 'contact'
              ? 'Custom pricing — contact sales.'
              : plan.priceUsd === 0
                ? 'No payment required.'
                : `$${plan.priceUsd} per seat / month.`}
          </p>
        </div>

        <div className="glass-panel p-6 space-y-3">
          <p className="text-xs text-text-muted">AI usage this month</p>
          <p className="text-2xl font-mono text-text-primary">
            {used.toLocaleString()}
            <span className="text-base text-text-muted">
              {' '}/ {limit === null ? '∞' : limit.toLocaleString()}
            </span>
          </p>
          {limit !== null && (
            <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className="h-full bg-accent-emerald transition-all duration-300"
                style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
              />
            </div>
          )}
          {limit !== null && used >= limit && (
            <p className="text-xs text-severity-critical">
              You&apos;ve hit this month&apos;s limit. Upgrade for more headroom.
            </p>
          )}
        </div>

        <BillingControls
          tier={org.planTier}
          canManage={canManage}
          hasStripeCustomer={!!org.stripeCustomerId}
        />
      </div>
    </div>
  );
}
