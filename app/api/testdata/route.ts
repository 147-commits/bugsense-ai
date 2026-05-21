import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateTestData } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { generatedContent } from '@/lib/database/schema';
import { parseBody } from '@/lib/validation';

const TestDataSchema = z.object({
  scenario: z.string().min(1).max(10_000),
  options: z
    .object({
      count: z.number().int().min(1).max(1000).optional(),
      format: z.enum(['json', 'csv', 'sql', 'typescript']).optional(),
      includeEdgeCases: z.boolean().optional(),
      locale: z.string().min(2).max(10).optional(),
    })
    .optional()
    .default({}),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, TestDataSchema);
  if (!parsed.ok) return parsed.response;
  const { scenario, options, projectId } = parsed.data;

  try {
    const result = await generateTestData(scenario, {
      count: options.count ?? 10,
      format: options.format ?? 'json',
      includeEdgeCases: options.includeEdgeCases ?? true,
      locale: options.locale ?? 'en-US',
    });

    if (projectId && db) {
      await db.insert(generatedContent).values({
        projectId,
        type: 'testdata',
        input: scenario,
        output: result as unknown as Record<string, unknown>,
      });
    }

    return NextResponse.json({ ...result, demoMode: !db && !!projectId });
  } catch (error) {
    console.error('Test data error:', error);
    return NextResponse.json({ error: 'Failed to generate test data' }, { status: 500 });
  }
}
