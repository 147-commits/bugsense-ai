import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { integrations, organizationMembers } from '@/lib/database/schema';
import { DEFAULT_JIRA_MAPPINGS, parseJiraConfig, type JiraConfig } from '@/types/jira';
import { demoModeResponse, parseBody } from '@/lib/validation';

const StatusKeySchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE']);
const PriorityKeySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

const MappingsSchema = z.object({
  status: z.record(StatusKeySchema, z.string().min(1).max(80)),
  priority: z.record(PriorityKeySchema, z.string().min(1).max(80)),
  issueTypeName: z.string().min(1).max(80),
  projectKey: z.string().min(1).max(40).regex(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Project key must be uppercase letters/digits/underscore.',
  }).nullable(),
});

async function loadIntegration(userId: string) {
  if (!db) return { kind: 'no-db' as const };
  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, userId),
    orderBy: organizationMembers.joinedAt,
  });
  if (!membership) return { kind: 'no-org' as const };
  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.organizationId, membership.organizationId), eq(integrations.type, 'JIRA')),
  });
  return { kind: 'ok' as const, membership, integration };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const ctx = await loadIntegration(auth.user.id);
  if (ctx.kind === 'no-db') return demoModeResponse('Jira mappings require a configured database.');
  if (ctx.kind === 'no-org') return NextResponse.json({ connected: false });
  if (!ctx.integration || !ctx.integration.isActive) return NextResponse.json({ connected: false });
  const cfg = parseJiraConfig(ctx.integration.config);
  if (!cfg) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    mappings: cfg.mappings,
    defaults: DEFAULT_JIRA_MAPPINGS,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const ctx = await loadIntegration(auth.user.id);
  if (ctx.kind === 'no-db') return demoModeResponse('Saving Jira mappings requires a configured database.');
  if (ctx.kind === 'no-org' || !ctx.integration) {
    return NextResponse.json({ error: 'No Jira integration found.' }, { status: 404 });
  }
  if (ctx.membership.role !== 'OWNER' && ctx.membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only org owners/admins can edit mappings.' }, { status: 403 });
  }
  const parsed = await parseBody(req, MappingsSchema);
  if (!parsed.ok) return parsed.response;

  const cfg = parseJiraConfig(ctx.integration.config);
  if (!cfg) return NextResponse.json({ error: 'Integration config invalid.' }, { status: 500 });

  if (!db) return demoModeResponse('Saving Jira mappings requires a configured database.');

  const next: JiraConfig = {
    ...cfg,
    mappings: {
      status: { ...DEFAULT_JIRA_MAPPINGS.status, ...parsed.data.status },
      priority: { ...DEFAULT_JIRA_MAPPINGS.priority, ...parsed.data.priority },
      issueTypeName: parsed.data.issueTypeName,
      projectKey: parsed.data.projectKey,
    },
  };
  await db
    .update(integrations)
    .set({ config: next, updatedAt: new Date() })
    .where(eq(integrations.id, ctx.integration.id));

  return NextResponse.json({ mappings: next.mappings });
}
