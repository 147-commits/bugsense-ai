import Link from 'next/link';
import { AlertOctagon } from 'lucide-react';

interface Props {
  limit: number;
  used: number;
}

/**
 * Non-dismissable upgrade banner. Rendered above the app shell when the
 * workspace has hit its monthly AI-call quota. Server component — the state
 * comes from the surrounding layout, so the banner shows on the first paint
 * (before the user attempts any AI action).
 */
export default function QuotaBanner({ limit, used }: Props) {
  return (
    <div className="bg-severity-critical/10 border-b border-severity-critical/30 px-6 py-3 flex items-center gap-3">
      <AlertOctagon className="w-4 h-4 text-severity-critical flex-shrink-0" />
      <p className="text-sm text-text-primary flex-1">
        You&apos;ve used {used.toLocaleString()} of {limit.toLocaleString()} monthly AI calls.
        Further AI requests are blocked until your workspace upgrades.
      </p>
      <Link
        href="/pricing"
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-severity-critical text-white hover:opacity-90"
      >
        Upgrade plan
      </Link>
    </div>
  );
}
