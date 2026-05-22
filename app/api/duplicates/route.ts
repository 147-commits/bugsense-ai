import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { detectDuplicates } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { bugReports } from '@/lib/database/schema';
import { resolveOrganizationId } from '@/lib/billing/org-resolver';
import { withAiQuota } from '@/lib/billing/with-quota';
import { parseBody } from '@/lib/validation';

const DuplicatesSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(20_000),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, DuplicatesSchema);
  if (!parsed.ok) return parsed.response;
  const { title, description, projectId } = parsed.data;

  const orgId = await resolveOrganizationId({ userId: auth.user.id, projectId });
  return withAiQuota(orgId, async () => {
  try {
    let existingBugs: { id: string; title: string; description: string }[] = [];
    if (db) {
      existingBugs = await db.query.bugReports.findMany({
        where: projectId ? eq(bugReports.projectId, projectId) : undefined,
        columns: { id: true, title: true, description: true },
        orderBy: desc(bugReports.createdAt),
        limit: 50,
      });
    }

    const result = await detectDuplicates({ title, description }, existingBugs);

    return NextResponse.json({ ...result, demoMode: !db });
  } catch (error) {
    console.error('Duplicate detection error:', error);
    return NextResponse.json({ error: 'Failed to detect duplicates' }, { status: 500 });
  }
  });
}
