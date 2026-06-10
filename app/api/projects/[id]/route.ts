import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/authOptions';
import { db, type DB } from '@/lib/database/db';
import { projects, projectMembers, bugReports } from '@/lib/database/schema';
import { demoModeResponse, parseBody, parseParams } from '@/lib/validation';
import { requireSameOrigin } from '@/lib/security/same-origin';

const ParamsSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

const PatchProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullish(),
    techStack: z.array(z.string().max(60)).max(50).optional(),
    testConventions: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required.' });

type Ctx = { params: { id: string } };

async function assertOwner(dbConn: DB, userId: string, projectId: string) {
  const member = await dbConn.query.projectMembers.findFirst({
    where: and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)),
  });
  return member && (member.role === 'OWNER' || member.role === 'ADMIN');
}

async function withCounts(dbConn: DB, projectId: string) {
  const project = await dbConn.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return null;

  const [bugRow] = await dbConn
    .select({ count: sql<number>`count(*)::int` })
    .from(bugReports)
    .where(eq(bugReports.projectId, projectId));

  const [memberRow] = await dbConn
    .select({ count: sql<number>`count(*)::int` })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));

  return {
    ...project,
    _count: {
      bugReports: Number(bugRow?.count ?? 0),
      members: Number(memberRow?.count ?? 0),
    },
  };
}

// ── PATCH /api/projects/[id] ──────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const paramsParsed = parseParams(params, ParamsSchema);
  if (!paramsParsed.ok) return paramsParsed.response;
  const bodyParsed = await parseBody(req, PatchProjectSchema);
  if (!bodyParsed.ok) return bodyParsed.response;

  if (!db) return demoModeResponse('Editing a project requires a configured database.');

  const allowed = await assertOwner(db, session.user.id, paramsParsed.data.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, description, techStack, testConventions } = bodyParsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (techStack !== undefined) updates.techStack = techStack;
  if (testConventions !== undefined) updates.testConventions = testConventions;

  await db.update(projects).set(updates).where(eq(projects.id, paramsParsed.data.id));

  const project = await withCounts(db, paramsParsed.data.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

// ── DELETE /api/projects/[id] ─────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const paramsParsed = parseParams(params, ParamsSchema);
  if (!paramsParsed.ok) return paramsParsed.response;

  if (!db) return demoModeResponse('Deleting a project requires a configured database.');

  const allowed = await assertOwner(db, session.user.id, paramsParsed.data.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await db.delete(projects).where(eq(projects.id, paramsParsed.data.id));
  return new NextResponse(null, { status: 204 });
}
