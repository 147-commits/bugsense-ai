import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { integrations, organizationMembers } from '@/lib/database/schema';
import { DEFAULT_SLACK_NOTIFICATIONS, parseSlackConfig, type SlackConfig } from '@/types/slack';
import { demoModeResponse, parseBody } from '@/lib/validation';
import { requireSameOrigin } from '@/lib/security/same-origin';

const NotificationsSchema = z.object({
  critical_bug: z.boolean(),
  readiness_flip: z.boolean(),
  test_failure: z.boolean(),
  daily_digest: z.boolean(),
});

export async function PUT(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!db) return demoModeResponse('Saving Slack notification settings requires a configured database.');

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, auth.user.id),
    orderBy: organizationMembers.joinedAt,
  });
  if (!membership) {
    return NextResponse.json({ error: 'No organization for this user.' }, { status: 404 });
  }
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only org owners/admins can edit notifications.' }, { status: 403 });
  }

  const parsed = await parseBody(req, NotificationsSchema);
  if (!parsed.ok) return parsed.response;

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.organizationId, membership.organizationId),
      eq(integrations.type, 'SLACK'),
    ),
  });
  if (!integration) {
    return NextResponse.json({ error: 'No Slack integration found.' }, { status: 404 });
  }
  const cfg = parseSlackConfig(integration.config);
  if (!cfg) return NextResponse.json({ error: 'Integration config invalid.' }, { status: 500 });

  const next: SlackConfig = {
    ...cfg,
    notifications: { ...DEFAULT_SLACK_NOTIFICATIONS, ...parsed.data },
  };
  await db
    .update(integrations)
    .set({ config: next, updatedAt: new Date() })
    .where(eq(integrations.id, integration.id));

  return NextResponse.json({ notifications: next.notifications });
}
