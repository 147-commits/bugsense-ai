import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { integrations, organizationMembers } from '@/lib/database/schema';
import { parseSlackConfig } from '@/types/slack';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!db) return NextResponse.json({ connected: false, demoMode: true });

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, auth.user.id),
    orderBy: organizationMembers.joinedAt,
  });
  if (!membership) return NextResponse.json({ connected: false });

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.organizationId, membership.organizationId),
      eq(integrations.type, 'SLACK'),
    ),
  });
  if (!integration || !integration.isActive) return NextResponse.json({ connected: false });
  const cfg = parseSlackConfig(integration.config);
  if (!cfg) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    teamName: cfg.team_name,
    channelName: cfg.channel_name,
    channelId: cfg.channel_id,
    notifications: cfg.notifications,
    role: membership.role,
  });
}
