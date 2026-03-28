import { NextRequest, NextResponse } from 'next/server';
import { formatForJira, formatForGitHub } from '@/lib/ai/bugAnalyzer';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { platform, bugReportId } = body;

    if (!platform || !bugReportId) {
      return NextResponse.json({ error: 'platform and bugReportId are required' }, { status: 400 });
    }

    const bug = await prisma.bugReport.findUnique({ where: { id: bugReportId } });
    if (!bug) {
      return NextResponse.json({ error: 'Bug report not found' }, { status: 404 });
    }

    let exportData;
    if (platform === 'jira') {
      exportData = formatForJira(bug as unknown as Record<string, unknown>);
    } else if (platform === 'github') {
      exportData = formatForGitHub(bug as unknown as Record<string, unknown>);
    } else {
      return NextResponse.json({ error: 'Unsupported platform. Use jira or github.' }, { status: 400 });
    }

    return NextResponse.json({
      platform,
      exportData,
      message: `Bug report formatted for ${platform}. Copy the payload to create the issue.`,
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
  }
}
