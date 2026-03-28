import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { prisma } from '@/lib/database/prisma';

type Ctx = { params: { id: string } };

async function assertOwner(userId: string, projectId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return member && (member.role === 'OWNER' || member.role === 'ADMIN');
}

// ── PATCH /api/projects/[id] ──────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await assertOwner(session.user.id, params.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, description, techStack, testConventions } = body;

  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(techStack !== undefined && { techStack }),
      ...(testConventions !== undefined && { testConventions }),
    },
    include: { _count: { select: { bugReports: true, members: true } } },
  });

  return NextResponse.json(project);
}

// ── DELETE /api/projects/[id] ─────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const allowed = await assertOwner(session.user.id, params.id);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.project.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
