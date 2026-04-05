'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import {
  FolderOpen, Plus, Pencil, Trash2, X, Check,
  Tag, FlaskConical, Bug, Users, Loader2, AlertCircle,
  ChevronRight, Code2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestConventions {
  framework: string;
  namingConvention: string;
  coverageTarget: number;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  techStack: string[];
  testConventions: TestConventions | null;
  createdAt: string;
  updatedAt: string;
  _count: { bugReports: number; members: number };
}

const FRAMEWORKS = [
  'Jest', 'Vitest', 'Playwright', 'Cypress', 'Puppeteer',
  'Pytest', 'JUnit', 'Mocha', 'Jasmine', 'Other',
];

const STACK_SUGGESTIONS = [
  'React', 'Next.js', 'Vue', 'Angular', 'Svelte',
  'Node.js', 'Python', 'Go', 'Rust', 'Java',
  'TypeScript', 'GraphQL', 'REST', 'PostgreSQL', 'MongoDB',
];

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-lg bg-bg-tertiary flex items-center justify-center mb-4">
        <FolderOpen className="w-8 h-8 text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">No projects yet</h3>
      <p className="text-sm text-text-muted mb-6 max-w-xs">
        Create your first project to organise bugs, test cases, and team members.
      </p>
      <button onClick={onNew} className="btn-primary">
        <Plus className="w-4 h-4" /> New Project
      </button>
    </div>
  );
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  suggestions,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions?.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s),
  ) ?? [];

  function add(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput('');
    setShowSugg(false);
    inputRef.current?.focus();
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      add(input);
    }
    if (e.key === 'Backspace' && !input && tags.length) {
      remove(tags[tags.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex flex-wrap gap-1.5 min-h-[44px] w-full bg-bg-tertiary border border-border rounded-xl px-3 py-2',
          'focus-within:border-accent-blue/50 focus-within:ring-2 focus-within:ring-accent-blue/10 transition-all duration-200 cursor-text',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent-blue/10 text-accent-blue text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(tag); }}
              className="hover:text-accent-rose transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSugg(true); }}
          onFocus={() => setShowSugg(true)}
          onBlur={() => setTimeout(() => setShowSugg(false), 120)}
          onKeyDown={onKey}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
        />
      </div>

      {showSugg && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-bg-secondary border border-border rounded-lg shadow-xl shadow-black/20 py-1 max-h-44 overflow-y-auto">
          {filtered.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); add(s); }}
              className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Project form (create / edit) ──────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  techStack: string[];
  framework: string;
  namingConvention: string;
  coverageTarget: number;
}

const BLANK: FormState = {
  name: '',
  description: '',
  techStack: [],
  framework: 'Jest',
  namingConvention: '',
  coverageTarget: 80,
};

function ProjectModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Project | null;
  onSave: (data: FormState) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const tc = initial?.testConventions;
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          name: initial.name,
          description: initial.description ?? '',
          techStack: initial.techStack,
          framework: tc?.framework ?? 'Jest',
          namingConvention: tc?.namingConvention ?? '',
          coverageTarget: tc?.coverageTarget ?? 80,
        }
      : BLANK,
  );

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const isEdit = !!initial;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg-primary/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-bg-secondary border border-border rounded-lg shadow-xl shadow-black/20 animate-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-accent-blue" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">
              {isEdit ? 'Edit project' : 'New project'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Project name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Customer Portal"
              className="input-field text-sm"
              disabled={saving}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="What does this project do?"
              rows={2}
              className="input-field text-sm resize-none"
              disabled={saving}
            />
          </div>

          {/* Tech stack */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <Tag className="w-3.5 h-3.5" /> Tech stack
            </label>
            <TagInput
              tags={form.techStack}
              onChange={(techStack) => set({ techStack })}
              suggestions={STACK_SUGGESTIONS}
              placeholder="React, Node.js, PostgreSQL…"
            />
            <p className="text-[10px] text-text-muted">Type a tag and press Enter or comma to add</p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold flex items-center gap-1">
              <FlaskConical className="w-3 h-3" /> Test conventions
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Test framework */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Test framework</label>
            <select
              value={form.framework}
              onChange={(e) => set({ framework: e.target.value })}
              className="input-field text-sm"
              disabled={saving}
            >
              {FRAMEWORKS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Naming convention */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Naming convention</label>
            <input
              value={form.namingConvention}
              onChange={(e) => set({ namingConvention: e.target.value })}
              placeholder='e.g. describe / it, test_snake_case'
              className="input-field text-sm font-mono"
              disabled={saving}
            />
          </div>

          {/* Coverage target */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-secondary">Coverage target</label>
              <span className="text-xs font-mono text-accent-blue">{form.coverageTarget}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.coverageTarget}
              onChange={(e) => set({ coverageTarget: Number(e.target.value) })}
              className="w-full accent-accent-blue"
              disabled={saving}
            />
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>0%</span><span>100%</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button
            onClick={(e) => { e.preventDefault(); submit(e as unknown as React.FormEvent); }}
            className="btn-primary"
            disabled={saving || !form.name.trim()}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEdit ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onEdit,
  onDelete,
  onClick,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tc = project.testConventions;

  return (
    <div
      onClick={onClick}
      className="glass-panel p-5 flex flex-col gap-4 group hover:border-border-light transition-all duration-200 cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-5 h-5 text-text-muted" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">{project.name}</h3>
            <p className="text-[11px] text-text-muted font-mono">/{project.slug}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onDelete}
                className="px-2 py-1 rounded-lg text-xs font-medium bg-severity-critical/10 text-severity-critical hover:bg-severity-critical/20 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 rounded-lg text-text-muted hover:bg-bg-hover transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-text-muted hover:text-severity-critical hover:bg-severity-critical/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
          {project.description}
        </p>
      )}

      {/* Tech stack tags */}
      {project.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.techStack.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-bg-tertiary border border-border text-[11px] text-text-secondary"
            >
              <Code2 className="w-2.5 h-2.5 text-text-muted" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Test conventions */}
      {tc && (
        <div className="rounded-xl bg-bg-tertiary px-3 py-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest flex items-center gap-1">
            <FlaskConical className="w-3 h-3" /> Test conventions
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-[10px] text-text-muted">Framework</p>
              <p className="text-xs text-text-primary font-medium">{tc.framework}</p>
            </div>
            {tc.namingConvention && (
              <div>
                <p className="text-[10px] text-text-muted">Naming</p>
                <p className="text-xs text-text-primary font-mono truncate">{tc.namingConvention}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-text-muted">Coverage target</p>
              <p className="text-xs text-text-primary font-mono">{tc.coverageTarget}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-text-muted">
            <Bug className="w-3 h-3" /> {project._count.bugReports} bugs
          </span>
          <span className="flex items-center gap-1 text-[11px] text-text-muted">
            <Users className="w-3 h-3" /> {project._count.members} members
          </span>
        </div>
        <span className="text-[10px] text-text-muted">
          Updated {formatTimeAgo(project.updatedAt)}
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      setProjects(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProjects(); }, []);

  // ── Create / Update ────────────────────────────────────────────────────────

  async function handleSave(form: FormState) {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        techStack: form.techStack,
        testConventions: {
          framework: form.framework,
          namingConvention: form.namingConvention,
          coverageTarget: form.coverageTarget,
        },
      };

      const isEdit = !!modal.project;
      const res = await fetch(
        isEdit ? `/api/projects/${modal.project!.id}` : '/api/projects',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error ?? 'Request failed');
      }

      const saved: Project = await res.json();

      setProjects((prev) =>
        isEdit
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev],
      );
      setModal({ open: false, project: null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <TopBar
        title="Projects"
        subtitle="Manage workspaces, tech stacks, and test conventions"
      />

      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        {/* Page header */}
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-text-muted" />
                Your projects
                <span className="ml-1 text-xs font-mono text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-lg">
                  {projects.length}
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Each project scopes bugs, test cases, and team access.
              </p>
            </div>
            <button
              onClick={() => setModal({ open: true, project: null })}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> New project
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-severity-critical/10 border border-severity-critical/20 text-severity-critical text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button
              className="ml-auto text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setError(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel p-5 h-52 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && !error && (
          <EmptyState onNew={() => setModal({ open: true, project: null })} />
        )}

        {/* Grid */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/projects/${project.id}`)}
                onEdit={() => setModal({ open: true, project })}
                onDelete={() => handleDelete(project.id)}
              />
            ))}

            {/* "Add another" ghost card */}
            <button
              onClick={() => setModal({ open: true, project: null })}
              className={cn(
                'glass-panel p-5 flex flex-col items-center justify-center gap-2 min-h-[160px]',
                'border-dashed text-text-muted hover:text-accent-blue hover:border-accent-blue/40',
                'transition-all duration-200 cursor-pointer',
              )}
            >
              <Plus className="w-6 h-6" />
              <span className="text-sm">Add project</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <ProjectModal
          initial={modal.project}
          onSave={handleSave}
          onClose={() => { if (!saving) setModal({ open: false, project: null }); }}
          saving={saving}
        />
      )}
    </div>
  );
}
