'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, Layers, Repeat, Target, Zap } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import { BugTrendChart, SeverityPieChart, ModuleBarChart, QualityRadarChart } from '@/components/charts/BugCharts';
import { mockDashboardStats, mockBugs } from '@/lib/utils/mockData';
import { cn, severityColor } from '@/lib/utils';

export default function AnalyticsPage() {
  const stats = mockDashboardStats;
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  // Compute analytics
  const moduleFrequency = stats.topModules;
  const severityCounts = stats.severityDistribution;
  const totalBugs = stats.totalBugs;
  const resolveRate = ((stats.resolvedBugs / totalBugs) * 100).toFixed(1);

  // Mock cluster data
  const clusters = [
    { name: 'Authentication Issues', count: 14, bugs: ['SSO crashes', 'Token expiry', 'Session timeout'], trend: 'increasing' },
    { name: 'Payment Processing', count: 11, bugs: ['Currency mismatch', 'Checkout errors', 'Refund failures'], trend: 'stable' },
    { name: 'Data Display Gaps', count: 8, bugs: ['Chart empty state', 'Stale cache', 'Timezone issues'], trend: 'decreasing' },
    { name: 'File Operations', count: 6, bugs: ['Upload failures', 'Size limits', 'Format errors'], trend: 'increasing' },
  ];

  // Mock recurring bugs
  const recurringBugs = [
    { title: 'Session timeout on idle', occurrences: 7, lastSeen: '2 days ago', module: 'Authentication' },
    { title: 'CSV export encoding issue', occurrences: 5, lastSeen: '5 days ago', module: 'Data Export' },
    { title: 'Search index lag', occurrences: 4, lastSeen: '1 week ago', module: 'Search' },
    { title: 'Mobile layout break at 375px', occurrences: 3, lastSeen: '3 days ago', module: 'Responsive' },
  ];

  const qualityBreakdown = {
    clarity: 76,
    reproducibility: 72,
    completeness: 68,
    technicalDetail: 64,
    actionability: 80,
  };

  return (
    <div className="min-h-screen">
      <TopBar title="QA Insights" subtitle="Defect pattern analysis & intelligence" />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Time Range Selector */}
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
                  timeRange === range ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-secondary'
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
            { label: 'Avg Quality Score', value: stats.avgQualityScore.toFixed(1), icon: Zap, color: 'accent-amber' },
            { label: 'Duplicate Rate', value: '12.4%', icon: Repeat, color: 'accent-violet' },
            { label: 'Active Clusters', value: clusters.length.toString(), icon: Layers, color: 'accent-cyan' },
          ].map((m) => (
            <div key={m.label} className="stat-card">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', `bg-${m.color}/10`)}>
                <m.icon className={cn('w-4 h-4', `text-${m.color}`)} />
              </div>
              <p className="text-xl font-bold text-text-primary font-mono">{m.value}</p>
              <p className="text-xs text-text-muted">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Trend */}
          <div className="glass-panel p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Bug Trend</h4>
            <BugTrendChart data={stats.trendData} />
          </div>

          {/* Severity */}
          <div className="glass-panel p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Severity Distribution</h4>
            <SeverityPieChart data={severityCounts} />
          </div>

          {/* Module Heatmap */}
          <div className="glass-panel p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Module Defect Heatmap</h4>
            <ModuleBarChart data={moduleFrequency} />
          </div>

          {/* Quality Radar */}
          <div className="glass-panel p-6">
            <h4 className="text-sm font-semibold text-text-primary mb-4">Avg Report Quality Breakdown</h4>
            <QualityRadarChart data={qualityBreakdown} />
          </div>
        </div>

        {/* Bug Clusters */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-accent-cyan" />
            <h4 className="text-sm font-semibold text-text-primary">AI Bug Clusters</h4>
            <span className="text-xs text-text-muted ml-auto">Auto-grouped by AI similarity</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clusters.map((cluster) => (
              <div key={cluster.name} className="p-4 rounded-xl bg-bg-tertiary border border-border hover:border-border-light transition-all">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-semibold text-text-primary">{cluster.name}</h5>
                  <span className="text-xs font-mono text-text-muted">{cluster.count} bugs</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {cluster.bugs.map((b) => (
                    <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-bg-hover text-text-secondary">{b}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className={cn('w-3 h-3', cluster.trend === 'increasing' ? 'text-accent-coral' : cluster.trend === 'decreasing' ? 'text-accent-emerald' : 'text-text-muted')} />
                  <span className={cn('text-[10px] capitalize', cluster.trend === 'increasing' ? 'text-accent-coral' : cluster.trend === 'decreasing' ? 'text-accent-emerald' : 'text-text-muted')}>
                    {cluster.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recurring Bugs */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="w-4 h-4 text-accent-amber" />
            <h4 className="text-sm font-semibold text-text-primary">Recurring Bugs</h4>
          </div>
          <div className="space-y-2">
            {recurringBugs.map((bug) => (
              <div key={bug.title} className="flex items-center gap-4 p-3 rounded-xl bg-bg-tertiary hover:bg-bg-hover transition-colors">
                <div className="w-10 h-10 rounded-lg bg-accent-amber/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-accent-amber font-mono">{bug.occurrences}x</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{bug.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-text-muted">{bug.module}</span>
                    <span className="text-[10px] text-text-muted">Last: {bug.lastSeen}</span>
                  </div>
                </div>
                <div className="h-1.5 w-24 bg-bg-primary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-amber rounded-full"
                    style={{ width: `${(bug.occurrences / 7) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
