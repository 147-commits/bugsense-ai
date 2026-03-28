import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/database/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;

  const [total, critical, high, medium, low, resolved, bugs] = await Promise.all([
    prisma.bugReport.count({ where }),
    prisma.bugReport.count({ where: { ...where, severity: 'CRITICAL' } }),
    prisma.bugReport.count({ where: { ...where, severity: 'HIGH' } }),
    prisma.bugReport.count({ where: { ...where, severity: 'MEDIUM' } }),
    prisma.bugReport.count({ where: { ...where, severity: 'LOW' } }),
    prisma.bugReport.count({ where: { ...where, status: 'RESOLVED' } }),
    prisma.bugReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const avgScore = await prisma.bugReport.aggregate({
    where,
    _avg: { qualityScore: true },
  });

  return NextResponse.json({
    totalBugs: total,
    criticalBugs: critical,
    resolvedBugs: resolved,
    avgQualityScore: avgScore._avg.qualityScore ?? 0,
    severityDistribution: [
      { name: 'Critical', value: critical, color: '#ef4444' },
      { name: 'High', value: high, color: '#f97316' },
      { name: 'Medium', value: medium, color: '#eab308' },
      { name: 'Low', value: low, color: '#22c55e' },
    ],
    recentBugs: bugs,
    trendData: [],
    topModules: [],
  });
}
