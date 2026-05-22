import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { organizationMembers } from '@/lib/database/schema';
import { buildInstallUrl, readOAuthEnv, signState } from '@/lib/slack/oauth';
import { demoModeResponse } from '@/lib/validation';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!db) return demoModeResponse('Connecting Slack requires a configured database.');
  if (!readOAuthEnv()) {
    return NextResponse.json(
      {
        error: 'Slack OAuth is not configured.',
        detail: 'Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI in the environment.',
      },
      { status: 503 },
    );
  }

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, auth.user.id),
    orderBy: organizationMembers.joinedAt,
  });
  if (!membership) {
    return NextResponse.json({ error: 'No organization for this user.' }, { status: 404 });
  }
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only org owners/admins can configure integrations.' }, { status: 403 });
  }

  const state = signState({ userId: auth.user.id, orgId: membership.organizationId });
  return NextResponse.redirect(buildInstallUrl(state));
}
