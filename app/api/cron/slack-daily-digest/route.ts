import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/database/db';
import {
  bugReports,
  integrations,
  projects,
  releaseReadinessSnapshots,
} from '@/lib/database/schema';
import { tryNotifyDailyDigest } from '@/lib/slack/dispatcher';
import { parseSlackConfig } from '@/types/slack';
import type { DigestMessage } from '@/lib/slack/messages';

type Verdict = 'GO' | 'CAUTION' | 'NO_GO';

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!db) {
    return NextResponse.json({ ran: false, reason: 'no_db' });
  }

  const origin = req.nextUrl.origin;

  const slackRows = await db.query.integrations.findMany({
    where: eq(integrations.type, 'SLACK'),
  });

  const summary: Array<{ organizationId: string; delivered: boolean; reason?: string }> = [];

  for (const row of slackRows) {
    if (!row.isActive || !row.organizationId) {
      summary.push({ organizationId: row.organizationId ?? '(none)', delivered: false, reason: 'inactive' });
      continue;
    }
    const cfg = parseSlackConfig(row.config);
    if (!cfg || !cfg.notifications.daily_digest) {
      summary.push({ organizationId: row.organizationId, delivered: false, reason: 'disabled' });
      continue;
    }
    const digest = await computeDigest(row.organizationId, origin);
    const delivered = await tryNotifyDailyDigest(row.organizationId, digest);
    summary.push({ organizationId: row.organizationId, delivered });
  }

  return NextResponse.json({ ran: true, count: summary.length, summary });
}

async function computeDigest(organizationId: string, origin: string): Promise<DigestMessage> {
  const dbConn = db;
  if (!dbConn) {
    return { origin, openCriticalCount: 0, currentVerdict: 'UNKNOWN', newBugsLast24h: 0 };
  }

  const orgProjects = await dbConn.query.projects.findMany({
    where: eq(projects.organizationId, organizationId),
    columns: { id: true },
  });
  const projectIds = orgProjects.map((p) => p.id);
  if (projectIds.length === 0) {
    return { origin, openCriticalCount: 0, currentVerdict: 'UNKNOWN', newBugsLast24h: 0 };
  }

  const [openCriticalRows, newBugRows] = await Promise.all([
    dbConn
      .select({ count: sql<number>`count(*)::int` })
      .from(bugReports)
      .where(
        and(
          inArray(bugReports.projectId, projectIds),
          eq(bugReports.severity, 'CRITICAL'),
          inArray(bugReports.status, ['OPEN', 'IN_PROGRESS']),
        ),
      ),
    dbConn
      .select({ count: sql<number>`count(*)::int` })
      .from(bugReports)
      .where(
        and(
          inArray(bugReports.projectId, projectIds),
          gte(bugReports.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      ),
  ]);

  const openCriticalCount = Number(openCriticalRows[0]?.count ?? 0);
  const newBugsLast24h = Number(newBugRows[0]?.count ?? 0);

  const latest = await Promise.all(
    projectIds.map((pid) =>
      dbConn.query.releaseReadinessSnapshots.findFirst({
        where: eq(releaseReadinessSnapshots.projectId, pid),
        orderBy: desc(releaseReadinessSnapshots.createdAt),
        columns: { verdict: true },
      }),
    ),
  );
  const verdicts: Verdict[] = latest
    .map((s) => s?.verdict)
    .filter((v): v is Verdict => v === 'GO' || v === 'CAUTION' || v === 'NO_GO');

  let currentVerdict: DigestMessage['currentVerdict'] = 'UNKNOWN';
  if (verdicts.includes('NO_GO')) currentVerdict = 'NO_GO';
  else if (verdicts.includes('CAUTION')) currentVerdict = 'CAUTION';
  else if (verdicts.includes('GO')) currentVerdict = 'GO';

  return { origin, openCriticalCount, currentVerdict, newBugsLast24h };
}
