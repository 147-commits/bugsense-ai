import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type'); // optional filter

  const projectId = params.id;

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { _count: { select: { bugReports: true, members: true } } },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const gcWhere: Record<string, unknown> = { projectId };
  if (type && type !== 'all' && type !== 'bugs') {
    // "documents" is a virtual tab grouping multiple types
    if (type === 'documents') {
      gcWhere.type = { in: ['testplan', 'releasenotes', 'qadocs'] };
    } else {
      gcWhere.type = type;
    }
  }

  const [generatedContent, bugReports] = await Promise.all([
    // Skip GC query if only bugs requested
    type === 'bugs'
      ? Promise.resolve([])
      : prisma.generatedContent.findMany({
          where: gcWhere,
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
    // Skip bugs query if a specific GC type requested
    type && type !== 'all' && type !== 'bugs'
      ? Promise.resolve([])
      : prisma.bugReport.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: { testCases: { take: 5 } },
        }),
  ]);

  return NextResponse.json({
    project,
    generatedContent,
    bugReports,
  });
}
