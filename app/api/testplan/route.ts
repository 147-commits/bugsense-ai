import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateTestPlan } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { generatedContent } from '@/lib/database/schema';
import { parseBody } from '@/lib/validation';

const TestPlanSchema = z.object({
  sprintInfo: z.string().min(1).max(10_000),
  options: z
    .object({
      sprintDuration: z.number().int().min(1).max(90).optional(),
      teamSize: z.number().int().min(1).max(50).optional(),
      includeRegression: z.boolean().optional(),
      riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional()
    .default({}),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, TestPlanSchema);
  if (!parsed.ok) return parsed.response;
  const { sprintInfo, options, projectId } = parsed.data;

  try {
    const result = await generateTestPlan(sprintInfo, {
      sprintDuration: options.sprintDuration ?? 14,
      teamSize: options.teamSize ?? 2,
      includeRegression: options.includeRegression ?? true,
      riskLevel: options.riskLevel ?? 'medium',
    });

    if (projectId && db) {
      await db.insert(generatedContent).values({
        projectId,
        type: 'testplan',
        input: sprintInfo,
        output: result as unknown as Record<string, unknown>,
      });
    }

    return NextResponse.json({ ...result, demoMode: !db && !!projectId });
  } catch (error) {
    console.error('Test plan error:', error);
    return NextResponse.json({ error: 'Failed to generate test plan' }, { status: 500 });
  }
}
