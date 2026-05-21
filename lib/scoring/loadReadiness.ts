import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { db, type DB } from '@/lib/database/db';
import { bugReports } from '@/lib/database/schema';
import { computeReadinessScore } from './releaseReadiness';
import type { ReadinessInput, ReadinessResult, SeverityCounts } from '@/types/readiness';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DUPLICATE';

const OPEN_STATUSES: BugStatus[] = ['OPEN', 'IN_PROGRESS'];
const RECENT_SCORED_LIMIT = 30;
const CRITICAL_BLOCKER_LIMIT = 50;

const SEVERITY_KEY: Record<Severity, keyof SeverityCounts> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
};

const EMPTY_INPUT: ReadinessInput = {
  openBugs: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  criticalBugDetails: [],
  testPassRate: null,
  avgQualityScore: null,
};

export async function loadReadinessInput(projectId: string): Promise<ReadinessInput> {
  if (!db) return EMPTY_INPUT;
  return loadFromDb(db, projectId);
}

async function loadFromDb(dbConn: DB, projectId: string): Promise<ReadinessInput> {
  const [countsRows, critical, recentScored] = await Promise.all([
    dbConn
      .select({ severity: bugReports.severity, count: sql<number>`count(*)::int` })
      .from(bugReports)
      .where(and(eq(bugReports.projectId, projectId), inArray(bugReports.status, OPEN_STATUSES)))
      .groupBy(bugReports.severity),
    dbConn.query.bugReports.findMany({
      where: and(
        eq(bugReports.projectId, projectId),
        eq(bugReports.severity, 'CRITICAL'),
        inArray(bugReports.status, OPEN_STATUSES),
      ),
      columns: { id: true, title: true },
      orderBy: desc(bugReports.createdAt),
      limit: CRITICAL_BLOCKER_LIMIT,
    }),
    dbConn.query.bugReports.findMany({
      where: and(eq(bugReports.projectId, projectId), sql`${bugReports.qualityScore} IS NOT NULL`),
      columns: { qualityScore: true },
      orderBy: desc(bugReports.createdAt),
      limit: RECENT_SCORED_LIMIT,
    }),
  ]);

  const openBugs: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const row of countsRows) {
    const key = SEVERITY_KEY[row.severity as Severity];
    if (key) openBugs[key] = Number(row.count);
  }

  const validScores = recentScored
    .map((r) => r.qualityScore)
    .filter((s): s is number => typeof s === 'number');
  const avgQualityScore =
    validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null;

  return {
    openBugs,
    criticalBugDetails: critical.map((b) => ({ id: b.id, title: b.title })),
    testPassRate: null,
    avgQualityScore,
  };
}

export async function computeProjectReadiness(projectId: string): Promise<ReadinessResult> {
  const input = await loadReadinessInput(projectId);
  return computeReadinessScore(input);
}
