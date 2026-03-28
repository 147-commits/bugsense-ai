import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { prisma } from '@/lib/database/prisma';

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Resolve or bootstrap the user's default organisation. */
async function resolveOrg(userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { joinedAt: 'asc' },
  });
  if (membership) return membership.organization;

  // First sign-in — create a personal org automatically
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  const orgName = user?.name ? `${user.name}'s Workspace` : 'My Workspace';
  const baseSlug = slugify(orgName);

  // Ensure unique slug
  const existing = await prisma.organization.findUnique({ where: { slug: baseSlug } });
  const orgSlug = existing ? `${baseSlug}-${userId.slice(-6)}` : baseSlug;

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug: orgSlug,
      members: { create: { userId, role: 'OWNER' } },
    },
  });
  return org;
}

// ── GET /api/projects ─────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await resolveOrg(session.user.id);

  const projects = await prisma.project.findMany({
    where: { organizationId: org.id },
    include: {
      _count: { select: { bugReports: true, members: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(projects);
}

// ── POST /api/projects ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, description, techStack, testConventions } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const org = await resolveOrg(session.user.id);

  // Derive a unique slug within this org
  const baseSlug = slugify(name);
  const conflict = await prisma.project.findUnique({
    where: { organizationId_slug: { organizationId: org.id, slug: baseSlug } },
  });
  const slug = conflict ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      techStack: techStack ?? [],
      testConventions: testConventions ?? null,
      organizationId: org.id,
      members: { create: { userId: session.user.id, role: 'OWNER' } },
    },
    include: { _count: { select: { bugReports: true, members: true } } },
  });

  return NextResponse.json(project, { status: 201 });
}
