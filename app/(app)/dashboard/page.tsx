'use client';

import { useState, useEffect } from 'react';
import { Bug, AlertTriangle, CheckCircle, Gauge, TrendingUp, TrendingDown, ArrowRight, Sparkles, FolderOpen, Plus } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import BugListItem from '@/components/BugListItem';
import { BugTrendChart, ModuleBarChart, Sparkline } from '@/components/charts/BugCharts';
import { CardSkeleton } from '@/components/ui/Loading';
import { mockDashboardStats, mockBugs } from '@/lib/utils/mockData';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { DashboardStats } from '@/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState('All Projects');

  useEffect(() => {
    const timer = setTimeout(() => {
      setStats(mockDashboardStats);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const statCards = stats ? [
    { label: 'Total Bugs', value: stats.totalBugs, icon: Bug, color: 'text-accent-blue', bgColor: 'bg-accent-blue/10', trend: '+12%', trendUp: true, sparkData: [3, 7, 5, 8, 12, 9, 15], sparkColor: '#60a5fa' },
    { label: 'Critical', value: stats.criticalBugs, icon: AlertTriangle, color: 'text-severity-critical', bgColor: 'bg-severity-critical/10', trend: '-3%', trendUp: false, sparkData: [6, 4, 5, 3, 4, 2, 3], sparkColor: '#ef4444' },
    { label: 'Resolved', value: stats.resolvedBugs, icon: CheckCircle, color: 'text-accent-emerald', bgColor: 'bg-accent-emerald/10', trend: '+8%', trendUp: true, sparkData: [4, 6, 5, 8, 7, 9, 11], sparkColor: '#34d399' },
    { label: 'Avg Quality', value: stats.avgQualityScore.toFixed(1), icon: Gauge, color: 'text-accent-amber', bgColor: 'bg-accent-amber/10', trend: '+5%', trendUp: true, sparkData: [65, 68, 70, 72, 74, 75, 76], sparkColor: '#fbbf24' },
  ] : [];

  return (
    <div className="min-h-screen">
      <TopBar title="Dashboard" subtitle="Bug intelligence overview" />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Project Selector + Welcome */}
        <div className="glass-panel gradient-border p-6 relative overflow-hidden">
          <div className="absolute inset-0 dot-pattern opacity-50" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary mb-1">
                Welcome to <span className="text-gradient">BugSense AI</span>
              </h1>
              <p className="text-sm text-text-secondary">AI-powered defect intelligence for modern QA teams</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={currentProject}
                onChange={(e) => setCurrentProject(e.target.value)}
                className="bg-bg-tertiary border border-border rounded-xl px-3 py-2 text-sm text-text-primary outline-none"
              >
                <option>All Projects</option>
                <option>E-Commerce Platform</option>
                <option>Mobile App v2</option>
                <option>Admin Dashboard</option>
              </select>
              <Link href="/analyze" className="btn-primary">
                <Sparkles className="w-4 h-4" />
                Analyze Bug
              </Link>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? [1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)
            : statCards.map((card) => (
                <div key={card.label} className="stat-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', card.bgColor)}>
                      <card.icon className={cn('w-5 h-5', card.color)} />
                    </div>
                    <div className={cn('flex items-center gap-1 text-xs font-medium', card.trendUp ? 'text-accent-emerald' : 'text-accent-coral')}>
                      {card.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {card.trend}
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-text-primary font-mono">{card.value}</p>
                  <p className="text-xs text-text-muted mt-0.5">{card.label}</p>
                  <div className="mt-3">
                    <Sparkline data={card.sparkData} color={card.sparkColor} height={32} />
                  </div>
                </div>
              ))}
        </div>

        {/* Charts Row - Full width trend + Module chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Bug Trend</h3>
              <span className="text-xs text-text-muted">Last 7 days</span>
            </div>
            {stats ? (
              <BugTrendChart data={stats.trendData} />
            ) : (
              <div className="h-[240px] bg-bg-tertiary rounded-xl animate-pulse" />
            )}
          </div>
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Top Affected Modules</h3>
              <Link href="/analytics" className="text-xs text-accent-blue hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {stats ? (
              <ModuleBarChart data={stats.topModules} />
            ) : (
              <div className="h-[240px] bg-bg-tertiary rounded-xl animate-pulse" />
            )}
          </div>
        </div>

        {/* Recent Bugs */}
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Recent Bugs</h3>
            <Link href="/bugs" className="text-xs text-accent-blue hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {(stats?.recentBugs || mockBugs.slice(0, 5)).map((bug) => (
              <BugListItem key={bug.id} bug={bug} compact />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
