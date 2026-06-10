import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateQADocumentation } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { generatedContent } from '@/lib/database/schema';
import { resolveOrganizationId } from '@/lib/billing/org-resolver';
import { withAiQuota } from '@/lib/billing/with-quota';
import { parseBody } from '@/lib/validation';
import { logger } from '@/lib/observability/logger';

const QADocsSchema = z.object({
  input: z.string().min(1).max(50_000),
  docType: z
    .enum([
      'test_strategy',
      'test_summary',
      'traceability_matrix',
      'test_closure',
      'defect_report',
      'test_environment',
      'qa_checklist',
      'test_execution_report',
      'uat_signoff',
      'risk_assessment',
    ])
    .optional()
    .default('test_strategy'),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, QADocsSchema);
  if (!parsed.ok) return parsed.response;
  const { input, docType, projectId } = parsed.data;

  const orgId = await resolveOrganizationId({ userId: auth.user.id, projectId });
  return withAiQuota(orgId, async () => {
  try {
    const result = await generateQADocumentation(input, docType);

    if (projectId && db) {
      await db.insert(generatedContent).values({
        projectId,
        type: 'qadocs',
        input,
        output: result as unknown as Record<string, unknown>,
      });
    }

    return NextResponse.json({ ...result, demoMode: !db && !!projectId });
  } catch (error) {
    logger.error('qa-docs generation failed', error);
    return NextResponse.json({ error: 'Failed to generate documentation' }, { status: 500 });
  }
  });
}
