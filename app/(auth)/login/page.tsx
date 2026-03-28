'use client';

import { useState, FormEvent, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail, Lock, AlertCircle } from 'lucide-react';

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: 'Incorrect email or password.',
  Default: 'Something went wrong. Please try again.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="glass-panel-elevated gradient-border p-8 animate-in text-center text-text-muted">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const errorCode = params.get('error');
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    errorCode ? (AUTH_ERRORS[errorCode] ?? AUTH_ERRORS.Default) : null,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setFormError(AUTH_ERRORS.CredentialsSignin);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="glass-panel-elevated gradient-border p-8 animate-in">
      {/* Logo */}
      <div className="mb-8 text-center">
        <span className="text-gradient font-display text-3xl font-semibold tracking-tight">
          BugSense
        </span>
        <span className="ml-1.5 text-xs font-mono text-accent-blue/70 align-super">AI</span>
        <p className="mt-2 text-text-muted text-sm">Sign in to your workspace</p>
      </div>

      {/* Error banner */}
      {formError && (
        <div className="flex items-start gap-2.5 mb-5 px-4 py-3 rounded-xl
                        bg-severity-critical/10 border border-severity-critical/20 text-severity-critical text-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {formError}
        </div>
      )}

      {/* Credentials form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-text-secondary text-xs font-medium">
            Email
          </label>
          <div className="relative">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field pl-9"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-text-secondary text-xs font-medium">
            Password
          </label>
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field pl-9"
              disabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 mt-1"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : null}
          Sign in
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-text-muted text-xs">
        Don&apos;t have an account?{' '}
        <a href="/register" className="text-accent-blue hover:text-accent-blue/80 transition-colors">
          Get started free
        </a>
      </p>
    </div>
  );
}
