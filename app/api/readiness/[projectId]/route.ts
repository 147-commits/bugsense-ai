import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { projects, releaseReadinessSnapshots } from '@/lib/database/schema';
import { computeProjectReadiness } from '@/lib/scoring/loadReadiness';
import { demoModeResponse, parseParams } from '@/lib/validation';

const ParamsSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

type Ctx = { params: { projectId: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
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

  const result = await computeProjectReadiness(projectId);

  await db.insert(releaseReadinessSnapshots).values({
    projectId,
    score: result.score,
    verdict: result.verdict,
    breakdown: result.breakdown,
    blockers: result.blockers,
  });

  return NextResponse.json(result);
}
