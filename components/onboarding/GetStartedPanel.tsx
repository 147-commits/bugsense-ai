'use client';

import Link from 'next/link';
import { ArrowRight, Bug, FolderPlus, Users, Check } from 'lucide-react';
import type { ComponentType } from 'react';

interface Step {
  id: string;
  done: boolean;
  current: boolean;
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta: { label: string; href: string };
}

interface Props {
  hasProject: boolean;
  hasBug: boolean;
  hasTeammate: boolean;
}

/**
 * First-run welcome panel for the dashboard. Three sequential steps:
 *   1. Create a project
 *   2. Capture the first bug
 *   3. Invite a teammate (optional, dismissible)
 *
 * Rendered above the stat cards when the workspace is empty. Steps light up
 * green as the user completes them; the next undone step is highlighted as
 * the current focus.
 */
export default function GetStartedPanel({ hasProject, hasBug, hasTeammate }: Props) {
  const steps: Step[] = [
    {
      id: 'project',
      done: hasProject,
      current: !hasProject,
      icon: FolderPlus,
      title: 'Create your first project',
      body: 'A project is the container for bugs, test plans, and release readiness.',
      cta: { label: 'Create project', href: '/projects' },
    },
    {
      id: 'bug',
      done: hasBug,
      current: hasProject && !hasBug,
      icon: Bug,
      title: 'Capture your first bug',
      body: 'Paste a stack trace, log, or written description — the analyzer extracts severity, repro steps, and suggested fixes.',
      cta: { label: 'Open Bug Analyzer', href: '/bugs' },
    },
    {
      id: 'team',
      done: hasTeammate,
      current: hasProject && hasBug && !hasTeammate,
      icon: Users,
      title: 'Invite a teammate (optional)',
      body: 'Add a collaborator so triage and resolution are shared work.',
      cta: { label: 'Invite teammate', href: '/settings' },
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  return (
    <section
      aria-label="Get started"
      className="glass-panel p-6 border border-accent/20 bg-accent/[0.03]"
    >
      <header className="mb-5">
        <h2 className="text-lg font-semibold text-text-primary">Welcome to BugSense AI</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Three quick steps to get your workspace tracking bugs.
        </p>
      </header>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`flex items-start gap-3 rounded-lg p-3 border transition-colors ${
              step.done
                ? 'border-accent-emerald/20 bg-accent-emerald/[0.04]'
                : step.current
                  ? 'border-accent/30 bg-accent/5'
                  : 'border-border bg-bg-tertiary/30'
            }`}
          >
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                step.done
                  ? 'bg-accent-emerald text-bg-primary'
                  : step.current
                    ? 'bg-accent text-bg-primary'
                    : 'bg-bg-tertiary text-text-muted'
              }`}
              aria-hidden="true"
            >
              {step.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <step.icon className="w-3.5 h-3.5 text-text-secondary" />
                <h3 className="text-sm font-medium text-text-primary">{step.title}</h3>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{step.body}</p>
            </div>
            {!step.done && (
              <Link
                href={step.cta.href}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium ${
                  step.current
                    ? 'btn-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {step.cta.label}
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
