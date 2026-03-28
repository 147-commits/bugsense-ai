import { NextRequest, NextResponse } from 'next/server';
import { generateTestCasesFromStory } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { userStory, options = {}, projectId } = body;
    if (!userStory) return NextResponse.json({ error: 'userStory is required' }, { status: 400 });

    const result = await generateTestCasesFromStory(userStory, {
      includeNegative: options.includeNegative ?? true,
      includeEdgeCases: options.includeEdgeCases ?? true,
      includeSecurity: options.includeSecurity ?? false,
      includePerformance: options.includePerformance ?? false,
      includeAccessibility: options.includeAccessibility ?? false,
      framework: options.framework || undefined,
    });

    if (projectId) {
      await prisma.generatedContent.create({
        data: { projectId, type: 'testgen', input: userStory, output: result as unknown as Parameters<typeof prisma.generatedContent.create>[0]['data']['output'], framework: options.framework || null },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test gen error:', error);
    return NextResponse.json({ error: 'Failed to generate test cases' }, { status: 500 });
  }
}
