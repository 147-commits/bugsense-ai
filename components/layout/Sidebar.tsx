'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Search, Bug, BarChart3, Settings,
  ChevronLeft, ChevronRight, Sparkles, Zap,
  FileText, Globe, ScrollText, Database, ClipboardList, Code2,
  BookOpen, Shield, FolderOpen, History,
} from 'lucide-react';
import { useAppStore } from '@/lib/hooks/useStore';
import { cn } from '@/lib/utils';

const navSections = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/projects', icon: FolderOpen, label: 'Projects' },
      { href: '/bugs', icon: Bug, label: 'Bug Database' },
      { href: '/analytics', icon: BarChart3, label: 'QA Insights' },
      { href: '/history', icon: History, label: 'History' },
    ],
  },
  {
    label: 'AI Generators',
    items: [
      { href: '/analyze', icon: Search, label: 'Bug Analyzer' },
      { href: '/testgen', icon: FileText, label: 'Test Cases' },
      { href: '/apitests', icon: Globe, label: 'API Tests' },
      { href: '/automation', icon: Code2, label: 'Automation' },
      { href: '/testdata', icon: Database, label: 'Test Data' },
      { href: '/testplan', icon: ClipboardList, label: 'Test Plan' },
      { href: '/releasenotes', icon: ScrollText, label: 'Release Notes' },
      { href: '/qadocs', icon: BookOpen, label: 'QA Documents' },
      { href: '/coverage', icon: Shield, label: 'Coverage Expander' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, currentProject } = useAppStore();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col',
        'bg-bg-secondary/95 backdrop-blur-xl border-r border-border',
        'transition-all duration-300 ease-out',
        sidebarOpen ? 'w-[240px]' : 'w-[72px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border flex-shrink-0">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-blue via-accent-violet to-accent-coral flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-accent-emerald rounded-full border-2 border-bg-secondary animate-pulse" />
        </div>
        {sidebarOpen && (
          <div className="animate-fade-in">
            <h1 className="text-sm font-bold tracking-tight text-text-primary">
              BugSense<span className="text-gradient"> AI</span>
            </h1>
            <p className="text-[10px] text-text-muted font-mono tracking-wider uppercase">
              QA Intelligence
            </p>
          </div>
        )}
      </div>

      {/* Current Project */}
      <Link
        href="/projects"
        className="mx-3 mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border hover:border-accent-blue/30 transition-all flex-shrink-0"
      >
        <div className="w-7 h-7 rounded-lg bg-accent-violet/15 flex items-center justify-center flex-shrink-0">
          <FolderOpen className={cn('w-3.5 h-3.5', currentProject ? 'text-accent-violet' : 'text-text-muted')} />
        </div>
        {sidebarOpen && (
          <div className="min-w-0 flex-1">
            <p className={cn('text-xs font-medium truncate', currentProject ? 'text-text-primary' : 'text-text-muted')}>
              {currentProject?.name ?? 'Select a Project'}
            </p>
            <p className="text-[10px] text-text-muted">
              {currentProject ? `${currentProject._count.bugReports} bugs` : 'No project selected'}
            </p>
          </div>
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            {sidebarOpen && (
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3 mb-2">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200',
                      'text-sm font-medium',
                      isActive
                        ? 'bg-bg-hover text-text-primary'
                        : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                    )}
                  >
                    <div
                      className={cn(
                        'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200',
                        isActive
                          ? 'bg-accent-blue/15 text-accent-blue'
                          : 'text-text-muted group-hover:text-text-secondary'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                    </div>
                    {sidebarOpen && <span className="truncate text-[13px]">{item.label}</span>}
                    {isActive && sidebarOpen && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-blue" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* AI Status */}
      {sidebarOpen && (
        <div className="mx-3 mb-3 p-3 rounded-xl bg-bg-tertiary border border-border flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-accent-amber" />
            <span className="text-xs font-medium text-text-primary">AI Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
            <span className="text-[10px] text-text-muted">AI Engine • Active</span>
          </div>
        </div>
      )}

      {/* Collapse */}
      <div className="px-3 pb-4 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-tertiary transition-all duration-200"
        >
          {sidebarOpen ? (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
