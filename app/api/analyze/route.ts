import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  analyzeBug,
  calculateQualityScore,
  detectDuplicates,
  generateTestCases,
  generateReproductionChecklist,
} from '@/lib/ai/bugAnalyzer';
import { validateBugAnalysis } from '@/lib/ai/validator';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { bugReports } from '@/lib/database/schema';
import { tryPushBugToJira } from '@/lib/jira/sync-out';
import { tryNotifyCriticalBug } from '@/lib/slack/dispatcher';
import { resolveOrganizationId } from '@/lib/billing/org-resolver';
import { withAiQuota } from '@/lib/billing/with-quota';
import { parseBody } from '@/lib/validation';
import { logger } from '@/lib/observability/logger';

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

const AnalyzeSchema = z.object({
  rawInput: z.string().min(1).max(20_000),
  logContent: z.string().max(100_000).optional(),
  screenshotBase64: z.string().max(15_000_000).optional(),
  projectId: z.string().min(1).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, AnalyzeSchema);
  if (!parsed.ok) return parsed.response;
  const { rawInput, logContent, screenshotBase64, projectId } = parsed.data;

  const orgId = await resolveOrganizationId({ userId: auth.user.id, projectId });
  return withAiQuota(orgId, async () => {
  try {
    const rawAnalysis = await analyzeBug(
      rawInput,
      logContent,
      screenshotBase64 ? 'User uploaded a screenshot' : undefined,
    );
    const analysis = validateBugAnalysis(rawAnalysis);

    const bugReport = {
      id: `bug-${Date.now().toString(36)}`,
      rawInput,
      title: analysis.title as string,
      description: analysis.description as string,
      severity: analysis.severity as string,
      priority: analysis.priority as string,
      status: 'OPEN',
      stepsToReproduce: (analysis.stepsToReproduce as string[]) || [],
      expectedResult: analysis.expectedResult as string,
      actualResult: analysis.actualResult as string,
      environment: analysis.environment || {},
      rootCauseHypotheses: (analysis.rootCauseHypotheses as string[]) || [],
      affectedModules: (analysis.affectedModules as string[]) || [],
      tags: (analysis.tags as string[]) || [],
      aiAnalysis: analysis.technicalAnalysis || null,
      impactPrediction: analysis.impactPrediction || null,
      screenshotUrls: [],
      logContent: logContent || null,
      qualityScore: null as number | null,
      duplicateOfId: null,
      clusterId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const qualityResult = await calculateQualityScore(bugReport);
    bugReport.qualityScore = (qualityResult.score as number) || null;

    let existingBugs: { id: string; title: string; description: string }[] = [];
    if (projectId && db) {
      existingBugs = await db.query.bugReports.findMany({
        where: eq(bugReports.projectId, projectId),
        columns: { id: true, title: true, description: true },
        orderBy: desc(bugReports.createdAt),
        limit: 50,
      });
    }
    const duplicates = await detectDuplicates(
      { title: bugReport.title, description: bugReport.description },
      existingBugs,
    );

    const testCases = await generateTestCases({
      title: bugReport.title,
      description: bugReport.description,
      stepsToReproduce: bugReport.stepsToReproduce,
    });

    const reproChecklist = await generateReproductionChecklist({
      title: bugReport.title,
      description: bugReport.description,
      stepsToReproduce: bugReport.stepsToReproduce,
      environment: bugReport.environment,
    });

    let persistedBugId: string | null = null;
    if (projectId && db) {
      const [inserted] = await db
        .insert(bugReports)
        .values({
          projectId,
          rawInput,
          title: bugReport.title,
          description: bugReport.description,
          severity: ((analysis.severity as Severity) || 'MEDIUM') as Severity,
          priority: ((analysis.priority as Priority) || 'P2') as Priority,
          status: 'OPEN',
          stepsToReproduce: bugReport.stepsToReproduce,
          expectedResult: bugReport.expectedResult || null,
          actualResult: bugReport.actualResult || null,
          environment: bugReport.environment ?? null,
          rootCauseHypotheses: bugReport.rootCauseHypotheses,
          affectedModules: bugReport.affectedModules,
          tags: bugReport.tags,
          aiAnalysis: bugReport.aiAnalysis ?? null,
          impactPrediction: bugReport.impactPrediction ?? null,
          qualityScore: bugReport.qualityScore,
          logContent: logContent || null,
        })
        .returning({ id: bugReports.id });
      persistedBugId = inserted?.id ?? null;
    }

    let jiraSync: { jiraIssueKey: string; created: boolean } | null = null;
    if (persistedBugId) {
      const result = await tryPushBugToJira(persistedBugId, { siteOrigin: req.nextUrl.origin });
      if (result) jiraSync = { jiraIssueKey: result.jiraIssueKey, created: result.created };
    }

    if (persistedBugId && (bugReport.severity === 'CRITICAL' || bugReport.severity === 'HIGH')) {
      void tryNotifyCriticalBug({
        projectId: projectId ?? null,
        bugId: persistedBugId,
        title: bugReport.title,
        severity: bugReport.severity,
        origin: req.nextUrl.origin,
      });
    }

    return NextResponse.json({
      bugReport,
      qualityScore: qualityResult,
      duplicates,
      testCases,
      reproductionChecklist: reproChecklist,
      jiraSync,
      demoMode: !db && !!projectId,
    });
  } catch (error) {
    logger.error('bug analysis failed', error);
    return NextResponse.json(
      { error: 'Failed to analyze bug report. Please try again.' },
      { status: 500 },
    );
  }
  });
}
