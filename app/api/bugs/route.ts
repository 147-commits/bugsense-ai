import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';
import { Severity, BugStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const severity = searchParams.get('severity') as Severity | null;
  const status = searchParams.get('status') as BugStatus | null;
  const search = searchParams.get('search');
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const order = searchParams.get('order') || 'desc';

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (severity) where.severity = severity;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const bugs = await prisma.bugReport.findMany({
    where,
    orderBy: { [sortBy]: order },
    include: { testCases: true },
  });

  return NextResponse.json({ bugs, total: bugs.length });
}
