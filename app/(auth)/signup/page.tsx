'use client';

import { useEffect, useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'form' | 'magic' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setLoading('form');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not create account. Try again.');
        setLoading(null);
        return;
      }
      router.push(`/login?signedUp=${encodeURIComponent(email)}`);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(null);
    }
  }

  async function magicLink() {
    if (!email) {
      setError('Enter your email first to use the magic link.');
      return;
    }
    setError(null);
    setLoading('magic');
    const result = await signIn('email', {
      email: email.trim().toLowerCase(),
      redirect: false,
      callbackUrl: '/dashboard',
    });
    setLoading(null);
    if (result?.error) {
      setError('Could not send the magic link. Try again.');
      return;
    }
    setMagicSent(true);
  }

  return (
    <div className="glass-panel p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">BugSense AI</h1>
        <p className="mt-1 text-text-muted text-sm">Create your workspace</p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-severity-critical/10 text-severity-critical text-sm">
          {error}
        </div>
      )}

      {magicSent ? (
        <div className="px-3 py-3 rounded-lg bg-accent-emerald/10 text-accent-emerald text-sm">
          Check your inbox for a sign-in link. (If you don&apos;t have email configured locally, the link is printed to the server console.)
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="name" className="text-text-secondary text-xs font-medium mb-1 block">Name</label>
            <input id="name" type="text" autoComplete="name" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Jane Smith"
              className="input-field" disabled={loading !== null} />
          </div>
          <div>
            <label htmlFor="email" className="text-text-secondary text-xs font-medium mb-1 block">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="input-field" disabled={loading !== null} />
          </div>
          <div>
            <label htmlFor="password" className="text-text-secondary text-xs font-medium mb-1 block">Password</label>
            <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters"
              className="input-field" disabled={loading !== null} />
          </div>
          <button type="submit" disabled={loading !== null} className="btn-primary w-full mt-1">
            {loading === 'form' ? <Loader2 size={14} className="animate-spin" /> : null}
            Create account
          </button>
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
                  signIn('google', { callbackUrl: '/dashboard' });
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
        Already have an account?{' '}
        <a href="/login" className="text-accent hover:underline">Sign in</a>
      </p>
    </div>
  );
}
