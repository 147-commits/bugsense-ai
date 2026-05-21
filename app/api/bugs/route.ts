import { NextRequest, NextResponse } from 'next/server';
import { eq, and, or, ilike, desc, asc, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { bugReports } from '@/lib/database/schema';
import { mockBugs } from '@/lib/utils/mockData';
import { parseQuery } from '@/lib/validation';

const QuerySchema = z.object({
  projectId: z.string().min(1).max(128).optional(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE']).optional(),
  search: z.string().max(200).optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'severity', 'priority', 'status', 'title', 'qualityScore'])
    .optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const SORT_COLUMNS = {
  createdAt: bugReports.createdAt,
  updatedAt: bugReports.updatedAt,
  severity: bugReports.severity,
  priority: bugReports.priority,
  status: bugReports.status,
  title: bugReports.title,
  qualityScore: bugReports.qualityScore,
} as const;

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = parseQuery(req, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const { projectId, severity, status, search, sortBy, order } = parsed.data;

  if (!db) {
    const lower = (s: string) => s.toLowerCase();
    let filtered = mockBugs.slice();
    if (severity) filtered = filtered.filter((b) => b.severity === severity);
    if (status) filtered = filtered.filter((b) => b.status === status);
    if (search) {
      const q = lower(search);
      filtered = filtered.filter(
        (b) => lower(b.title).includes(q) || lower(b.description).includes(q),
      );
    }
    return NextResponse.json({ bugs: filtered, total: filtered.length, demoMode: true });
  }

  const filters: SQL[] = [];
  if (projectId) filters.push(eq(bugReports.projectId, projectId));
  if (severity) filters.push(eq(bugReports.severity, severity));
  if (status) filters.push(eq(bugReports.status, status));
  if (search) {
    const like = `%${search}%`;
    const searchOr = or(ilike(bugReports.title, like), ilike(bugReports.description, like));
    if (searchOr) filters.push(searchOr);
  }

  const sortKey = sortBy ?? 'createdAt';
  const sortCol = SORT_COLUMNS[sortKey] ?? bugReports.createdAt;
  const orderBy = order === 'asc' ? asc(sortCol) : desc(sortCol);

  const bugs = await db.query.bugReports.findMany({
    where: filters.length ? and(...filters) : undefined,
    orderBy,
    with: { testCases: true },
  });

  return NextResponse.json({ bugs, total: bugs.length });
}
