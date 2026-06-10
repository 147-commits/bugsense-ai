import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAutomationScript } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { generatedContent } from '@/lib/database/schema';
import { resolveOrganizationId } from '@/lib/billing/org-resolver';
import { withAiQuota } from '@/lib/billing/with-quota';
import { parseBody } from '@/lib/validation';
import { logger } from '@/lib/observability/logger';
import { requireSameOrigin } from '@/lib/security/same-origin';

const AutomationSchema = z.object({
  scenario: z.string().min(1).max(10_000),
  framework: z
    .enum(['playwright', 'cypress', 'selenium-js', 'puppeteer', 'webdriverio'])
    .optional()
    .default('playwright'),
  options: z
    .object({
      language: z.enum(['typescript', 'javascript']).optional(),
      includePageObject: z.boolean().optional(),
      includeHelpers: z.boolean().optional(),
      includeCIConfig: z.boolean().optional(),
    })
    .optional()
    .default({}),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, AutomationSchema);
  if (!parsed.ok) return parsed.response;
  const { scenario, framework, options, projectId } = parsed.data;

  const orgId = await resolveOrganizationId({ userId: auth.user.id, projectId });
  return withAiQuota(orgId, async () => {
  try {
    const result = await generateAutomationScript(scenario, framework, {
      language: options.language ?? 'typescript',
      includePageObject: options.includePageObject ?? true,
      includeHelpers: options.includeHelpers ?? true,
      includeCIConfig: options.includeCIConfig ?? false,
    });

    if (projectId && db) {
      await db.insert(generatedContent).values({
        projectId,
        type: 'automation',
        input: scenario,
        output: result as unknown as Record<string, unknown>,
        framework,
        language: options.language ?? 'typescript',
      });
    }

    return NextResponse.json({ ...result, demoMode: !db && !!projectId });
  } catch (error) {
    logger.error('automation generation failed', error);
    return NextResponse.json({ error: 'Failed to generate automation script' }, { status: 500 });
  }
  });
}
