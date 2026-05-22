import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { PLANS, type BinaryFeature, type PlanDefinition } from '@/lib/billing/plans';

const ORDER: PlanDefinition['tier'][] = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'];

const FEATURE_LABELS: Record<BinaryFeature, string> = {
  jira_integration: 'Jira two-way sync',
  slack_integration: 'Slack notifications',
  mcp_server: 'MCP server access',
};

function priceCopy(plan: PlanDefinition): { primary: string; suffix: string } {
  if (plan.priceUsd === 'contact') return { primary: 'Custom', suffix: 'Contact sales' };
  if (plan.priceUsd === 0) return { primary: '$0', suffix: 'forever' };
  return { primary: `$${plan.priceUsd}`, suffix: 'per seat / month' };
}

function quotaCopy(plan: PlanDefinition): string {
  if (plan.aiCallsPerMonth === null) return 'Unlimited AI calls';
  return `${plan.aiCallsPerMonth.toLocaleString()} AI calls / month`;
}

export default function PricingPage() {
  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-text-primary mb-2">Pricing</h1>
          <p className="text-sm text-text-secondary">
            Per-seat, billed monthly. Cancel any time from the workspace billing settings.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ORDER.map((tier) => {
            const plan = PLANS[tier];
            const price = priceCopy(plan);
            return (
              <div
                key={plan.tier}
                className="glass-panel p-6 flex flex-col"
                data-plan={plan.tier}
              >
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wide text-text-muted">{plan.label}</p>
                  <p className="text-3xl font-semibold text-text-primary mt-1">{price.primary}</p>
                  <p className="text-xs text-text-muted mt-1">{price.suffix}</p>
                </div>

                <p className="text-sm text-text-primary mb-4">{quotaCopy(plan)}</p>

                <ul className="space-y-2 mb-6 text-sm flex-1">
                  {(Object.keys(FEATURE_LABELS) as BinaryFeature[]).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      {plan.features[f] ? (
                        <Check className="w-4 h-4 text-accent-emerald flex-shrink-0" />
                      ) : (
                        <Minus className="w-4 h-4 text-text-muted flex-shrink-0" />
                      )}
                      <span className={plan.features[f] ? 'text-text-primary' : 'text-text-muted'}>
                        {FEATURE_LABELS[f]}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.cta.href} className="btn-primary w-full justify-center">
                  {plan.cta.label}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-text-muted mt-10">
          Already have a workspace?{' '}
          <Link href="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
