import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const [generatedContent, bugReports] = await Promise.all([
    prisma.generatedContent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.bugReport.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        rawInput: true,
        severity: true,
        qualityScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  // Merge into a unified timeline
  const items = [
    ...generatedContent.map((gc) => ({
      id: gc.id,
      kind: 'generated' as const,
      type: gc.type,
      input: gc.input,
      output: gc.output,
      framework: gc.framework,
      language: gc.language,
      createdAt: gc.createdAt,
    })),
    ...bugReports.map((br) => ({
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
