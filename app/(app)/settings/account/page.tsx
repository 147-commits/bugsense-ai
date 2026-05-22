import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import AccountControls from '@/components/settings/AccountControls';
import { authOptions } from '@/lib/auth/authOptions';
import { db } from '@/lib/database/db';
import { users } from '@/lib/database/schema';

type SearchParams = { verifyRequired?: string };

export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login?callbackUrl=/settings/account');

  let name: string | null = null;
  let email = session.user.email;
  let emailVerified: Date | null = null;

  if (db) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { name: true, email: true, emailVerified: true },
    });
    if (user) {
      name = user.name;
      email = user.email;
      emailVerified = user.emailVerified;
    }
  }

  const gated = searchParams.verifyRequired === '1' && !emailVerified;

  return (
    <div className="min-h-screen">
      <TopBar title="Account" subtitle="Your workspace identity and email verification" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {gated && (
          <div className="glass-panel p-4 border border-severity-medium/30 bg-severity-medium/5 text-sm text-text-primary">
            Verify your email to unlock the rest of the workspace. We sent a link when you signed up — request a fresh one below if you don&apos;t have it.
          </div>
        )}

        <div className="glass-panel p-6 space-y-4">
          <div>
            <p className="text-xs text-text-muted mb-1">Name</p>
            <p className="text-sm text-text-primary">{name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">Email</p>
            <div className="flex items-center gap-2">
              <p className="text-sm text-text-primary">{email}</p>
              {emailVerified ? (
                <span className="badge bg-accent-emerald/10 text-accent-emerald text-[10px]">verified</span>
              ) : (
                <span className="badge bg-severity-medium/10 text-severity-medium text-[10px]">unverified</span>
              )}
            </div>
          </div>
        </div>

        <AccountControls isVerified={!!emailVerified} />
      </div>
    </div>
  );
}
