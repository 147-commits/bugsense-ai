import { NextRequest, NextResponse } from 'next/server';
import { analyzeBug, calculateQualityScore, detectDuplicates, generateTestCases, generateReproductionChecklist } from '@/lib/ai/bugAnalyzer';
import { validateBugAnalysis } from '@/lib/ai/validator';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';
import { Severity, Priority } from '@prisma/client';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { rawInput, logContent, screenshotBase64, projectId } = body;

    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json({ error: 'rawInput is required' }, { status: 400 });
    }

    // Step 1: AI Analysis
    const rawAnalysis = await analyzeBug(rawInput, logContent, screenshotBase64 ? 'User uploaded a screenshot' : undefined);
    const analysis = validateBugAnalysis(rawAnalysis);

    // Build bug report
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

    // Step 2: Quality Score
    const qualityResult = await calculateQualityScore(bugReport);
    bugReport.qualityScore = (qualityResult.score as number) || null;

    // Step 3: Duplicate Detection — use real DB bugs if projectId provided
    let existingBugs: { id: string; title: string; description: string }[] = [];
    if (projectId) {
      existingBugs = await prisma.bugReport.findMany({
        where: { projectId },
        select: { id: true, title: true, description: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    }
    const duplicates = await detectDuplicates(
      { title: bugReport.title, description: bugReport.description },
      existingBugs
    );

    // Step 4: Test Cases
    const testCases = await generateTestCases({
      title: bugReport.title,
      description: bugReport.description,
      stepsToReproduce: bugReport.stepsToReproduce,
    });

    // Step 5: Reproduction Checklist
    const reproChecklist = await generateReproductionChecklist({
      title: bugReport.title,
      description: bugReport.description,
      stepsToReproduce: bugReport.stepsToReproduce,
      environment: bugReport.environment,
    });

    // Persist to DB if projectId provided
    if (projectId) {
      await prisma.bugReport.create({
        data: {
          projectId,
          rawInput,
          title: bugReport.title,
          description: bugReport.description,
          severity: (analysis.severity as Severity) || 'MEDIUM',
          priority: (analysis.priority as Priority) || 'P2',
          status: 'OPEN',
          stepsToReproduce: bugReport.stepsToReproduce,
          expectedResult: bugReport.expectedResult || null,
          actualResult: bugReport.actualResult || null,
          environment: bugReport.environment ?? undefined,
          rootCauseHypotheses: bugReport.rootCauseHypotheses,
          affectedModules: bugReport.affectedModules,
          tags: bugReport.tags,
          aiAnalysis: bugReport.aiAnalysis ?? undefined,
          impactPrediction: bugReport.impactPrediction ?? undefined,
          qualityScore: bugReport.qualityScore,
          logContent: logContent || null,
        },
      });
    }

    return NextResponse.json({
      bugReport,
      qualityScore: qualityResult,
      duplicates,
      testCases,
      reproductionChecklist: reproChecklist,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze bug report. Please try again.' },
      { status: 500 }
    );
  }
}
