import Link from 'next/link';
import RefreshSessionOnVerify from '@/components/auth/RefreshSessionOnVerify';

type Status = 'success' | 'invalid' | 'expired' | 'already' | 'demo' | 'sent' | 'unknown';

const COPY: Record<Status, { title: string; body: string; cta: { label: string; href: string } | null }> = {
  success: {
    title: 'Email verified',
    body: 'Your email has been verified. You can now use the full workspace.',
    cta: { label: 'Open dashboard', href: '/dashboard' },
  },
  already: {
    title: 'Already verified',
    body: 'This verification link was already used. If you can sign in, you are all set.',
    cta: { label: 'Sign in', href: '/login' },
  },
  expired: {
    title: 'Link expired',
    body: 'Verification links expire after 24 hours. Sign in and request a fresh link from your account settings.',
    cta: { label: 'Sign in', href: '/login' },
  },
  invalid: {
    title: 'Link invalid',
    body: 'We could not verify that link. It may have been mistyped or already used.',
    cta: { label: 'Back to sign in', href: '/login' },
  },
  demo: {
    title: 'Demo mode',
    body: 'Verification requires a configured database. Set DATABASE_URL and try again.',
    cta: null,
  },
  sent: {
    title: 'Check your email',
    body: 'We sent a verification link to your inbox. Click it to activate your account.',
    cta: { label: 'Back to sign in', href: '/login' },
  },
  unknown: {
    title: 'Verify your email',
    body: 'Open the link we emailed you to verify your account.',
    cta: { label: 'Back to sign in', href: '/login' },
  },
};

export default function VerifyEmailPage({ searchParams }: { searchParams: { status?: string } }) {
  const status: Status =
    searchParams.status === 'success' ||
    searchParams.status === 'invalid' ||
    searchParams.status === 'expired' ||
    searchParams.status === 'already' ||
    searchParams.status === 'demo' ||
    searchParams.status === 'sent'
      ? searchParams.status
      : 'unknown';

  const copy = COPY[status];

  return (
    <div className="glass-panel p-8 text-center">
      <h1 className="text-xl font-semibold text-text-primary mb-2">{copy.title}</h1>
      <p className="text-sm text-text-secondary mb-6">{copy.body}</p>
      {copy.cta && (
        <Link href={copy.cta.href} className="btn-primary inline-flex">
          {copy.cta.label}
        </Link>
      )}
      {status === 'success' && <RefreshSessionOnVerify />}
    </div>
  );
}
