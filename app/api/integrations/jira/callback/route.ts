import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/database/db';
import { integrations } from '@/lib/database/schema';
import { exchangeCode, generateWebhookSecret, verifyState } from '@/lib/jira/oauth';
import { DEFAULT_JIRA_MAPPINGS, parseJiraConfig, type JiraConfig } from '@/types/jira';
import { demoModeResponse } from '@/lib/validation';

function redirect(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/settings', req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  if (!db) return demoModeResponse('Jira callback requires a configured database.');

  const errorParam = req.nextUrl.searchParams.get('error');
  if (errorParam) {
    return redirect(req, { jira: 'error', reason: errorParam });
  }

  const code = req.nextUrl.searchParams.get('code');
  const stateRaw = req.nextUrl.searchParams.get('state');
  if (!code || !stateRaw) {
    return NextResponse.json({ error: 'Missing code or state.' }, { status: 400 });
  }
  const state = verifyState(stateRaw);
  if (!state) {
    return NextResponse.json({ error: 'Invalid or expired OAuth state.' }, { status: 400 });
  }

  let exchange;
  try {
    exchange = await exchangeCode(code);
  } catch (err) {
    console.error('[jira/callback] token exchange failed:', err instanceof Error ? err.message : err);
    return redirect(req, { jira: 'error', reason: 'exchange_failed' });
  }
  const resource = exchange.resources[0];
  if (!resource) {
    return redirect(req, { jira: 'error', reason: 'no_accessible_resources' });
  }

  const existing = await db.query.integrations.findFirst({
    where: and(eq(integrations.organizationId, state.orgId), eq(integrations.type, 'JIRA')),
  });
  const existingConfig = existing ? parseJiraConfig(existing.config) : null;

  const config: JiraConfig = {
    cloudId: resource.id,
    siteUrl: resource.url,
    siteName: resource.name,
    tokens: exchange.tokens,
    webhookSecret: existingConfig?.webhookSecret ?? generateWebhookSecret(),
    mappings: existingConfig?.mappings ?? DEFAULT_JIRA_MAPPINGS,
  };

  if (existing) {
    await db
      .update(integrations)
      .set({
        config,
        isActive: true,
        name: `Atlassian — ${resource.name}`,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({
      organizationId: state.orgId,
      type: 'JIRA',
      name: `Atlassian — ${resource.name}`,
      config,
      isActive: true,
    });
  }

  return redirect(req, { jira: 'connected' });
}
