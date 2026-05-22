'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut, Mail } from 'lucide-react';

interface Props {
  isVerified: boolean;
}

export default function AccountControls({ isVerified }: Props) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function resend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; emailLogged?: boolean };
      if (!res.ok) {
        setResult({ ok: false, message: 'Could not send. Try again.' });
        return;
      }
      setResult({
        ok: true,
        message: data.emailLogged
          ? 'Email server is not configured locally — the verification URL was logged to the server console.'
          : 'Verification email sent. Check your inbox.',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="glass-panel p-6 space-y-3">
      {!isVerified && (
        <button onClick={resend} disabled={sending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
          <Mail className="w-4 h-4" />
          {sending ? 'Sending…' : 'Send verification email'}
        </button>
      )}
      {result && (
        <p className={`text-xs ${result.ok ? 'text-accent-emerald' : 'text-severity-critical'}`}>{result.message}</p>
      )}
      <a href="/forgot-password" className="block text-xs text-text-muted hover:text-text-secondary">
        Change password
      </a>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="btn-secondary inline-flex items-center gap-2 mt-2"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
}
