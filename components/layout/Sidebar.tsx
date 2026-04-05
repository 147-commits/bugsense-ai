'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Search, Bug, BarChart3, Settings,
  ChevronLeft, ChevronRight,
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
        'bg-bg-secondary border-r border-border',
        'transition-all duration-200',
        sidebarOpen ? 'w-[220px]' : 'w-[60px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">B</span>
        </div>
        {sidebarOpen && (
          <div>
            <span className="text-sm font-semibold text-text-primary tracking-tight">
              BugSense
            </span>
            <span className="ml-1 text-[10px] font-medium text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">
              AI
            </span>
          </div>
        )}
      </div>

      {/* Current Project */}
      <Link
        href="/projects"
        className="mx-2 mt-2 flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border hover:bg-bg-tertiary transition-colors flex-shrink-0"
      >
        <FolderOpen className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
        {sidebarOpen && (
          <div className="min-w-0 flex-1">
            <p className={cn('text-xs font-medium truncate', currentProject ? 'text-text-primary' : 'text-text-muted')}>
              {currentProject?.name ?? 'Select a Project'}
            </p>
            {currentProject && (
              <p className="text-[10px] text-text-muted">
                {currentProject._count.bugReports} bugs
              </p>
            )}
          </div>
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            {sidebarOpen && (
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider px-2.5 mb-1.5">
                {section.label}
              </p>
            )}
            <div className="space-y-px">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors duration-150',
                      isActive
                        ? 'bg-bg-tertiary text-text-primary font-medium'
                        : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-accent" />
                    )}
                    <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-text-primary' : 'text-text-muted')} />
                    {sidebarOpen && <span className="truncate text-[13px]">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse */}
      <div className="px-2 pb-3 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-tertiary transition-colors duration-150"
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
