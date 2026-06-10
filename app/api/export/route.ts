import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { formatForJira, formatForGitHub } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { bugReports } from '@/lib/database/schema';
import { demoModeResponse, parseBody } from '@/lib/validation';
import { logger } from '@/lib/observability/logger';
import { requireSameOrigin } from '@/lib/security/same-origin';

const ExportSchema = z.object({
  platform: z.enum(['jira', 'github']),
  bugReportId: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, ExportSchema);
  if (!parsed.ok) return parsed.response;
  const { platform, bugReportId } = parsed.data;

  if (!db) return demoModeResponse('Export requires a configured database to look up the bug.');

  try {
    const bug = await db.query.bugReports.findFirst({ where: eq(bugReports.id, bugReportId) });
    if (!bug) {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 });
    }

    const bugAsRecord = bug as unknown as Record<string, unknown>;
    const exportData = platform === 'jira' ? formatForJira(bugAsRecord) : formatForGitHub(bugAsRecord);

    return NextResponse.json({
      platform,
      exportData,
      message: `Bug report formatted for ${platform}. Copy the payload to create the issue.`,
    });
  } catch (error) {
    logger.error('export failed', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}
