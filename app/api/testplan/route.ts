import { NextRequest, NextResponse } from 'next/server';
import { generateTestPlan } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { sprintInfo, options = {}, projectId } = body;
    if (!sprintInfo) return NextResponse.json({ error: 'sprintInfo is required' }, { status: 400 });

    const result = await generateTestPlan(sprintInfo, {
      sprintDuration: options.sprintDuration || 14,
      teamSize: options.teamSize || 2,
      includeRegression: options.includeRegression ?? true,
      riskLevel: options.riskLevel || 'medium',
    });

    if (projectId) {
      await prisma.generatedContent.create({
        data: { projectId, type: 'testplan', input: sprintInfo, output: result },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test plan error:', error);
    return NextResponse.json({ error: 'Failed to generate test plan' }, { status: 500 });
  }
}
