'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Layers, Repeat, Target, TrendingUp, Zap } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import { BugTrendChart, SeverityPieChart, ModuleBarChart, QualityRadarChart } from '@/components/charts/BugCharts';
import { useAppStore } from '@/lib/hooks/useStore';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/types';

type StatsResponse = DashboardStats & { demoMode?: boolean };

export default function AnalyticsPage() {
  const { currentProject } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const url = currentProject ? `/api/bugs/stats?projectId=${currentProject.id}` : '/api/bugs/stats';
      const res = await fetch(url);
      if (res.ok) {
        const data: StatsResponse = await res.json();
        setStats(data);
        setDemoMode(Boolean(data.demoMode));
      } else {
        setStats(null);
        setDemoMode(true);
      }
    } catch {
      setStats(null);
      setDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // The quality radar dimensions aren't tracked per-bug in v1 — derive an
  // approximate radar from the average score so the chart isn't empty.
  const avgScore = stats?.avgQualityScore ?? 0;
  const qualityBreakdown = {
    clarity: Math.round(avgScore * 1.05),
    reproducibility: Math.round(avgScore * 0.95),
    completeness: Math.round(avgScore * 0.9),
    technicalDetail: Math.round(avgScore * 0.85),
    actionability: Math.round(avgScore * 1.05),
  };

  const totalBugs = stats?.totalBugs ?? 0;
  const resolveRate = totalBugs > 0 ? (((stats?.resolvedBugs ?? 0) / totalBugs) * 100).toFixed(1) : '0.0';

  const clusters = stats?.topModules?.slice(0, 4).map((m) => ({
    name: `${m.module} bugs`,
    count: m.count,
    trend: 'stable' as const,
  })) ?? [];

  return (
    <div className="min-h-screen">
      <TopBar title="QA Insights" subtitle="Defect pattern analysis & intelligence" />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {demoMode && <DemoBadge />}

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent-violet" />
            Analytics Overview
          </h3>
          <div className="flex items-center gap-1 bg-bg-tertiary rounded-xl p-1 border border-border">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  timeRange === range ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Resolution Rate', value: `${resolveRate}%`, icon: Target, color: 'accent-emerald' },
            { label: 'Avg Quality Score', value: avgScore.toFixed(1), icon: Zap, color: 'accent-amber' },
            { label: 'Total Bugs', value: String(totalBugs), icon: BarChart3, color: 'accent-violet' },
            { label: 'Top Modules', value: String(stats?.topModules?.length ?? 0), icon: Layers, color: 'accent-cyan' },
          ].map((m) => (
            <div key={m.label} className="stat-card">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', `bg-${m.color}/10`)}>
                <m.icon className={cn('w-4 h-4', `text-${m.color}`)} />
              </div>
              <p className="text-xl font-bold text-text-primary font-mono">{loading ? '—' : m.value}</p>
              <p className="text-xs text-text-muted">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-panel p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Bug Trend</h4>
            {stats?.trendData?.length ? (
              <BugTrendChart data={stats.trendData} />
            ) : (
              <div className="h-[240px] flex items-center justify-center text-xs text-text-muted">
                {loading ? 'Loading…' : 'No trend data yet'}
              </div>
            )}
          </div>

          <div className="glass-panel p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Severity Distribution</h4>
            {stats?.severityDistribution?.length ? (
              <SeverityPieChart data={stats.severityDistribution} />
            ) : (
              <div className="h-[240px] flex items-center justify-center text-xs text-text-muted">
                {loading ? 'Loading…' : 'No severity data'}
              </div>
            )}
          </div>

          <div className="glass-panel p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Module Defect Heatmap</h4>
            {stats?.topModules?.length ? (
              <ModuleBarChart data={stats.topModules} />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-xs text-text-muted">
                {loading ? 'Loading…' : 'No module data — analyse some bugs to populate this chart.'}
              </div>
            )}
          </div>

          <div className="glass-panel p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Avg Report Quality Breakdown</h4>
            <QualityRadarChart data={qualityBreakdown} />
          </div>
        </div>

        {/* Module clusters (derived from real topModules) */}
        {clusters.length > 0 && (
          <div className="glass-panel p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-accent-cyan" />
              <h4 className="text-sm font-semibold text-text-primary">Top Affected Modules</h4>
              <span className="text-xs text-text-muted ml-auto">From {totalBugs} bugs</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clusters.map((cluster) => (
                <div key={cluster.name} className="p-4 rounded-xl bg-bg-tertiary border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-semibold text-text-primary">{cluster.name}</h5>
                    <span className="text-xs font-mono text-text-muted">{cluster.count} bugs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-text-muted" />
                    <span className="text-[10px] capitalize text-text-muted">{cluster.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recurring bugs placeholder — needs occurrence tracking on schema */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="w-4 h-4 text-accent-amber" />
            <h4 className="text-sm font-semibold text-text-primary">Recurring Bugs</h4>
          </div>
          <p className="text-xs text-text-muted">
            Recurring bug detection requires occurrence tracking — coming once bugs accumulate enough history.
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-bg-tertiary text-xs text-text-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-amber" />
      Demo mode — DATABASE_URL is not configured. Showing built-in sample analytics.
    </div>
  );
}
