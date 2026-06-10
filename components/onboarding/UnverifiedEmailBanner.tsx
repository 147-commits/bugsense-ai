'use client';

import { useEffect, useState } from 'react';
import { MailCheck, X, Loader2 } from 'lucide-react';

interface Props {
  email: string;
}

const DISMISS_KEY = 'bs.onboarding.unverified-dismissed';

/**
 * Persistent reminder when the signed-in user has not verified their email.
 *
 * The middleware already gates protected paths for unverified users — this
 * banner is the soft nudge on pages the user IS allowed to reach (settings,
 * dashboard once they've bypassed). Dismissal is per-session via
 * sessionStorage so closing the browser brings it back; we never want the
 * user to forget they're in an unverified state.
 */
export default function UnverifiedEmailBanner({ email }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  function dismiss() {
    setDismissed(true);
    try { window.sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      if (res.ok) {
        setResent(true);
        setTimeout(() => setResent(false), 5000);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not resend verification email.');
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setResending(false);
    }
  }

  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-severity-medium/30 bg-severity-medium/5"
    >
      <div className="max-w-[1200px] mx-auto px-6 py-2.5 flex items-center gap-3 text-sm text-text-primary">
        <MailCheck className="w-4 h-4 text-severity-medium flex-shrink-0" />
        <span className="flex-1 min-w-0 truncate">
          {resent ? (
            <>Verification email sent. Check your inbox.</>
          ) : error ? (
            <span className="text-severity-critical">{error}</span>
          ) : (
            <>
              Verify your email{' '}
              <span className="text-text-muted">({email})</span>
              {' '}to unlock the full workspace.
            </>
          )}
        </span>
        <button
          type="button"
          onClick={resend}
          disabled={resending || resent}
          className="text-xs font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded inline-flex items-center gap-1.5"
        >
          {resending && <Loader2 className="w-3 h-3 animate-spin" />}
          {resent ? 'Sent' : 'Resend email'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
