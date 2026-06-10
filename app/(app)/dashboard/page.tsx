'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bug, AlertTriangle, CheckCircle, Gauge, ArrowRight, RefreshCw } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import { BugTrendChart, ModuleBarChart } from '@/components/charts/BugCharts';
import GetStartedPanel from '@/components/onboarding/GetStartedPanel';
import { useAppStore } from '@/lib/hooks/useStore';
import { cn, severityColor, formatTimeAgo } from '@/lib/utils';
import Link from 'next/link';
import type { DashboardStats } from '@/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentProject } = useAppStore();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = currentProject
        ? `/api/bugs/stats?projectId=${currentProject.id}`
        : '/api/bugs/stats';
      const [statsRes, projectsRes] = await Promise.all([
        fetch(url),
        fetch('/api/projects'),
      ]);
      if (!statsRes.ok) {
        setError('Could not load dashboard stats.');
        setStats(null);
        return;
      }
      setStats(await statsRes.json());
      if (projectsRes.ok) {
        const list = (await projectsRes.json()) as unknown[];
        setProjectCount(Array.isArray(list) ? list.length : 0);
      }
    } catch {
      setError('Network error while loading dashboard stats.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const statCards = stats
    ? [
        { label: 'Total Bugs', value: stats.totalBugs, icon: Bug },
        { label: 'Critical', value: stats.criticalBugs, icon: AlertTriangle },
        { label: 'Resolved', value: stats.resolvedBugs, icon: CheckCircle },
        {
          label: 'Avg Quality',
          value: stats.avgQualityScore?.toFixed?.(1) ?? '—',
          icon: Gauge,
        },
      ]
    : [];

  const hasAnyBugs = (stats?.totalBugs ?? 0) > 0;
  const isFirstRun = !loading && stats !== null && projectCount === 0 && !hasAnyBugs;

  return (
    <div className="min-h-screen">
      <TopBar title="Dashboard" />

      <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
        {isFirstRun && (
          <GetStartedPanel
            hasProject={(projectCount ?? 0) > 0}
            hasBug={hasAnyBugs}
            hasTeammate={false}
          />
        )}

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-center justify-between px-4 py-3 rounded-lg bg-severity-critical/10 text-severity-critical text-sm"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchStats}
              className="ml-3 inline-flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {loading
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-panel p-5 h-24 animate-pulse" aria-hidden="true" />
              ))
            : statCards.map((card) => (
                <div key={card.label} className="glass-panel p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center">
                      <card.icon className="w-4 h-4 text-text-muted" />
                    </div>
                  </div>
                  <p className="text-2xl font-semibold text-text-primary font-mono">{card.value}</p>
                  <p className="text-sm text-text-muted mt-0.5">{card.label}</p>
                </div>
              ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">Bug Trend</h3>
              <span className="text-xs text-text-muted">Last 7 days</span>
            </div>
            {stats?.trendData ? (
              <BugTrendChart data={stats.trendData} />
            ) : loading ? (
              <div className="h-[240px] bg-bg-tertiary rounded-lg animate-pulse" aria-hidden="true" />
            ) : (
              <div className="h-[240px] flex items-center justify-center text-xs text-text-muted">
                No trend data yet.
              </div>
            )}
          </div>
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">Top Affected Modules</h3>
              <Link href="/analytics" className="text-xs text-accent hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {stats?.topModules ? (
              <ModuleBarChart data={stats.topModules} />
            ) : loading ? (
              <div className="h-[240px] bg-bg-tertiary rounded-lg animate-pulse" aria-hidden="true" />
            ) : (
              <div className="h-[240px] flex items-center justify-center text-xs text-text-muted">
                No module data yet.
              </div>
            )}
          </div>
        </div>

        {/* Recent Bugs */}
        <div className="glass-panel">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">Recent Bugs</h3>
            <Link href="/bugs" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div>
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-text-muted">Loading…</div>
            ) : stats?.recentBugs && stats.recentBugs.length > 0 ? (
              stats.recentBugs.slice(0, 8).map((bug, i) => (
                <div
                  key={bug.id || i}
                  className="flex items-center gap-3 px-5 py-2.5 border-b border-border last:border-0 hover:bg-bg-tertiary transition-colors"
                >
                  <span className={cn('badge text-[10px]', severityColor(bug.severity))}>{bug.severity}</span>
                  <p className="text-sm text-text-primary flex-1 truncate">{bug.title}</p>
                  <span className="text-xs text-text-muted flex-shrink-0">{formatTimeAgo(bug.createdAt)}</span>
                </div>
              ))
            ) : (
              <EmptyState hasProject={!!currentProject} hasAnyBugs={hasAnyBugs} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasProject, hasAnyBugs }: { hasProject: boolean; hasAnyBugs: boolean }) {
  // hasAnyBugs would be false here by definition, but kept so future filters
  // (e.g. "no resolved bugs" vs "no bugs at all") can branch on it cleanly.
  void hasAnyBugs;
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
        <Bug className="w-5 h-5 text-text-muted" />
      </div>
      <p className="text-sm text-text-primary font-medium mb-1">No bugs reported yet</p>
      <p className="text-xs text-text-muted mb-4 max-w-sm mx-auto">
        {hasProject
          ? 'Use the Bug Analyzer to capture your first report. Pasted logs, stack traces, and screenshots are all welcome.'
          : 'Create a project to start tracking bugs, or use the Bug Analyzer to triage one ad-hoc.'}
      </p>
      <div className="flex items-center justify-center gap-2">
        <Link href="/bugs" className="btn-primary text-xs">
          Open Bug Analyzer
        </Link>
        {!hasProject && (
          <Link href="/projects" className="btn-secondary text-xs">
            Create a project
          </Link>
        )}
      </div>
    </div>
  );
}
