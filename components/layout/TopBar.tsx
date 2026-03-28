'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Bell, Search, User, Menu, LogOut, ChevronDown, FolderOpen, Plus, Check } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useAppStore } from '@/lib/hooks/useStore';
import { ProjectSummary } from '@/types';
import Link from 'next/link';

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { searchQuery, setSearchQuery, toggleSidebar, projects, setProjects, currentProject, setCurrentProject } = useAppStore();
  const { data: session } = useSession();
  const user = session?.user;

  const [menuOpen, setMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // Fetch projects on mount
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data: ProjectSummary[] = await res.json();
      setProjects(data);

      // Auto-select first project if none selected
      if (!currentProject && data.length > 0) {
        // Check localStorage for last used project
        const lastId = localStorage.getItem('bugsense-current-project');
        const restored = lastId ? data.find((p) => p.id === lastId) : null;
        setCurrentProject(restored ?? data[0]);
      }
    } catch {
      // silently fail
    }
  }, [setProjects, currentProject, setCurrentProject]);

  useEffect(() => {
    if (session?.user) fetchProjects();
  }, [session?.user, fetchProjects]);

  // Persist selection
  function selectProject(project: ProjectSummary) {
    setCurrentProject(project);
    localStorage.setItem('bugsense-current-project', project.id);
    setProjectMenuOpen(false);
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Derive initials from name or email
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="h-16 border-b border-border bg-bg-primary/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Project switcher */}
        <div className="relative" ref={projectMenuRef}>
          <button
            onClick={() => setProjectMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-bg-tertiary border border-transparent hover:border-border transition-all"
          >
            <div className="w-6 h-6 rounded-lg bg-accent-violet/15 flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-3.5 h-3.5 text-accent-violet" />
            </div>
            <span className="text-sm font-medium text-text-primary truncate max-w-[160px]">
              {currentProject?.name ?? 'No project'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${projectMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {projectMenuOpen && (
            <div className="absolute left-0 mt-2 w-72 glass-panel-elevated py-1.5 z-50 animate-in">
              <div className="px-3 py-2 mb-1 border-b border-border">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
                  Switch project
                </p>
              </div>

              {projects.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-sm text-text-muted mb-2">No projects yet</p>
                  <Link
                    href="/projects"
                    onClick={() => setProjectMenuOpen(false)}
                    className="text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
                  >
                    Create your first project
                  </Link>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto py-1">
                  {projects.map((project) => {
                    const isSelected = currentProject?.id === project.id;
                    return (
                      <button
                        key={project.id}
                        onClick={() => selectProject(project)}
                        className={`flex items-center gap-3 w-full px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'bg-bg-hover text-text-primary'
                            : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-accent-blue/15' : 'bg-bg-tertiary'
                        }`}>
                          <FolderOpen className={`w-3.5 h-3.5 ${isSelected ? 'text-accent-blue' : 'text-text-muted'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{project.name}</p>
                          <p className="text-[10px] text-text-muted">
                            {project._count.bugReports} bugs · {project._count.members} member{project._count.members !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-accent-blue flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-border mt-1 pt-1">
                <Link
                  href="/projects"
                  onClick={() => setProjectMenuOpen(false)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Manage projects
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-border" />

        {/* Page title */}
        <div className="hidden sm:block">
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-bg-tertiary rounded-xl px-3 py-2 border border-border focus-within:border-accent-blue/40 transition-colors">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search bugs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none w-48"
          />
          <kbd className="hidden lg:inline text-[10px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border font-mono">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-coral rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 p-1.5 pr-2 rounded-xl hover:bg-bg-tertiary transition-colors"
          >
            <Avatar src={user?.image} initials={initials} />
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 glass-panel-elevated py-1.5 z-50 animate-in">
              {/* Identity */}
              <div className="px-3 py-2 mb-1 border-b border-border">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user?.name ?? 'Signed in'}
                </p>
                <p className="text-xs text-text-muted truncate">{user?.email}</p>
              </div>

              {/* Sign out */}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary
                           hover:bg-bg-hover hover:text-severity-critical transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ src, initials }: { src?: string | null; initials: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt="Avatar"
        width={32}
        height={32}
        className="w-8 h-8 rounded-lg object-cover"
      />
    );
  }

  if (initials && initials !== '?') {
    return (
      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center text-white text-xs font-semibold select-none">
        {initials}
      </span>
    );
  }

  return (
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center">
      <User className="w-4 h-4 text-white" />
    </div>
  );
}
