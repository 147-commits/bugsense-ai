'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      // Auto sign-in after registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Account created but could not sign in. Please go to login.');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel p-8">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">BugSense AI</h1>
        <p className="mt-1 text-text-muted text-sm">Create your account</p>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-severity-critical/10 text-severity-critical text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="name" className="text-text-secondary text-xs font-medium mb-1 block">Name</label>
          <input id="name" type="text" autoComplete="name" value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Jane Smith"
            className="input-field" disabled={loading} />
        </div>
        <div>
          <label htmlFor="email" className="text-text-secondary text-xs font-medium mb-1 block">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
            className="input-field" disabled={loading} />
        </div>
        <div>
          <label htmlFor="password" className="text-text-secondary text-xs font-medium mb-1 block">Password</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters"
            className="input-field" disabled={loading} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Create account
        </button>
      </form>

      <p className="mt-5 text-center text-text-muted text-xs">
        Already have an account?{' '}
        <a href="/login" className="text-accent hover:underline">Sign in</a>
      </p>
    </div>
  );
}
