import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { expandCoverage } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { generatedContent } from '@/lib/database/schema';
import { resolveOrganizationId } from '@/lib/billing/org-resolver';
import { withAiQuota } from '@/lib/billing/with-quota';
import { parseBody } from '@/lib/validation';
import { logger } from '@/lib/observability/logger';

const CoverageSchema = z.object({
  existingTests: z.string().min(1).max(200_000),
  expansionType: z
    .enum(['edge_cases', 'negative', 'security', 'performance', 'accessibility', 'all'])
    .optional()
    .default('all'),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, CoverageSchema);
  if (!parsed.ok) return parsed.response;
  const { existingTests, expansionType, projectId } = parsed.data;

  const orgId = await resolveOrganizationId({ userId: auth.user.id, projectId });
  return withAiQuota(orgId, async () => {
  try {
    const result = await expandCoverage(existingTests, expansionType);

    if (projectId && db) {
      await db.insert(generatedContent).values({
        projectId,
        type: 'coverage',
        input: existingTests,
        output: result as unknown as Record<string, unknown>,
      });
    }

    return NextResponse.json({ ...result, demoMode: !db && !!projectId });
  } catch (error) {
    logger.error('coverage expansion failed', error);
    return NextResponse.json({ error: 'Failed to expand coverage' }, { status: 500 });
  }
  });
}
