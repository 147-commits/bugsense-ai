import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { chatAboutBug } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { bugReports, chatMessages } from '@/lib/database/schema';
import { resolveOrganizationId } from '@/lib/billing/org-resolver';
import { withAiQuota } from '@/lib/billing/with-quota';
import { parseBody } from '@/lib/validation';
import { logger } from '@/lib/observability/logger';

const ChatSchema = z.object({
  bugReportId: z.string().min(1).max(128).optional(),
  message: z.string().min(1).max(8000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(20_000),
      }),
    )
    .max(50)
    .optional(),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, ChatSchema);
  if (!parsed.ok) return parsed.response;
  const { bugReportId, message, history = [], projectId } = parsed.data;

  const orgId = await resolveOrganizationId({ userId: auth.user.id, projectId });
  return withAiQuota(orgId, async () => {
  try {
    let bugContext = 'No specific bug context available.';
    if (bugReportId && db) {
      const bug = await db.query.bugReports.findFirst({
        where: eq(bugReports.id, bugReportId),
        columns: {
          title: true,
          description: true,
          severity: true,
          stepsToReproduce: true,
          affectedModules: true,
        },
      });
      if (bug) {
        bugContext = `Title: ${bug.title}\nDescription: ${bug.description}\nSeverity: ${bug.severity}\nSteps: ${bug.stepsToReproduce.join(', ')}\nModules: ${bug.affectedModules.join(', ')}`;
      }
    }

    const response = await chatAboutBug(bugContext, history, message);

    if (bugReportId && db) {
      await db.insert(chatMessages).values([
        { bugReportId, role: 'user', content: message },
        { bugReportId, role: 'assistant', content: response },
      ]);
    }

    return NextResponse.json({ response, projectId, demoMode: !db });
  } catch (error) {
    logger.error('chat generation failed', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
  });
}
