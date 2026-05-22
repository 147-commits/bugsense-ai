import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { projects, releaseReadinessSnapshots } from '@/lib/database/schema';
import { computeProjectReadiness } from '@/lib/scoring/loadReadiness';
import { tryNotifyReadinessFlip } from '@/lib/slack/dispatcher';
import { demoModeResponse, parseParams } from '@/lib/validation';

const ParamsSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

type Ctx = { params: { projectId: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const parsed = parseParams(params, ParamsSchema);
  if (!parsed.ok) return parsed.response;
  const { projectId } = parsed.data;

  if (!db) return demoModeResponse('Release readiness requires a configured database.');

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const previousSnapshot = await db.query.releaseReadinessSnapshots.findFirst({
    where: eq(releaseReadinessSnapshots.projectId, projectId),
    orderBy: desc(releaseReadinessSnapshots.createdAt),
  });

  const result = await computeProjectReadiness(projectId);

  await db.insert(releaseReadinessSnapshots).values({
    projectId,
    score: result.score,
    verdict: result.verdict,
    breakdown: result.breakdown,
    blockers: result.blockers,
  });

  if (
    project.organizationId &&
    previousSnapshot?.verdict === 'GO' &&
    result.verdict === 'NO_GO'
  ) {
    void tryNotifyReadinessFlip({
      organizationId: project.organizationId,
      projectId,
      projectName: project.name,
      previousVerdict: 'GO',
      newVerdict: 'NO_GO',
      score: result.score,
      blockerCount: result.blockers.length,
      origin: req.nextUrl.origin,
    });
  }

  return NextResponse.json(result);
}
