'use client';

import { Suspense, useState, FormEvent, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import PasswordInput from '@/components/auth/PasswordInput';
import FormError from '@/components/auth/FormError';

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
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = useMemo(() => {
    if (!confirmTouched || confirm.length === 0) return false;
    return confirm !== password;
  }, [confirmTouched, confirm, password]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError({ message: 'Passwords do not match.' });
      return;
    }
    if (!token) {
      setError({ message: 'Missing reset token. Click the link in your email again.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; requestId?: string };
      if (!res.ok) {
        setError({
          message: reasonCopy(data.error),
          requestId: data.requestId ?? res.headers.get('x-request-id'),
        });
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login?reset=1'), 1200);
    } catch {
      setError({ message: 'Network error. Try again.' });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass-panel p-8 text-center" role="status" aria-live="polite">
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

      {error && <FormError message={error.message} requestId={error.requestId} />}

      <form onSubmit={handleSubmit} aria-busy={loading} className="flex flex-col gap-3">
        <PasswordInput
          id="password"
          label="New password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          disabled={loading}
          showStrength
        />
        <div>
          <PasswordInput
            id="confirm"
            label="Confirm password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            placeholder="Repeat new password"
            disabled={loading}
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? 'confirm-error' : undefined}
          />
          {mismatch && (
            <p id="confirm-error" role="alert" className="mt-1 text-[11px] text-severity-critical">
              Passwords do not match.
            </p>
          )}
        </div>
        <button type="submit" disabled={loading || mismatch} className="btn-primary w-full mt-1">
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
