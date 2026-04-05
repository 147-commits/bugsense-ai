'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Search, User, Menu, LogOut, ChevronDown, Plus, Check } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useAppStore } from '@/lib/hooks/useStore';
import { ProjectSummary } from '@/types';
import Link from 'next/link';

export default function TopBar({ title }: { title: string; subtitle?: string }) {
  const { searchQuery, setSearchQuery, toggleSidebar, projects, setProjects, currentProject, setCurrentProject } = useAppStore();
  const { data: session } = useSession();
  const user = session?.user;

  const [menuOpen, setMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data: ProjectSummary[] = await res.json();
      setProjects(data);
      if (!currentProject && data.length > 0) {
        const lastId = localStorage.getItem('bugsense-current-project');
        const restored = lastId ? data.find((p) => p.id === lastId) : null;
        setCurrentProject(restored ?? data[0]);
      }
    } catch { /* silently fail */ }
  }, [setProjects, currentProject, setCurrentProject]);

  useEffect(() => {
    if (session?.user) fetchProjects();
  }, [session?.user, fetchProjects]);

  function selectProject(project: ProjectSummary) {
    setCurrentProject(project);
    localStorage.setItem('bugsense-current-project', project.id);
    setProjectMenuOpen(false);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) setProjectMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="h-14 border-b border-border bg-bg-secondary flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Project switcher */}
        <div className="relative" ref={projectMenuRef}>
          <button
            onClick={() => setProjectMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            <span className="text-sm text-text-secondary truncate max-w-[140px]">
              {currentProject?.name ?? 'No project'}
            </span>
            <ChevronDown className={`w-3 h-3 text-text-muted transition-transform duration-150 ${projectMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {projectMenuOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-bg-secondary border border-border rounded-lg shadow-xl shadow-black/30 py-1 z-50">
              <div className="px-3 py-1.5 border-b border-border">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Switch project</p>
              </div>

              {projects.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-sm text-text-muted mb-2">No projects yet</p>
                  <Link href="/projects" onClick={() => setProjectMenuOpen(false)} className="text-xs text-accent hover:underline">
                    Create your first project
                  </Link>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto py-1">
                  {projects.map((project) => {
                    const isSelected = currentProject?.id === project.id;
                    return (
                      <button
                        key={project.id}
                        onClick={() => selectProject(project)}
                        className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-left transition-colors ${
                          isSelected ? 'bg-bg-tertiary text-text-primary' : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{project.name}</p>
                          <p className="text-[10px] text-text-muted">{project._count.bugReports} bugs</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-border pt-1">
                <Link
                  href="/projects"
                  onClick={() => setProjectMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Manage projects
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:block w-px h-5 bg-border" />

        <h2 className="hidden sm:block text-sm font-semibold text-text-primary">{title}</h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-bg-tertiary rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none w-40"
          />
          <kbd className="hidden lg:inline text-[10px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border font-mono">
            ⌘K
          </kbd>
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            <Avatar src={user?.image} initials={initials} />
            <ChevronDown className={`w-3 h-3 text-text-muted transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-bg-secondary border border-border rounded-lg shadow-xl shadow-black/30 py-1 z-50">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium text-text-primary truncate">{user?.name ?? 'Signed in'}</p>
                <p className="text-xs text-text-muted truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Avatar({ src, initials }: { src?: string | null; initials: string }) {
  if (src) {
    return (
      <Image src={src} alt="Avatar" width={28} height={28} className="w-7 h-7 rounded-full object-cover" />
    );
  }

  return (
    <span className="w-7 h-7 rounded-full bg-bg-tertiary border border-border flex items-center justify-center text-text-secondary text-xs font-medium select-none">
      {initials && initials !== '?' ? initials : <User className="w-3.5 h-3.5 text-text-muted" />}
    </span>
  );
}
