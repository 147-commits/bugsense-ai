import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateReleaseNotes } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { generatedContent } from '@/lib/database/schema';
import { resolveOrganizationId } from '@/lib/billing/org-resolver';
import { withAiQuota } from '@/lib/billing/with-quota';
import { parseBody } from '@/lib/validation';

const ReleaseNotesSchema = z.object({
  input: z.string().min(1).max(50_000),
  format: z
    .enum(['standard', 'technical', 'user-facing', 'changelog', 'slack'])
    .optional()
    .default('standard'),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, ReleaseNotesSchema);
  if (!parsed.ok) return parsed.response;
  const { input, format, projectId } = parsed.data;

  const orgId = await resolveOrganizationId({ userId: auth.user.id, projectId });
  return withAiQuota(orgId, async () => {
  try {
    const result = await generateReleaseNotes(input, format);

    if (projectId && db) {
      await db.insert(generatedContent).values({
        projectId,
        type: 'releasenotes',
        input,
        output: result as unknown as Record<string, unknown>,
      });
    }

    return NextResponse.json({ ...result, demoMode: !db && !!projectId });
  } catch (error) {
    console.error('Release notes error:', error);
    return NextResponse.json({ error: 'Failed to generate release notes' }, { status: 500 });
  }
  });
}
