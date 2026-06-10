'use client';

import { useEffect, useState, FormEvent, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import PasswordInput from '@/components/auth/PasswordInput';
import FormError from '@/components/auth/FormError';

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: 'Incorrect email or password.',
  Default: 'Something went wrong. Please try again.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="glass-panel p-8 text-center text-text-muted text-sm">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const errorCode = params.get('error');
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
  const signedUpEmail = params.get('signedUp');
  const showVerifyRequest = params.get('verifyRequest') === '1';
  const passwordReset = params.get('reset') === '1';

  const [email, setEmail] = useState(signedUpEmail ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'form' | 'magic' | 'google' | null>(null);
  const [formError, setFormError] = useState<string | null>(
    errorCode ? (AUTH_ERRORS[errorCode] ?? AUTH_ERRORS.Default) : null,
  );
  const [magicSent, setMagicSent] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);

  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHasGoogle(!!data && typeof data === 'object' && 'google' in data))
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading('form');
    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    setLoading(null);
    if (result?.error) {
      setFormError(AUTH_ERRORS.CredentialsSignin);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  async function magicLink() {
    if (!email) {
      setFormError('Enter your email first to use the magic link.');
      return;
    }
    setFormError(null);
    setLoading('magic');
    const result = await signIn('email', {
      email: email.trim().toLowerCase(),
      redirect: false,
      callbackUrl,
    });
    setLoading(null);
    if (result?.error) {
      setFormError('Could not send the magic link. Try again.');
      return;
    }
    setMagicSent(true);
  }

  return (
    <div className="glass-panel p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">Welcome back</h1>
        <p className="mt-1 text-text-muted text-sm">Sign in to your BugSense workspace.</p>
      </div>

      {signedUpEmail && !formError && (
        <div role="status" aria-live="polite" className="mb-4 px-3 py-2.5 rounded-lg bg-accent-emerald/10 text-accent-emerald text-sm">
          Account created. We sent a verification link to {signedUpEmail}.
        </div>
      )}

      {showVerifyRequest && (
        <div role="status" aria-live="polite" className="mb-4 px-3 py-2.5 rounded-lg bg-accent-emerald/10 text-accent-emerald text-sm">
          Check your email for a sign-in link. If you do not have email configured locally, the link is printed to the server console.
        </div>
      )}

      {passwordReset && (
        <div role="status" aria-live="polite" className="mb-4 px-3 py-2.5 rounded-lg bg-accent-emerald/10 text-accent-emerald text-sm">
          Password updated. Sign in with your new password.
        </div>
      )}

      {formError && <FormError message={formError} />}

      {magicSent ? (
        <div role="status" aria-live="polite" className="px-3 py-3 rounded-lg bg-accent-emerald/10 text-accent-emerald text-sm">
          Check your inbox for a sign-in link.
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-busy={loading !== null} className="flex flex-col gap-3">
          <div>
            <label htmlFor="email" className="text-text-secondary text-xs font-medium mb-1 block">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="input-field" disabled={loading !== null} />
          </div>
          <PasswordInput
            id="password"
            label="Password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading !== null}
          />
          <button type="submit" disabled={loading !== null} className="btn-primary w-full mt-1">
            {loading === 'form' ? <Loader2 size={14} className="animate-spin" /> : null}
            Sign in
          </button>
          <Link href="/forgot-password" className="text-center text-xs text-text-muted hover:text-text-secondary">
            Forgot password?
          </Link>
        </form>
      )}

      {!magicSent && (
        <>
          <div className="my-5 flex items-center gap-3 text-text-muted text-[11px] uppercase tracking-wide">
            <div className="flex-1 h-px bg-border" />
            or
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={magicLink}
              disabled={loading !== null}
              className="btn-secondary w-full"
            >
              {loading === 'magic' ? <Loader2 size={14} className="animate-spin" /> : null}
              Email me a sign-in link
            </button>
            {hasGoogle && (
              <button
                type="button"
                onClick={() => {
                  setLoading('google');
                  signIn('google', { callbackUrl });
                }}
                disabled={loading !== null}
                className="btn-secondary w-full"
              >
                {loading === 'google' ? <Loader2 size={14} className="animate-spin" /> : null}
                Continue with Google
              </button>
            )}
          </div>
        </>
      )}

      <p className="mt-5 text-center text-text-muted text-xs">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-accent hover:underline">Get started free</Link>
      </p>
    </div>
  );
}
