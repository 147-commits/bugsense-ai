import { NextRequest, NextResponse } from 'next/server';
import { expandCoverage } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { existingTests, expansionType = 'all', projectId } = body;
    if (!existingTests) return NextResponse.json({ error: 'existingTests is required' }, { status: 400 });

    const result = await expandCoverage(existingTests, expansionType);

    if (projectId) {
      await prisma.generatedContent.create({
        data: { projectId, type: 'coverage', input: existingTests, output: result as unknown as Parameters<typeof prisma.generatedContent.create>[0]['data']['output'] },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Coverage error:', error);
    return NextResponse.json({ error: 'Failed to expand coverage' }, { status: 500 });
  }
}
