'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import FormError from '@/components/auth/FormError';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; requestId?: string };
      if (!res.ok) {
        setError({
          message: data.error ?? 'Could not start password reset. Try again.',
          requestId: data.requestId ?? res.headers.get('x-request-id'),
        });
      } else {
        setSent(true);
      }
    } catch {
      setError({ message: 'Network error. Try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">Forgot password</h1>
        <p className="mt-1 text-text-muted text-sm">We will email you a reset link if an account exists.</p>
      </div>

      {error && <FormError message={error.message} requestId={error.requestId} />}

      {sent ? (
        <div role="status" aria-live="polite" className="px-3 py-3 rounded-lg bg-accent-emerald/10 text-accent-emerald text-sm">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-busy={loading} className="flex flex-col gap-3">
          <div>
            <label htmlFor="email" className="text-text-secondary text-xs font-medium mb-1 block">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="input-field" disabled={loading} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Send reset link
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-text-muted text-xs">
        Remembered it?{' '}
        <Link href="/login" className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
