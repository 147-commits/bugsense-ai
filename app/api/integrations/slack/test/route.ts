import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { organizationMembers } from '@/lib/database/schema';
import { sendTestMessage } from '@/lib/slack/dispatcher';
import { demoModeResponse } from '@/lib/validation';
import { requireSameOrigin } from '@/lib/security/same-origin';

export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!db) return demoModeResponse('Sending a test message requires a configured database.');

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, auth.user.id),
    orderBy: organizationMembers.joinedAt,
  });
  if (!membership) {
    return NextResponse.json({ error: 'No organization for this user.' }, { status: 404 });
  }
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only org owners/admins can send test messages.' }, { status: 403 });
  }

  const result = await sendTestMessage(membership.organizationId);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Failed to send test message.', detail: result.reason ?? null },
      { status: 502 },
    );
  }
  return NextResponse.json({ sent: true });
}
