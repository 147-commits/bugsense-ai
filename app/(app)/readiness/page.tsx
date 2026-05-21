import { getServerSession } from 'next-auth';
import { eq, desc, and } from 'drizzle-orm';
import { AlertTriangle, CheckCircle, Rocket, ShieldAlert } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import { authOptions } from '@/lib/auth/authOptions';
import { db } from '@/lib/database/db';
import {
  organizationMembers,
  projectMembers,
  projects,
} from '@/lib/database/schema';
import { computeProjectReadiness } from '@/lib/scoring/loadReadiness';
import { computeReadinessScore } from '@/lib/scoring/releaseReadiness';
import { cn } from '@/lib/utils';
import type { ReadinessResult, Verdict } from '@/types/readiness';

type Props = { searchParams: { projectId?: string } };

const VERDICT_META: Record<Verdict, { label: string; chip: string; bar: string; icon: typeof Rocket }> = {
  GO: {
    label: 'GO',
    chip: 'bg-severity-low/15 text-severity-low border-severity-low/30',
    bar: 'bg-severity-low',
    icon: CheckCircle,
  },
  CAUTION: {
    label: 'CAUTION',
    chip: 'bg-severity-medium/15 text-severity-medium border-severity-medium/30',
    bar: 'bg-severity-medium',
    icon: AlertTriangle,
  },
  NO_GO: {
    label: 'NO-GO',
    chip: 'bg-severity-critical/15 text-severity-critical border-severity-critical/30',
    bar: 'bg-severity-critical',
    icon: ShieldAlert,
  },
};

async function resolveProjectId(userId: string, requested: string | undefined): Promise<string | null> {
  if (!db) return null;
  if (requested) {
    // Only honor the query param if the user actually belongs to that project's org.
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, requested)),
    });
    if (member) return requested;
  }

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, userId),
    orderBy: organizationMembers.joinedAt,
  });
  if (!membership) return null;

  const first = await db.query.projects.findFirst({
    where: eq(projects.organizationId, membership.organizationId),
    orderBy: desc(projects.createdAt),
  });
  return first?.id ?? null;
}

function mockResult(): ReadinessResult {
  return computeReadinessScore({
    openBugs: { critical: 0, high: 2, medium: 4, low: 5, info: 1 },
    criticalBugDetails: [],
    testPassRate: null,
    avgQualityScore: 78,
  });
}

export default async function ReadinessPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  let result: ReadinessResult;
  let projectName: string | null = null;
  let usingMockData = false;

  if (!userId || !db) {
    result = mockResult();
    usingMockData = true;
  } else {
    const projectId = await resolveProjectId(userId, searchParams.projectId);
    if (!projectId) {
      result = mockResult();
      usingMockData = true;
    } else {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      projectName = project?.name ?? null;
      result = await computeProjectReadiness(projectId);
    }
  }

  const meta = VERDICT_META[result.verdict];
  const VerdictIcon = meta.icon;

  return (
    <div className="min-h-screen">
      <TopBar title="Release Readiness" />

      <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
        {usingMockData && (
          <div className="glass-panel px-4 py-2.5 text-xs text-text-muted flex items-center gap-2">
            <Rocket className="w-3.5 h-3.5" />
            Showing sample data — create a project and analyse some bugs to see a real score.
          </div>
        )}

        {/* Headline */}
        <div className="glass-panel p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
              {projectName ?? 'Sample project'}
            </p>
            <p className="text-sm text-text-secondary">Release Readiness Score</p>
            <p className="text-[64px] leading-none font-semibold font-mono text-text-primary mt-2">
              {result.score}
              <span className="text-2xl text-text-muted ml-1">/ 100</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border',
                meta.chip,
              )}
            >
              <VerdictIcon className="w-4 h-4" />
              {meta.label}
            </span>
            <p className="text-xs text-text-muted max-w-[220px] text-right">
              {result.verdict === 'GO' && 'All signals are healthy — safe to ship.'}
              {result.verdict === 'CAUTION' && 'Some signals need attention before release.'}
              {result.verdict === 'NO_GO' && 'Critical issues are open — do not release.'}
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="glass-panel">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">Signal breakdown</h3>
          </div>
          <div className="divide-y divide-border">
            {result.breakdown.map((signal) => (
              <div key={signal.key} className="px-5 py-4">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {signal.label}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      ({Math.round(signal.weight * 100)}% weight)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-mono text-text-primary">
                      {signal.weightedContribution}
                      <span className="text-text-muted">/{signal.maxContribution}</span>
                    </span>
                    <span className="text-[11px] text-text-muted">
                      raw {signal.raw}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className={cn('h-full transition-all duration-300', meta.bar)}
                    style={{
                      width: `${
                        signal.maxContribution === 0
                          ? 0
                          : Math.max(
                              0,
                              Math.min(100, (signal.weightedContribution / signal.maxContribution) * 100),
                            )
                      }%`,
                    }}
                  />
                </div>
                {signal.note && (
                  <p className="text-[11px] text-text-muted mt-2">{signal.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Blockers */}
        <div className="glass-panel">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Blocking issues</h3>
            <span className="text-xs text-text-muted">
              {result.blockers.length} {result.blockers.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          {result.blockers.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-text-muted">
              No blocking issues. Critical bugs would appear here.
            </div>
          ) : (
            <ul>
              {result.blockers.map((blocker) => (
                <li
                  key={blocker.id}
                  className="flex items-center gap-3 px-5 py-2.5 border-b border-border last:border-0"
                >
                  <span className="badge badge-critical text-[10px]">CRITICAL</span>
                  <p className="text-sm text-text-primary flex-1 truncate">{blocker.title}</p>
                  <span className="text-[11px] text-text-muted flex-shrink-0">{blocker.id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
