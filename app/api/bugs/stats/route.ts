import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db, type DB } from '@/lib/database/db';
import { bugReports } from '@/lib/database/schema';
import { mockDashboardStats } from '@/lib/utils/mockData';
import { parseQuery } from '@/lib/validation';

const QuerySchema = z.object({
  projectId: z.string().min(1).max(128).optional(),
});

async function countWhere(dbConn: DB, extra?: SQL, base?: SQL) {
  const where = base && extra ? and(base, extra) : (extra ?? base);
  const [row] = await dbConn
    .select({ count: sql<number>`count(*)::int` })
    .from(bugReports)
    .where(where);
  return Number(row?.count ?? 0);
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = parseQuery(req, QuerySchema);
  if (!parsed.ok) return parsed.response;

  if (!db) {
    return NextResponse.json({ ...mockDashboardStats, demoMode: true });
  }

  const base = parsed.data.projectId ? eq(bugReports.projectId, parsed.data.projectId) : undefined;
  const dbConn = db;

  const [total, critical, high, medium, low, resolved, info, bugs, avgRow, trendRows, moduleRows] =
    await Promise.all([
      countWhere(dbConn, undefined, base),
      countWhere(dbConn, eq(bugReports.severity, 'CRITICAL'), base),
      countWhere(dbConn, eq(bugReports.severity, 'HIGH'), base),
      countWhere(dbConn, eq(bugReports.severity, 'MEDIUM'), base),
      countWhere(dbConn, eq(bugReports.severity, 'LOW'), base),
      countWhere(dbConn, eq(bugReports.status, 'RESOLVED'), base),
      countWhere(dbConn, eq(bugReports.severity, 'INFO'), base),
      dbConn.query.bugReports.findMany({
        where: base,
        orderBy: desc(bugReports.createdAt),
        limit: 10,
      }),
      dbConn
        .select({ avg: sql<number | null>`avg(${bugReports.qualityScore})` })
        .from(bugReports)
        .where(base)
        .then((r) => r[0]),
      // Trend: last 7 days. New bugs + resolved bugs per day.
      dbConn
        .select({
          date: sql<string>`to_char(date_trunc('day', ${bugReports.createdAt}), 'YYYY-MM-DD')`,
          bugs: sql<number>`count(*)::int`,
          resolved: sql<number>`sum(case when ${bugReports.status} = 'RESOLVED' then 1 else 0 end)::int`,
        })
        .from(bugReports)
        .where(
          and(
            sql`${bugReports.createdAt} >= now() - interval '7 days'`,
            base ?? sql`TRUE`,
          ),
        )
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

  return NextResponse.json({
    totalBugs: total,
    criticalBugs: critical,
    resolvedBugs: resolved,
    avgQualityScore: avgRow?.avg ? Number(avgRow.avg) : 0,
    severityDistribution: [
      { name: 'Critical', value: critical, color: '#ef4444' },
      { name: 'High', value: high, color: '#f97316' },
      { name: 'Medium', value: medium, color: '#eab308' },
      { name: 'Low', value: low, color: '#22c55e' },
      { name: 'Info', value: info, color: '#3b82f6' },
    ],
    recentBugs: bugs,
    trendData,
    topModules,
  });
}
