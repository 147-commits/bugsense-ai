import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateTestCasesFromStory } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { generatedContent } from '@/lib/database/schema';
import { parseBody } from '@/lib/validation';

const TestGenSchema = z.object({
  userStory: z.string().min(1).max(10_000),
  options: z
    .object({
      includeNegative: z.boolean().optional(),
      includeEdgeCases: z.boolean().optional(),
      includeSecurity: z.boolean().optional(),
      includePerformance: z.boolean().optional(),
      includeAccessibility: z.boolean().optional(),
      framework: z.string().min(1).max(60).optional(),
    })
    .optional()
    .default({}),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, TestGenSchema);
  if (!parsed.ok) return parsed.response;
  const { userStory, options, projectId } = parsed.data;

  try {
    const result = await generateTestCasesFromStory(userStory, {
      includeNegative: options.includeNegative ?? true,
      includeEdgeCases: options.includeEdgeCases ?? true,
      includeSecurity: options.includeSecurity ?? false,
      includePerformance: options.includePerformance ?? false,
      includeAccessibility: options.includeAccessibility ?? false,
      framework: options.framework || undefined,
    });

    if (projectId && db) {
      await db.insert(generatedContent).values({
        projectId,
        type: 'testgen',
        input: userStory,
        output: result as unknown as Record<string, unknown>,
        framework: options.framework || null,
      });
    }

    return NextResponse.json({ ...result, demoMode: !db && !!projectId });
  } catch (error) {
    console.error('Test gen error:', error);
    return NextResponse.json({ error: 'Failed to generate test cases' }, { status: 500 });
  }
}
