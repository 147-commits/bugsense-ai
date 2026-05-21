'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Filter, X, Bug } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import BugListItem from '@/components/BugListItem';
import BugAnalysisCard from '@/components/BugAnalysisCard';
import QAChat from '@/components/QAChat';
import { mockBugs } from '@/lib/utils/mockData';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/hooks/useStore';
import type { BugReport, Severity, BugStatus } from '@/types';

const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const statuses: BugStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE'];

type BugsResponse = {
  bugs: BugReport[];
  total: number;
  demoMode?: boolean;
  jira?: { siteUrl: string } | null;
};

export default function BugsPage() {
  const { currentProject } = useAppStore();
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<Severity | ''>('');
  const [filterStatus, setFilterStatus] = useState<BugStatus | ''>('');
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [jiraSiteUrl, setJiraSiteUrl] = useState<string | undefined>(undefined);
  const [syncingBugId, setSyncingBugId] = useState<string | null>(null);

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentProject) params.set('projectId', currentProject.id);
      const url = params.toString() ? `/api/bugs?${params}` : '/api/bugs';
      const res = await fetch(url);
      if (res.ok) {
        const data: BugsResponse = await res.json();
        setBugs(data.bugs ?? []);
        setDemoMode(Boolean(data.demoMode));
        setJiraSiteUrl(data.jira?.siteUrl);
      } else {
        setBugs(mockBugs);
        setDemoMode(true);
      }
    } catch {
      setBugs(mockBugs);
      setDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchBugs();
  }, [fetchBugs]);

  const filteredBugs = useMemo(() => {
    let result = bugs.slice();
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          (b.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
          (b.affectedModules ?? []).some((m) => m.toLowerCase().includes(q)),
      );
    }
    if (filterSeverity) result = result.filter((b) => b.severity === filterSeverity);
    if (filterStatus) result = result.filter((b) => b.status === filterStatus);
    return result;
  }, [search, filterSeverity, filterStatus, bugs]);

  const clearFilters = () => {
    setFilterSeverity('');
    setFilterStatus('');
    setSearch('');
  };

  const updateBugStatus = (bugId: string, newStatus: BugStatus) => {
    setBugs((prev) =>
      prev.map((b) =>
        b.id === bugId ? { ...b, status: newStatus, updatedAt: new Date().toISOString() } : b,
      ),
    );
    if (selectedBug?.id === bugId) {
      setSelectedBug((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const hasFilters = !!(search || filterSeverity || filterStatus);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bugs.forEach((b) => {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
    });
    return counts;
  }, [bugs]);

  return (
    <div className="min-h-screen">
      <TopBar title="Bug Database" subtitle={`${filteredBugs.length} of ${bugs.length} bugs`} />

      <div className="p-6 max-w-[1400px] mx-auto">
        {demoMode && <DemoBadge />}

        {/* Status Quick Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterStatus('')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              !filterStatus
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                : 'bg-bg-tertiary text-text-muted border border-border hover:text-text-secondary',
            )}
          >
            All ({bugs.length})
          </button>
          {statuses.map((s) => {
            const colors: Record<string, string> = {
              OPEN: 'accent-blue',
              IN_PROGRESS: 'accent-amber',
              RESOLVED: 'accent-emerald',
              CLOSED: 'text-muted',
              DUPLICATE: 'accent-violet',
            };
            const c = colors[s] || 'text-muted';
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filterStatus === s
                    ? `bg-${c}/15 text-${c} border border-${c}/30`
                    : 'bg-bg-tertiary text-text-muted border border-border hover:text-text-secondary',
                )}
              >
                {s.replace('_', ' ')} ({statusCounts[s] ?? 0})
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Bug List */}
          <div className={cn('space-y-4', selectedBug ? 'lg:col-span-2' : 'lg:col-span-5')}>
            <div className="glass-panel p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-bg-tertiary rounded-xl px-3 py-2.5 border border-border focus-within:border-accent-blue/40 transition-colors">
                  <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bugs by title, description, tags..."
                    className="bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none w-full"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="text-text-muted hover:text-text-primary">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn('btn-secondary px-3', showFilters && 'border-accent-blue/40 text-accent-blue')}
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>

              {showFilters && (
                <div className="flex flex-wrap gap-2 animate-slide-up">
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value as Severity | '')}
                    className="bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none"
                  >
                    <option value="">All Severities</option>
                    {severities.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {hasFilters && (
                    <button onClick={clearFilters} className="text-xs text-accent-coral hover:underline">
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="glass-panel p-12 text-center text-sm text-text-muted">Loading bugs…</div>
              ) : filteredBugs.length === 0 ? (
                <div className="glass-panel p-12 text-center">
                  <Bug className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">
                    {hasFilters ? 'No bugs match your filters' : 'No bugs found'}
                  </p>
                  {hasFilters && (
                    <button onClick={clearFilters} className="text-xs text-accent-blue hover:underline mt-2">
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                filteredBugs.map((bug) => (
                  <BugListItem
                    key={bug.id}
                    bug={bug}
                    onClick={() => setSelectedBug(bug)}
                    compact={!!selectedBug}
                    jiraSiteUrl={jiraSiteUrl}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: Detail View */}
          {selectedBug && (
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-secondary">Bug Details</h3>
                <div className="flex items-center gap-2">
                  {selectedBug.jiraLink?.jiraIssueKey && jiraSiteUrl && (
                    <a
                      href={`${jiraSiteUrl.replace(/\/$/, '')}/browse/${selectedBug.jiraLink.jiraIssueKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="badge bg-accent-violet/10 text-accent-violet text-[10px] inline-flex items-center gap-1"
                    >
                      {selectedBug.jiraLink.jiraIssueKey}
                    </a>
                  )}
                  <button
                    onClick={async () => {
                      setSyncingBugId(selectedBug.id);
                      try {
                        const res = await fetch(`/api/bugs/${selectedBug.id}/jira/sync`, { method: 'POST' });
                        if (res.ok) await fetchBugs();
                      } finally {
                        setSyncingBugId(null);
                      }
                    }}
                    disabled={syncingBugId === selectedBug.id}
                    className="btn-ghost text-xs disabled:opacity-50"
                  >
                    {syncingBugId === selectedBug.id ? 'Syncing…' : 'Sync to Jira'}
                  </button>
                  <select
                    value={selectedBug.status}
                    onChange={(e) => updateBugStatus(selectedBug.id, e.target.value as BugStatus)}
                    className="bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setSelectedBug(null)} className="btn-ghost text-xs">
                    <X className="w-3.5 h-3.5" /> Close
                  </button>
                </div>
              </div>
              <BugAnalysisCard
                bug={selectedBug}
                qualityScore={
                  selectedBug.qualityScore
                    ? {
                        score: selectedBug.qualityScore,
                        breakdown: {
                          clarity: 82,
                          reproducibility: 75,
                          completeness: 80,
                          technicalDetail: 70,
                          actionability: 83,
                        },
                        suggestions: [],
                      }
                    : undefined
                }
              />
              <QAChat bugId={selectedBug.id} bugTitle={selectedBug.title} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoBadge() {
  return (
    <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-bg-tertiary text-xs text-text-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-amber" />
      Demo mode — DATABASE_URL is not configured. Showing built-in sample bugs.
    </div>
  );
}
