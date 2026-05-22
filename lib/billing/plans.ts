export type PlanTier = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';

export type BinaryFeature = 'jira_integration' | 'slack_integration' | 'mcp_server';

export interface PlanDefinition {
  tier: PlanTier;
  label: string;
  /** USD per seat per month. `'contact'` indicates "contact sales". */
  priceUsd: number | 'contact';
  /** Monthly AI-call quota. `null` means unlimited. */
  aiCallsPerMonth: number | null;
  features: Record<BinaryFeature, boolean>;
  cta: { label: string; href: string };
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  FREE: {
    tier: 'FREE',
    label: 'Free',
    priceUsd: 0,
    aiCallsPerMonth: 100,
    features: {
      jira_integration: false,
      slack_integration: false,
      mcp_server: false,
    },
    cta: { label: 'Start free', href: '/signup' },
  },
  PRO: {
    tier: 'PRO',
    label: 'Pro',
    priceUsd: 19,
    aiCallsPerMonth: 1000,
    features: {
      jira_integration: true,
      slack_integration: true,
      mcp_server: true,
    },
    cta: { label: 'Start Pro', href: '/api/billing/checkout?plan=PRO' },
  },
  TEAM: {
    tier: 'TEAM',
    label: 'Team',
    priceUsd: 49,
    aiCallsPerMonth: 5000,
    features: {
      jira_integration: true,
      slack_integration: true,
      mcp_server: true,
    },
    cta: { label: 'Start Team', href: '/api/billing/checkout?plan=TEAM' },
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    label: 'Enterprise',
    priceUsd: 'contact',
    aiCallsPerMonth: null,
    features: {
      jira_integration: true,
      slack_integration: true,
      mcp_server: true,
    },
    cta: { label: 'Contact sales', href: 'mailto:sales@bugsense.local?subject=Enterprise%20plan' },
  },
};

export function planFor(tier: PlanTier): PlanDefinition {
  return PLANS[tier];
}

/** Stripe Price ID lookup. PRO and TEAM only; FREE/ENTERPRISE are out-of-band. */
export function priceIdFor(tier: 'PRO' | 'TEAM'): string | null {
  if (tier === 'PRO') return process.env.STRIPE_PRICE_PRO ?? null;
  return process.env.STRIPE_PRICE_TEAM ?? null;
}

/** Inverse: map a Stripe price ID back onto our PlanTier. */
export function tierForPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO';
  if (priceId === process.env.STRIPE_PRICE_TEAM) return 'TEAM';
  return null;
}
