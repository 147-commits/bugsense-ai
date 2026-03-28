'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AIDisclaimer({ type = 'standard' }: { type?: 'standard' | 'code' | 'severity' }) {
  const messages = {
    standard: 'AI-generated content. Review and verify before using in production.',
    code: 'AI-generated code. Test thoroughly in a safe environment before deploying. May contain syntax errors or logic issues.',
    severity: 'Severity and priority are AI estimates based on the description provided. Verify with your team before triaging.',
  };

  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-amber/5 border border-accent-amber/15">
      <Info className="w-3.5 h-3.5 text-accent-amber flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-accent-amber/80 leading-relaxed">{messages[type]}</p>
    </div>
  );
}

export function ConfidenceBadge({ score }: { score: number }) {
  const label = score >= 0.8 ? 'High' : score >= 0.6 ? 'Medium' : 'Low';
  const color = score >= 0.8 ? 'text-accent-emerald bg-accent-emerald/10 border-accent-emerald/20' :
    score >= 0.6 ? 'text-accent-amber bg-accent-amber/10 border-accent-amber/20' :
    'text-accent-coral bg-accent-coral/10 border-accent-coral/20';

  return (
    <span className={cn('badge text-[10px]', color)}>
      {Math.round(score * 100)}% confidence — {label}
    </span>
  );
}
