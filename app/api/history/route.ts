import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { bugReports, generatedContent } from '@/lib/database/schema';
import { parseQuery } from '@/lib/validation';

const QuerySchema = z.object({
  projectId: z.string().min(1).max(128),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = parseQuery(req, QuerySchema);
  if (!parsed.ok) return parsed.response;

  if (!db) {
    return NextResponse.json({ items: [], demoMode: true });
  }

  const { projectId } = parsed.data;
  const [gcRows, bugs] = await Promise.all([
    db.query.generatedContent.findMany({
      where: eq(generatedContent.projectId, projectId),
      orderBy: desc(generatedContent.createdAt),
      limit: 100,
    }),
    db.query.bugReports.findMany({
      where: eq(bugReports.projectId, projectId),
      columns: {
        id: true,
        title: true,
        rawInput: true,
        severity: true,
        qualityScore: true,
        createdAt: true,
      },
      orderBy: desc(bugReports.createdAt),
      limit: 100,
    }),
  ]);

  const items = [
    ...gcRows.map((gc) => ({
      id: gc.id,
      kind: 'generated' as const,
      type: gc.type,
      input: gc.input,
      output: gc.output,
      framework: gc.framework,
      language: gc.language,
      createdAt: gc.createdAt,
    })),
    ...bugs.map((br) => ({
      id: br.id,
      kind: 'bug' as const,
      type: 'analyze',
      input: br.rawInput,
      output: { title: br.title, severity: br.severity, qualityScore: br.qualityScore },
      framework: null,
      language: null,
      createdAt: br.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ items });
}
