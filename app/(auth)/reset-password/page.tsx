'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="glass-panel p-8 text-center text-text-muted text-sm">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('Missing reset token. Click the link in your email again.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(reasonCopy(data.error));
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login?reset=1'), 1200);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass-panel p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary mb-1">Password updated</h1>
        <p className="text-sm text-text-secondary">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">Reset password</h1>
        <p className="mt-1 text-text-muted text-sm">Choose a new password for your workspace.</p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-severity-critical/10 text-severity-critical text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="password" className="text-text-secondary text-xs font-medium mb-1 block">New password</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters"
            className="input-field" disabled={loading} />
        </div>
        <div>
          <label htmlFor="confirm" className="text-text-secondary text-xs font-medium mb-1 block">Confirm password</label>
          <input id="confirm" type="password" autoComplete="new-password" required minLength={8} value={confirm}
            onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password"
            className="input-field" disabled={loading} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Set new password
        </button>
      </form>
    </div>
  );
}

function reasonCopy(reason: string | undefined): string {
  if (reason === 'expired') return 'That reset link expired. Request a new one.';
  if (reason === 'already_used') return 'That reset link was already used.';
  if (reason === 'invalid') return 'That reset link is invalid.';
  return 'Could not reset password. Try again.';
}
