import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { integrations, organizationMembers } from '@/lib/database/schema';
import { demoModeResponse } from '@/lib/validation';
import { requireSameOrigin } from '@/lib/security/same-origin';

export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!db) return demoModeResponse('Disconnecting Jira requires a configured database.');

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, auth.user.id),
    orderBy: organizationMembers.joinedAt,
  });
  if (!membership) {
    return NextResponse.json({ error: 'No organization for this user.' }, { status: 404 });
  }
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only org owners/admins can disconnect integrations.' }, { status: 403 });
  }

  await db
    .update(integrations)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(integrations.organizationId, membership.organizationId), eq(integrations.type, 'JIRA')));

  return NextResponse.json({ disconnected: true });
}
