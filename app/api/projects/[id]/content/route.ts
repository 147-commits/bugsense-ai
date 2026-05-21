import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import {
  projects,
  projectMembers,
  bugReports,
  generatedContent,
} from '@/lib/database/schema';
import { parseParams, parseQuery } from '@/lib/validation';

const ParamsSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

const QuerySchema = z.object({
  type: z
    .enum([
      'all',
      'bugs',
      'documents',
      'testgen',
      'apitests',
      'automation',
      'testdata',
      'testplan',
      'releasenotes',
      'qadocs',
      'coverage',
    ])
    .optional(),
});

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const paramsParsed = parseParams(params, ParamsSchema);
  if (!paramsParsed.ok) return paramsParsed.response;
  const queryParsed = parseQuery(req, QuerySchema);
  if (!queryParsed.ok) return queryParsed.response;

  const projectId = paramsParsed.data.id;
  const type = queryParsed.data.type;

  if (!db) {
    return NextResponse.json({
      project: null,
      generatedContent: [],
      bugReports: [],
      demoMode: true,
    });
  }

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  const [bugRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bugReports)
    .where(eq(bugReports.projectId, projectId));
  const [memberRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));

  const projectWithCounts = {
    ...project,
    _count: {
      bugReports: Number(bugRow?.count ?? 0),
      members: Number(memberRow?.count ?? 0),
    },
  };

  const skipGc = type === 'bugs';
  const skipBugs = !!(type && type !== 'all' && type !== 'bugs');

  const gcWhere = (() => {
    if (type === 'documents') {
      return and(
        eq(generatedContent.projectId, projectId),
        inArray(generatedContent.type, ['testplan', 'releasenotes', 'qadocs']),
      );
    }
    if (type && type !== 'all' && type !== 'bugs') {
      return and(eq(generatedContent.projectId, projectId), eq(generatedContent.type, type));
    }
    return eq(generatedContent.projectId, projectId);
  })();

  const [gc, bugs] = await Promise.all([
    skipGc
      ? Promise.resolve([])
      : db.query.generatedContent.findMany({
          where: gcWhere,
          orderBy: desc(generatedContent.createdAt),
          limit: 200,
        }),
    skipBugs
      ? Promise.resolve([])
      : db.query.bugReports.findMany({
          where: eq(bugReports.projectId, projectId),
          orderBy: desc(bugReports.createdAt),
          limit: 200,
          with: { testCases: { limit: 5 } },
        }),
  ]);

  return NextResponse.json({
    project: projectWithCounts,
    generatedContent: gc,
    bugReports: bugs,
  });
}
