'use client';

import { useState, FormEvent, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const AUTH_ERRORS: Record<string, string> = {
  CredentialsSignin: 'Incorrect email or password.',
  Default: 'Something went wrong. Please try again.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="glass-panel p-8 text-center text-text-muted text-sm">Loading...</div>}>
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
    const result = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false });
    setLoading(false);
    if (result?.error) { setFormError(AUTH_ERRORS.CredentialsSignin); return; }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="glass-panel p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">BugSense AI</h1>
        <p className="mt-1 text-text-muted text-sm">Sign in to your workspace</p>
      </div>

      {formError && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-severity-critical/10 text-severity-critical text-sm">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="email" className="text-text-secondary text-xs font-medium mb-1 block">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            className="input-field" disabled={loading} />
        </div>
        <div>
          <label htmlFor="password" className="text-text-secondary text-xs font-medium mb-1 block">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            className="input-field" disabled={loading} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Sign in
        </button>
      </form>

      <p className="mt-5 text-center text-text-muted text-xs">
        Don&apos;t have an account?{' '}
        <a href="/register" className="text-accent hover:underline">Get started free</a>
      </p>
    </div>
  );
}
