import { NextRequest, NextResponse } from 'next/server';
import { detectDuplicates } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { title, description, projectId } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 });
    }

    // Pull existing bugs from DB for comparison
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;

    const existingBugs = await prisma.bugReport.findMany({
      where,
      select: { id: true, title: true, description: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    const result = await detectDuplicates({ title, description }, existingBugs);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Duplicate detection error:', error);
    return NextResponse.json({ error: 'Failed to detect duplicates' }, { status: 500 });
  }
}
