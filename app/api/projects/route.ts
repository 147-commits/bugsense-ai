import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/authOptions';
import { db, type DB } from '@/lib/database/db';
import {
  users,
  organizations,
  organizationMembers,
  projects,
  projectMembers,
  bugReports,
} from '@/lib/database/schema';
import { demoModeResponse, parseBody } from '@/lib/validation';
import { requireSameOrigin } from '@/lib/security/same-origin';

const CreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullish(),
  techStack: z.array(z.string().max(60)).max(50).optional(),
  testConventions: z.record(z.string(), z.unknown()).nullable().optional(),
});

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Resolve or bootstrap the user's default organisation. */
async function resolveOrg(dbConn: DB, userId: string) {
  const membership = await dbConn.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, userId),
    with: { organization: true },
    orderBy: organizationMembers.joinedAt,
  });
  if (membership) return membership.organization;

  const user = await dbConn.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { name: true, email: true },
  });
  const orgName = user?.name ? `${user.name}'s Workspace` : 'My Workspace';
  const baseSlug = slugify(orgName);

  const existing = await dbConn.query.organizations.findFirst({
    where: eq(organizations.slug, baseSlug),
  });
  const orgSlug = existing ? `${baseSlug}-${userId.slice(-6)}` : baseSlug;

  const [org] = await dbConn
    .insert(organizations)
    .values({ name: orgName, slug: orgSlug })
    .returning();

  await dbConn.insert(organizationMembers).values({
    userId,
    organizationId: org.id,
    role: 'OWNER',
  });

  return org;
}

async function attachCounts<T extends { id: string }>(dbConn: DB, rows: T[]) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, _count: { bugReports: 0, members: 0 } }));
  const ids = rows.map((r) => r.id);

  const bugCounts = await dbConn
    .select({ projectId: bugReports.projectId, count: sql<number>`count(*)::int` })
    .from(bugReports)
    .where(inArray(bugReports.projectId, ids))
    .groupBy(bugReports.projectId);

  const memberCounts = await dbConn
    .select({ projectId: projectMembers.projectId, count: sql<number>`count(*)::int` })
    .from(projectMembers)
    .where(inArray(projectMembers.projectId, ids))
    .groupBy(projectMembers.projectId);

  const bugMap = new Map(bugCounts.map((c) => [c.projectId, Number(c.count)]));
  const memberMap = new Map(memberCounts.map((c) => [c.projectId, Number(c.count)]));

  return rows.map((r) => ({
    ...r,
    _count: {
      bugReports: bugMap.get(r.id) ?? 0,
      members: memberMap.get(r.id) ?? 0,
    },
  }));
}

// ── GET /api/projects ─────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!db) return NextResponse.json([]);

  const org = await resolveOrg(db, session.user.id);

  const rows = await db.query.projects.findMany({
    where: eq(projects.organizationId, org.id),
    orderBy: desc(projects.createdAt),
  });

  const withCounts = await attachCounts(db, rows);
  // Short private cache absorbs the burst when the dashboard fans out to
  // /api/projects + /api/bugs/stats on every render; mutating endpoints
  // (POST/PATCH/DELETE below) return immediately uncached, so a fresh
  // project shows up on the next dashboard load without the user noticing
  // the 10s window.
  const res = NextResponse.json(withCounts);
  res.headers.set('Cache-Control', 'private, max-age=10');
  return res;
}

// ── POST /api/projects ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = await parseBody(req, CreateProjectSchema);
  if (!parsed.ok) return parsed.response;
  const { name, description, techStack, testConventions } = parsed.data;

  if (!db) return demoModeResponse('Creating a project requires a configured database.');

  const org = await resolveOrg(db, session.user.id);

  const baseSlug = slugify(name);
  const conflict = await db.query.projects.findFirst({
    where: and(eq(projects.organizationId, org.id), eq(projects.slug, baseSlug)),
  });
  const slug = conflict ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  const [project] = await db
    .insert(projects)
    .values({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      techStack: techStack ?? [],
      testConventions: testConventions ?? null,
      organizationId: org.id,
    })
    .returning();

  await db.insert(projectMembers).values({
    userId: session.user.id,
    projectId: project.id,
    role: 'OWNER',
  });

  const [withCounts] = await attachCounts(db, [project]);
  return NextResponse.json(withCounts, { status: 201 });
}
