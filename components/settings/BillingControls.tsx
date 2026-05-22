'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CreditCard, ExternalLink } from 'lucide-react';
import type { PlanTier } from '@/lib/billing/plans';

interface Props {
  tier: PlanTier;
  canManage: boolean;
  hasStripeCustomer: boolean;
}

export default function BillingControls({ tier, canManage, hasStripeCustomer }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? `Portal failed (${res.status})`);
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  };

  const showPortal = hasStripeCustomer && canManage;
  const showUpgrade = tier === 'FREE';

  return (
    <div className="glass-panel p-6 space-y-3">
      {showPortal && (
        <button
          onClick={openPortal}
          disabled={busy}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <CreditCard className="w-4 h-4" />
          {busy ? 'Opening…' : 'Manage subscription'}
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
      {showUpgrade && (
        <Link href="/pricing" className="btn-secondary inline-flex items-center gap-2">
          See plans
        </Link>
      )}
      {!canManage && (
        <p className="text-xs text-text-muted">
          Only workspace owners and admins can change the plan.
        </p>
      )}
      {error && (
        <p className="text-xs text-severity-critical">{error}</p>
      )}
    </div>
  );
}
