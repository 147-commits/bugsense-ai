import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { decryptToken } from '@/lib/crypto/tokens';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { integrations, organizationMembers } from '@/lib/database/schema';
import { revokeToken } from '@/lib/slack/oauth';
import { parseSlackConfig, type SlackConfig } from '@/types/slack';
import { demoModeResponse } from '@/lib/validation';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!db) return demoModeResponse('Disconnecting Slack requires a configured database.');

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

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.organizationId, membership.organizationId),
      eq(integrations.type, 'SLACK'),
    ),
  });
  if (!integration) {
    return NextResponse.json({ disconnected: true, alreadyGone: true });
  }

  const cfg = parseSlackConfig(integration.config);
  let revoked = false;
  let revokeError: string | null = null;
  if (cfg?.tokens?.accessTokenEnc) {
    try {
      const accessToken = decryptToken(cfg.tokens.accessTokenEnc);
      const result = await revokeToken(accessToken);
      revoked = result.ok;
      if (!result.ok) revokeError = result.error ?? 'unknown';
    } catch (err) {
      revokeError = err instanceof Error ? err.message : String(err);
      console.warn('[slack/disconnect] revoke failed:', revokeError);
    }
  }

  // Always clear credentials locally, even if Slack's revoke call failed.
  const cleared: SlackConfig | null = cfg
    ? { ...cfg, tokens: null }
    : null;

  await db
    .update(integrations)
    .set({
      isActive: false,
      config: cleared ?? integration.config,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id));

  return NextResponse.json({ disconnected: true, revoked, revokeError });
}
