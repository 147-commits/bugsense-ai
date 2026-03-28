'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import {
  FolderOpen, Bug, FileText, Globe, Code2, ClipboardList,
  ScrollText, BookOpen, Settings, ChevronDown, ChevronRight,
  X, Eye, Clock, Sparkles, Tag, Users, Shield, Database,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  techStack: string[];
  _count: { bugReports: number; members: number };
}

interface BugReportItem {
  id: string;
  title: string;
  description: string;
  rawInput: string;
  severity: string;
  priority: string;
  status: string;
  qualityScore: number | null;
  stepsToReproduce: string[];
  rootCauseHypotheses: string[];
  affectedModules: string[];
  aiAnalysis: unknown;
  createdAt: string;
  testCases: { id: string; title: string }[];
}

interface GeneratedItem {
  id: string;
  type: string;
  input: string;
  output: unknown;
  framework: string | null;
  language: string | null;
  createdAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',         label: 'All Activity',  icon: Clock },
  { id: 'bugs',        label: 'Bugs',          icon: Bug },
  { id: 'testgen',     label: 'Test Cases',    icon: FileText },
  { id: 'apitests',    label: 'API Tests',     icon: Globe },
  { id: 'automation',  label: 'Automation',    icon: Code2 },
  { id: 'documents',   label: 'Documents',     icon: BookOpen },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TYPE_META: Record<string, { label: string; color: string }> = {
  analyze:      { label: 'Bug Analysis',     color: 'text-accent-coral' },
  testgen:      { label: 'Test Cases',       color: 'text-accent-blue' },
  apitests:     { label: 'API Tests',        color: 'text-accent-cyan' },
  automation:   { label: 'Automation',       color: 'text-accent-violet' },
  testdata:     { label: 'Test Data',        color: 'text-accent-amber' },
  testplan:     { label: 'Test Plan',        color: 'text-accent-emerald' },
  releasenotes: { label: 'Release Notes',    color: 'text-accent-blue' },
  qadocs:       { label: 'QA Documents',     color: 'text-accent-violet' },
  coverage:     { label: 'Coverage',         color: 'text-accent-cyan' },
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-severity-critical/15 text-severity-critical border-severity-critical/20',
  HIGH:     'bg-accent-coral/15 text-accent-coral border-accent-coral/20',
  MEDIUM:   'bg-accent-amber/15 text-accent-amber border-accent-amber/20',
  LOW:      'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/20',
  INFO:     'bg-accent-blue/15 text-accent-blue border-accent-blue/20',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:        'bg-accent-blue/15 text-accent-blue',
  IN_PROGRESS: 'bg-accent-amber/15 text-accent-amber',
  RESOLVED:    'bg-accent-emerald/15 text-accent-emerald',
  CLOSED:      'bg-bg-tertiary text-text-muted',
  DUPLICATE:   'bg-accent-violet/15 text-accent-violet',
};

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [bugs, setBugs] = useState<BugReportItem[]>([]);
  const [generated, setGenerated] = useState<GeneratedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewModal, setViewModal] = useState<{ input: string; output: unknown; type: string } | null>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/content`);
      if (!res.ok) {
        if (res.status === 404) router.push('/projects');
        return;
      }
      const data = await res.json();
      setProject(data.project);
      setBugs(data.bugReports);
      setGenerated(data.generatedContent);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  // ── Filtered items ──────────────────────────────────────────────────────────

  const docTypes = ['testplan', 'releasenotes', 'qadocs'];

  const filteredGenerated = tab === 'all'
    ? generated
    : tab === 'bugs'
      ? []
      : tab === 'documents'
        ? generated.filter((g) => docTypes.includes(g.type))
        : generated.filter((g) => g.type === tab);

  const filteredBugs = tab === 'all' || tab === 'bugs' ? bugs : [];

  // Merge for "all" tab
  type TimelineItem = { id: string; kind: 'bug' | 'gen'; createdAt: string; data: BugReportItem | GeneratedItem };
  const timeline: TimelineItem[] = [
    ...filteredBugs.map((b) => ({ id: b.id, kind: 'bug' as const, createdAt: b.createdAt, data: b })),
    ...filteredGenerated.map((g) => ({ id: g.id, kind: 'gen' as const, createdAt: g.createdAt, data: g })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalGenerations = generated.length;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Project" subtitle="Loading…" />
        <div className="p-6 max-w-[1200px] mx-auto">
          <div className="glass-panel p-12 animate-pulse h-48" />
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="glass-panel p-6 animate-pulse h-20" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen">
        <TopBar title="Project" subtitle="Not found" />
        <div className="p-6 text-center">
          <p className="text-text-muted">Project not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title={project.name} subtitle={`/${project.slug}`} />

      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="glass-panel gradient-border p-6 relative overflow-hidden">
          <div className="absolute inset-0 dot-pattern opacity-30" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-violet/20 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-6 h-6 text-accent-blue" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-text-primary truncate">{project.name}</h1>
                  {project.description && (
                    <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">{project.description}</p>
                  )}
                </div>
              </div>
              <Link
                href="/projects"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors flex-shrink-0"
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </Link>
            </div>

            {/* Tech stack */}
            {project.techStack.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {project.techStack.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-[11px] font-medium"
                  >
                    <Tag className="w-2.5 h-2.5" /> {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 text-sm">
                <Bug className="w-4 h-4 text-accent-coral" />
                <span className="font-semibold text-text-primary">{project._count.bugReports}</span>
                <span className="text-text-muted text-xs">bugs</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Sparkles className="w-4 h-4 text-accent-amber" />
                <span className="font-semibold text-text-primary">{totalGenerations}</span>
                <span className="text-text-muted text-xs">generations</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Users className="w-4 h-4 text-accent-blue" />
                <span className="font-semibold text-text-primary">{project._count.members}</span>
                <span className="text-text-muted text-xs">members</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const count =
              t.id === 'all' ? timeline.length
              : t.id === 'bugs' ? bugs.length
              : t.id === 'documents' ? generated.filter((g) => docTypes.includes(g.type)).length
              : generated.filter((g) => g.type === t.id).length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
                  tab === t.id
                    ? 'bg-accent-blue/15 text-accent-blue'
                    : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-md font-mono',
                  tab === t.id ? 'bg-accent-blue/20' : 'bg-bg-tertiary'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {timeline.length === 0 && (
          <div className="glass-panel p-12 text-center">
            <Sparkles className="w-10 h-10 text-text-muted mx-auto mb-4" />
            <h3 className="text-base font-semibold text-text-primary mb-2">No content yet</h3>
            <p className="text-sm text-text-muted">Use the AI generators with this project selected to see results here.</p>
          </div>
        )}

        {timeline.length > 0 && (
          <div className="space-y-2">
            {timeline.map((item) =>
              item.kind === 'bug' ? (
                <BugRow
                  key={item.id}
                  bug={item.data as BugReportItem}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onViewFull={(bug) => setViewModal({ input: bug.rawInput, output: bug, type: 'analyze' })}
                />
              ) : (
                <GeneratedRow
                  key={item.id}
                  item={item.data as GeneratedItem}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onViewFull={(g) => setViewModal({ input: g.input, output: g.output, type: g.type })}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* ── View Full Result Modal ─────────────────────────────────────── */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewModal(null)}>
          <div className="glass-panel-elevated w-full max-w-3xl max-h-[80vh] flex flex-col animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-semibold', TYPE_META[viewModal.type]?.color ?? 'text-text-primary')}>
                  {TYPE_META[viewModal.type]?.label ?? viewModal.type}
                </span>
              </div>
              <button onClick={() => setViewModal(null)} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Input</p>
                <pre className="text-xs text-text-secondary bg-bg-tertiary rounded-xl p-3 whitespace-pre-wrap break-words max-h-40 overflow-y-auto border border-border">
                  {viewModal.input}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Output</p>
                <pre className="text-xs text-text-secondary bg-bg-tertiary rounded-xl p-3 whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto border border-border">
                  {typeof viewModal.output === 'string' ? viewModal.output : JSON.stringify(viewModal.output, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bug Row ──────────────────────────────────────────────────────────────────

function BugRow({
  bug,
  expanded,
  onToggle,
  onViewFull,
}: {
  bug: BugReportItem;
  expanded: boolean;
  onToggle: () => void;
  onViewFull: (bug: BugReportItem) => void;
}) {
  return (
    <div className="glass-panel overflow-hidden">
      {/* Summary row */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-bg-hover/50 transition-colors">
        <ChevronRight className={cn('w-4 h-4 text-text-muted transition-transform flex-shrink-0', expanded && 'rotate-90')} />
        <Bug className="w-4 h-4 text-accent-coral flex-shrink-0" />
        <span className="flex-1 text-sm font-medium text-text-primary truncate">{bug.title}</span>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-md border font-medium flex-shrink-0', SEVERITY_COLORS[bug.severity] ?? 'bg-bg-tertiary text-text-muted')}>
          {bug.severity}
        </span>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium flex-shrink-0', STATUS_COLORS[bug.status] ?? 'bg-bg-tertiary text-text-muted')}>
          {bug.status.replace('_', ' ')}
        </span>
        {bug.qualityScore != null && (
          <span className="text-[10px] font-mono text-text-muted flex-shrink-0">
            Q: {Math.round(bug.qualityScore * 100)}%
          </span>
        )}
        <span className="text-[10px] text-text-muted flex-shrink-0 hidden sm:block">{formatTimeAgo(bug.createdAt)}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-3 bg-bg-tertiary/30">
          <p className="text-xs text-text-secondary">{bug.description}</p>

          {bug.stepsToReproduce.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1">Steps to Reproduce</p>
              <ol className="list-decimal list-inside space-y-0.5">
                {bug.stepsToReproduce.map((s, i) => <li key={i} className="text-xs text-text-secondary">{s}</li>)}
              </ol>
            </div>
          )}

          {bug.affectedModules.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {bug.affectedModules.map((m) => (
                <span key={m} className="text-[10px] px-2 py-0.5 rounded-md bg-bg-tertiary text-text-muted border border-border">{m}</span>
              ))}
            </div>
          )}

          {bug.testCases.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1">Test Cases ({bug.testCases.length})</p>
              {bug.testCases.map((tc) => (
                <p key={tc.id} className="text-xs text-text-secondary">• {tc.title}</p>
              ))}
            </div>
          )}

          <button
            onClick={() => onViewFull(bug)}
            className="flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> View Full Result
          </button>
        </div>
      )}
    </div>
  );
}

// ── Generated Content Row ────────────────────────────────────────────────────

function GeneratedRow({
  item,
  expanded,
  onToggle,
  onViewFull,
}: {
  item: GeneratedItem;
  expanded: boolean;
  onToggle: () => void;
  onViewFull: (item: GeneratedItem) => void;
}) {
  const meta = TYPE_META[item.type] ?? { label: item.type, color: 'text-text-muted' };

  // Try to extract a count from the output
  let countLabel = '';
  if (item.output && typeof item.output === 'object') {
    const out = item.output as Record<string, unknown>;
    if (Array.isArray(out.testCases)) countLabel = `${out.testCases.length} cases`;
    else if (Array.isArray(out.tests)) countLabel = `${out.tests.length} tests`;
    else if (Array.isArray(out.scripts)) countLabel = `${out.scripts.length} scripts`;
  }

  return (
    <div className="glass-panel overflow-hidden">
      {/* Summary row */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-bg-hover/50 transition-colors">
        <ChevronRight className={cn('w-4 h-4 text-text-muted transition-transform flex-shrink-0', expanded && 'rotate-90')} />
        <Sparkles className={cn('w-4 h-4 flex-shrink-0', meta.color)} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-text-primary truncate block">{truncate(item.input, 80)}</span>
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium flex-shrink-0', `${meta.color.replace('text-', 'bg-')}/15 ${meta.color}`)}>
          {meta.label}
        </span>
        {item.framework && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border flex-shrink-0">
            {item.framework}
          </span>
        )}
        {countLabel && (
          <span className="text-[10px] font-mono text-text-muted flex-shrink-0">{countLabel}</span>
        )}
        <span className="text-[10px] text-text-muted flex-shrink-0 hidden sm:block">{formatTimeAgo(item.createdAt)}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-3 bg-bg-tertiary/30">
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1">Input</p>
            <p className="text-xs text-text-secondary whitespace-pre-wrap">{truncate(item.input, 300)}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1">Output Preview</p>
            <pre className="text-xs text-text-secondary bg-bg-tertiary rounded-xl p-3 whitespace-pre-wrap break-words max-h-48 overflow-y-auto border border-border">
              {typeof item.output === 'string'
                ? truncate(item.output, 500)
                : truncate(JSON.stringify(item.output, null, 2), 500)}
            </pre>
          </div>

          <button
            onClick={() => onViewFull(item)}
            className="flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> View Full Result
          </button>
        </div>
      )}
    </div>
  );
}
