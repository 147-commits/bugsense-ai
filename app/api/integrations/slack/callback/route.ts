import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { encryptToken } from '@/lib/crypto/tokens';
import { db } from '@/lib/database/db';
import { integrations } from '@/lib/database/schema';
import { exchangeCode, verifyState } from '@/lib/slack/oauth';
import { DEFAULT_SLACK_NOTIFICATIONS, parseSlackConfig, type SlackConfig } from '@/types/slack';
import { demoModeResponse } from '@/lib/validation';
import { logger } from '@/lib/observability/logger';

function back(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/settings', req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  if (!db) return demoModeResponse('Slack callback requires a configured database.');

  const errorParam = req.nextUrl.searchParams.get('error');
  if (errorParam) return back(req, { slack: 'error', reason: errorParam });

  const code = req.nextUrl.searchParams.get('code');
  const stateRaw = req.nextUrl.searchParams.get('state');
  if (!code || !stateRaw) {
    return NextResponse.json({ error: 'Missing code or state.' }, { status: 400 });
  }
  const state = verifyState(stateRaw);
  if (!state) {
    return NextResponse.json({ error: 'Invalid or expired OAuth state.' }, { status: 400 });
  }

  let resp;
  try {
    resp = await exchangeCode(code);
  } catch (err) {
    logger.error('slack callback exchange failed', err);
    return back(req, { slack: 'error', reason: 'exchange_failed' });
  }

  const webhook = resp.incoming_webhook;
  if (!webhook?.channel_id) {
    return back(req, { slack: 'error', reason: 'no_channel' });
  }

  const existing = await db.query.integrations.findFirst({
    where: and(eq(integrations.organizationId, state.orgId), eq(integrations.type, 'SLACK')),
  });
  const existingConfig = existing ? parseSlackConfig(existing.config) : null;

  const config: SlackConfig = {
    team_id: resp.team.id,
    team_name: resp.team.name,
    channel_id: webhook.channel_id,
    channel_name: webhook.channel,
    bot_user_id: resp.bot_user_id,
    app_id: resp.app_id,
    tokens: {
      accessTokenEnc: encryptToken(resp.access_token),
      scopes: resp.scope.split(','),
    },
    notifications: existingConfig?.notifications ?? DEFAULT_SLACK_NOTIFICATIONS,
  };

  if (existing) {
    await db
      .update(integrations)
      .set({
        config,
        isActive: true,
        name: `Slack — ${resp.team.name}`,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({
      organizationId: state.orgId,
      type: 'SLACK',
      name: `Slack — ${resp.team.name}`,
      config,
      isActive: true,
    });
  }

  return back(req, { slack: 'connected' });
}
