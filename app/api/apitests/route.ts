import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAPITests } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { generatedContent } from '@/lib/database/schema';
import { resolveOrganizationId } from '@/lib/billing/org-resolver';
import { withAiQuota } from '@/lib/billing/with-quota';
import { parseBody } from '@/lib/validation';
import { logger } from '@/lib/observability/logger';

const ApiTestsSchema = z.object({
  apiDescription: z.string().min(1).max(20_000),
  format: z
    .enum(['postman', 'curl', 'playwright', 'cypress', 'jest', 'supertest'])
    .optional()
    .default('playwright'),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, ApiTestsSchema);
  if (!parsed.ok) return parsed.response;
  const { apiDescription, format, projectId } = parsed.data;

  const orgId = await resolveOrganizationId({ userId: auth.user.id, projectId });
  return withAiQuota(orgId, async () => {
  try {
    const result = await generateAPITests(apiDescription, format);

    if (projectId && db) {
      await db.insert(generatedContent).values({
        projectId,
        type: 'apitests',
        input: apiDescription,
        output: result as unknown as Record<string, unknown>,
        framework: format,
      });
    }

    return NextResponse.json({ ...result, demoMode: !db && !!projectId });
  } catch (error) {
    logger.error('api-tests generation failed', error);
    return NextResponse.json({ error: 'Failed to generate API tests' }, { status: 500 });
  }
  });
}
