import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { bugReports } from '@/lib/database/schema';
import { mockDashboardStats } from '@/lib/utils/mockData';
import { parseQuery } from '@/lib/validation';

const QuerySchema = z.object({
  projectId: z.string().min(1).max(128).optional(),
});

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = parseQuery(req, QuerySchema);
  if (!parsed.ok) return parsed.response;

  if (!db) {
    return jsonWithCache({ ...mockDashboardStats, demoMode: true });
  }

  const base = parsed.data.projectId ? eq(bugReports.projectId, parsed.data.projectId) : undefined;
  const dbConn = db;

  const [aggregate, bugs, trendRows, moduleRows] = await Promise.all([
    // One aggregate scan replaces what used to be eight separate count/avg queries.
    dbConn
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${bugReports.severity} = 'CRITICAL')::int`,
        high: sql<number>`count(*) filter (where ${bugReports.severity} = 'HIGH')::int`,
        medium: sql<number>`count(*) filter (where ${bugReports.severity} = 'MEDIUM')::int`,
        low: sql<number>`count(*) filter (where ${bugReports.severity} = 'LOW')::int`,
        info: sql<number>`count(*) filter (where ${bugReports.severity} = 'INFO')::int`,
        resolved: sql<number>`count(*) filter (where ${bugReports.status} = 'RESOLVED')::int`,
        avgQuality: sql<number | null>`avg(${bugReports.qualityScore})`,
      })
      .from(bugReports)
      .where(base)
      .then((r) => r[0]),
    dbConn.query.bugReports.findMany({
      where: base,
      orderBy: desc(bugReports.createdAt),
      limit: 10,
    }),
    // Trend: last 7 days, new bugs + resolved per day.
    dbConn
      .select({
        date: sql<string>`to_char(date_trunc('day', ${bugReports.createdAt}), 'YYYY-MM-DD')`,
        bugs: sql<number>`count(*)::int`,
        resolved: sql<number>`sum(case when ${bugReports.status} = 'RESOLVED' then 1 else 0 end)::int`,
      })
      .from(bugReports)
      .where(and(sql`${bugReports.createdAt} >= now() - interval '7 days'`, base ?? sql`TRUE`))
      .groupBy(sql`date_trunc('day', ${bugReports.createdAt})`)
      .orderBy(sql`date_trunc('day', ${bugReports.createdAt}) ASC`),
    // Top modules: explode affectedModules array and count.
    dbConn
      .select({
        module: sql<string>`unnest(${bugReports.affectedModules})`,
        count: sql<number>`count(*)::int`,
      })
      .from(bugReports)
      .where(base)
      .groupBy(sql`1`)
      .orderBy(sql`2 DESC`)
      .limit(8),
  ]);

  const trendData = trendRows.map((row) => {
    const d = new Date(`${row.date}T00:00:00Z`);
    return {
      date: DAY_LABELS[d.getUTCDay()] ?? row.date,
      bugs: Number(row.bugs),
      resolved: Number(row.resolved),
    };
  });

  const topModules = moduleRows
    .filter((r) => r.module)
    .map((r) => ({ module: r.module, count: Number(r.count) }));

  return jsonWithCache({
    totalBugs: aggregate?.total ?? 0,
    criticalBugs: aggregate?.critical ?? 0,
    resolvedBugs: aggregate?.resolved ?? 0,
    avgQualityScore: aggregate?.avgQuality ? Number(aggregate.avgQuality) : 0,
    severityDistribution: [
      { name: 'Critical', value: aggregate?.critical ?? 0, color: '#ef4444' },
      { name: 'High', value: aggregate?.high ?? 0, color: '#f97316' },
      { name: 'Medium', value: aggregate?.medium ?? 0, color: '#eab308' },
      { name: 'Low', value: aggregate?.low ?? 0, color: '#22c55e' },
      { name: 'Info', value: aggregate?.info ?? 0, color: '#3b82f6' },
    ],
    recentBugs: bugs,
    trendData,
    topModules,
  });
}

/**
 * Stats are per-user-and-project and don't change second-to-second. A short
 * private cache window absorbs the burst of identical requests when the user
 * opens multiple tabs or the dashboard re-renders, without making stale data
 * visible across users (private) or across more than a single bug-create
 * round-trip (10s).
 */
function jsonWithCache(payload: unknown): NextResponse {
  const res = NextResponse.json(payload);
  res.headers.set('Cache-Control', 'private, max-age=10');
  return res;
}
