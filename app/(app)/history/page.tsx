'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { useAppStore } from '@/lib/hooks/useStore';
import {
  Search, Bug, FileText, Globe, Code2, Database,
  ClipboardList, ScrollText, BookOpen, Shield, Eye, X,
  Clock, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_META: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  analyze:      { label: 'Bug Analysis',      icon: Bug,           color: 'text-accent-coral' },
  testgen:      { label: 'Test Cases',         icon: FileText,      color: 'text-accent-blue' },
  apitests:     { label: 'API Tests',          icon: Globe,         color: 'text-accent-cyan' },
  automation:   { label: 'Automation',         icon: Code2,         color: 'text-accent-violet' },
  testdata:     { label: 'Test Data',          icon: Database,      color: 'text-accent-amber' },
  testplan:     { label: 'Test Plan',          icon: ClipboardList, color: 'text-accent-emerald' },
  releasenotes: { label: 'Release Notes',      icon: ScrollText,    color: 'text-accent-blue' },
  qadocs:       { label: 'QA Documents',       icon: BookOpen,      color: 'text-accent-violet' },
  coverage:     { label: 'Coverage Expander',  icon: Shield,        color: 'text-accent-cyan' },
};

interface HistoryItem {
  id: string;
  kind: 'generated' | 'bug';
  type: string;
  input: string;
  output: unknown;
  framework: string | null;
  language: string | null;
  createdAt: string;
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + '…';
}

export default function HistoryPage() {
  const { currentProject } = useAppStore();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [viewItem, setViewItem] = useState<HistoryItem | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!currentProject?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/history?projectId=${currentProject.id}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  // Collect unique types present in results
  const activeTypes = Array.from(new Set(items.map((i) => i.type)));

  return (
    <div className="min-h-screen">
      <TopBar title="History" subtitle="Past generations & analyses" />

      <div className="p-6 max-w-[1200px] mx-auto">
        {/* No project selected */}
        {!currentProject && (
          <div className="glass-panel p-12 text-center">
            <Sparkles className="w-10 h-10 text-text-muted mx-auto mb-4" />
            <h3 className="text-base font-semibold text-text-primary mb-2">No project selected</h3>
            <p className="text-sm text-text-muted">Select a project from the sidebar or top bar to view history.</p>
          </div>
        )}

        {currentProject && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  filter === 'all'
                    ? 'bg-accent-blue/15 text-accent-blue'
                    : 'bg-bg-tertiary text-text-muted hover:text-text-secondary'
                )}
              >
                All ({items.length})
              </button>
              {activeTypes.map((type) => {
                const meta = TYPE_META[type];
                if (!meta) return null;
                const count = items.filter((i) => i.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      filter === type
                        ? 'bg-accent-blue/15 text-accent-blue'
                        : 'bg-bg-tertiary text-text-muted hover:text-text-secondary'
                    )}
                  >
                    {meta.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Loading */}
            {loading && (
              <div className="glass-panel p-12 text-center">
                <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-text-muted">Loading history…</p>
              </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
              <div className="glass-panel p-12 text-center">
                <Clock className="w-10 h-10 text-text-muted mx-auto mb-4" />
                <h3 className="text-base font-semibold text-text-primary mb-2">No history yet</h3>
                <p className="text-sm text-text-muted">
                  {items.length === 0
                    ? 'Use the AI generators to create content for this project.'
                    : 'No results match the selected filter.'}
                </p>
              </div>
            )}

            {/* Results list */}
            {!loading && filtered.length > 0 && (
              <div className="space-y-2">
                {filtered.map((item) => {
                  const meta = TYPE_META[item.type] ?? { label: item.type, icon: Search, color: 'text-text-muted' };
                  const Icon = meta.icon;
                  return (
                    <div
                      key={item.id}
                      className="glass-panel p-4 flex items-center gap-4 group hover:border-accent-blue/20 transition-colors"
                    >
                      {/* Icon */}
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', `${meta.color.replace('text-', 'bg-')}/10`)}>
                        <Icon className={cn('w-4.5 h-4.5', meta.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn('text-xs font-semibold', meta.color)}>{meta.label}</span>
                          {item.framework && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border">
                              {item.framework}
                            </span>
                          )}
                          {item.kind === 'bug' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-coral/10 text-accent-coral border border-accent-coral/20">
                              {(item.output as Record<string, string>)?.severity ?? 'BUG'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-text-secondary truncate">
                          {item.kind === 'bug'
                            ? (item.output as Record<string, string>)?.title ?? truncate(item.input, 100)
                            : truncate(item.input, 100)}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <span className="text-[10px] text-text-muted flex-shrink-0 hidden sm:block">
                        {formatTimeAgo(item.createdAt)}
                      </span>

                      {/* View button */}
                      <button
                        onClick={() => setViewItem(item)}
                        className="flex-shrink-0 p-2 rounded-lg text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewItem(null)}>
          <div
            className="bg-bg-secondary border border-border rounded-lg shadow-xl shadow-black/20 w-full max-w-3xl max-h-[80vh] flex flex-col animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                {(() => {
                  const meta = TYPE_META[viewItem.type] ?? { label: viewItem.type, icon: Search, color: 'text-text-muted' };
                  const Icon = meta.icon;
                  return (
                    <>
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', `${meta.color.replace('text-', 'bg-')}/10`)}>
                        <Icon className={cn('w-4 h-4', meta.color)} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{meta.label}</h3>
                        <p className="text-[10px] text-text-muted">{new Date(viewItem.createdAt).toLocaleString()}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => setViewItem(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Input */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Input</p>
                <pre className="text-xs text-text-secondary bg-bg-tertiary rounded-xl p-3 whitespace-pre-wrap break-words max-h-40 overflow-y-auto border border-border">
                  {viewItem.input}
                </pre>
              </div>

              {/* Output */}
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Output</p>
                <pre className="text-xs text-text-secondary bg-bg-tertiary rounded-xl p-3 whitespace-pre-wrap break-words max-h-96 overflow-y-auto border border-border">
                  {typeof viewItem.output === 'string'
                    ? viewItem.output
                    : JSON.stringify(viewItem.output, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
