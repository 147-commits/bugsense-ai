'use client';

import { useState, FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) {
        setError('Could not start password reset. Try again.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Network error. Try again.');
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

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-severity-critical/10 text-severity-critical text-sm">
          {error}
        </div>
      )}

      {sent ? (
        <div className="px-3 py-3 rounded-lg bg-accent-emerald/10 text-accent-emerald text-sm">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
        <a href="/login" className="text-accent hover:underline">Back to sign in</a>
      </p>
    </div>
  );
}
