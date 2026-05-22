import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/database/db';
import {
  bugJiraLinks,
  bugReports,
  integrations,
  processedJiraEvents,
} from '@/lib/database/schema';
import { enforceRateLimit, ipKey } from '@/lib/security/rate-limit';
import { parseJiraConfig, type JiraStatusKey } from '@/types/jira';

type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DUPLICATE';

const PayloadSchema = z.object({
  timestamp: z.number().optional(),
  webhookEvent: z.string().optional(),
  issue: z
    .object({
      id: z.string(),
      key: z.string(),
      fields: z
        .object({
          status: z.object({ name: z.string() }).optional(),
        })
        .partial()
        .optional(),
    })
    .optional(),
});

type Ctx = { params: { token: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  const limited = await enforceRateLimit({ key: ipKey(req), limit: 100 });
  if (limited) return limited;

  if (!db) {
    // Webhook called before db is configured — accept silently so Jira
    // doesn't retry. Nothing to do.
    return NextResponse.json({ accepted: false, reason: 'no_db' });
  }

  // Look up by token: scan active JIRA integrations and find one whose
  // config.webhookSecret matches. There aren't enough rows in practice
  // to warrant indexing the secret.
  const all = await db.query.integrations.findMany({
    where: eq(integrations.type, 'JIRA'),
  });
  const match = all.find((row) => {
    const cfg = parseJiraConfig(row.config);
    return cfg?.webhookSecret === params.token && row.isActive;
  });
  if (!match) {
    return NextResponse.json({ error: 'Unknown webhook token.' }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body is not JSON.' }, { status: 400 });
  }
  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.', issues: parsed.error.issues }, { status: 400 });
  }
  const { timestamp, webhookEvent, issue } = parsed.data;

  if (!issue || !issue.fields?.status?.name) {
    return NextResponse.json({ accepted: true, ignored: 'no status change' });
  }

  const eventId = `${webhookEvent ?? 'event'}:${issue.id}:${timestamp ?? 0}`;
  const seen = await db.query.processedJiraEvents.findFirst({
    where: eq(processedJiraEvents.eventId, eventId),
  });
  if (seen) {
    return NextResponse.json({ accepted: true, idempotent: true });
  }

  const link = await db.query.bugJiraLinks.findFirst({
    where: eq(bugJiraLinks.jiraIssueKey, issue.key),
  });
  if (!link || link.integrationId !== match.id) {
    // Issue isn't tracked by us. Still record the event so Jira doesn't
    // re-send forever.
    await db.insert(processedJiraEvents).values({ eventId, integrationId: match.id }).onConflictDoNothing();
    return NextResponse.json({ accepted: true, ignored: 'untracked_issue' });
  }

  const cfg = parseJiraConfig(match.config);
  if (!cfg) {
    return NextResponse.json({ error: 'Integration config invalid.' }, { status: 500 });
  }

  const reverse = reverseStatusMap(cfg.mappings.status);
  const next = reverse.get(issue.fields.status.name.toLowerCase());
  if (next) {
    await db
      .update(bugReports)
      .set({ status: next, updatedAt: new Date() })
      .where(eq(bugReports.id, link.bugReportId));
    await db
      .update(bugJiraLinks)
      .set({ lastInboundAt: new Date() })
      .where(eq(bugJiraLinks.id, link.id));
  }

  await db.insert(processedJiraEvents).values({ eventId, integrationId: match.id }).onConflictDoNothing();

  return NextResponse.json({
    accepted: true,
    applied: next ? { status: next, bugId: link.bugReportId } : null,
  });
}

function reverseStatusMap(forward: Record<JiraStatusKey, string>): Map<string, BugStatus> {
  // Preference order resolves many-to-one collisions on the Jira side.
  const preferred: BugStatus[] = ['IN_PROGRESS', 'OPEN', 'RESOLVED', 'CLOSED', 'DUPLICATE'];
  const map = new Map<string, BugStatus>();
  for (const bs of preferred) {
    const jira = forward[bs];
    const key = jira?.toLowerCase();
    if (key && !map.has(key)) map.set(key, bs);
  }
  return map;
}
