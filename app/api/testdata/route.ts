import { NextRequest, NextResponse } from 'next/server';
import { generateTestData } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { scenario, options = {}, projectId } = body;
    if (!scenario) return NextResponse.json({ error: 'scenario is required' }, { status: 400 });

    const result = await generateTestData(scenario, {
      count: options.count || 10,
      format: options.format || 'json',
      includeEdgeCases: options.includeEdgeCases ?? true,
      locale: options.locale || 'en-US',
    });

    if (projectId) {
      await prisma.generatedContent.create({
        data: { projectId, type: 'testdata', input: scenario, output: result },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test data error:', error);
    return NextResponse.json({ error: 'Failed to generate test data' }, { status: 500 });
  }
}
