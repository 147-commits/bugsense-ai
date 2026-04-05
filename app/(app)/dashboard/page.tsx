'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bug, AlertTriangle, CheckCircle, Gauge, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import { BugTrendChart, ModuleBarChart } from '@/components/charts/BugCharts';
import { useAppStore } from '@/lib/hooks/useStore';
import { cn, severityColor, formatTimeAgo } from '@/lib/utils';
import Link from 'next/link';
import type { DashboardStats } from '@/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentProject } = useAppStore();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const url = currentProject
        ? `/api/bugs/stats?projectId=${currentProject.id}`
        : '/api/bugs/stats';
      const res = await fetch(url);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [currentProject]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const statCards = stats ? [
    { label: 'Total Bugs', value: stats.totalBugs, icon: Bug, trend: '+12%', trendUp: true },
    { label: 'Critical', value: stats.criticalBugs, icon: AlertTriangle, trend: '-3%', trendUp: false },
    { label: 'Resolved', value: stats.resolvedBugs, icon: CheckCircle, trend: '+8%', trendUp: true },
    { label: 'Avg Quality', value: stats.avgQualityScore?.toFixed?.(1) ?? '—', icon: Gauge, trend: '+5%', trendUp: true },
  ] : [];

  return (
    <div className="min-h-screen">
      <TopBar title="Dashboard" />

      <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {loading
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-panel p-5 h-24 animate-pulse" />
              ))
            : statCards.map((card) => (
                <div key={card.label} className="glass-panel p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center">
                      <card.icon className="w-4 h-4 text-text-muted" />
                    </div>
                    <span className={cn('flex items-center gap-1 text-xs font-medium', card.trendUp ? 'text-severity-low' : 'text-severity-critical')}>
                      {card.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {card.trend}
                    </span>
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
            ) : (
              <div className="h-[240px] bg-bg-tertiary rounded-lg animate-pulse" />
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
            ) : (
              <div className="h-[240px] bg-bg-tertiary rounded-lg animate-pulse" />
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
            {stats?.recentBugs && stats.recentBugs.length > 0 ? (
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
              <div className="px-5 py-8 text-center text-sm text-text-muted">
                {loading ? 'Loading...' : 'No bugs yet. Use the Bug Analyzer to create your first report.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
