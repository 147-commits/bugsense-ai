'use client';

import { AlertTriangle, Clock, Tag, ChevronRight } from 'lucide-react';
import { cn, severityColor, severityDotColor, priorityLabel, formatTimeAgo, truncate } from '@/lib/utils';
import type { BugReport } from '@/types';

interface BugListItemProps {
  bug: BugReport;
  onClick?: () => void;
  compact?: boolean;
}

export default function BugListItem({ bug, onClick, compact = false }: BugListItemProps) {
  const statusColors: Record<string, string> = {
    OPEN: 'bg-accent-blue',
    IN_PROGRESS: 'bg-accent-amber',
    RESOLVED: 'bg-accent-emerald',
    CLOSED: 'bg-text-muted',
    DUPLICATE: 'bg-accent-violet',
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-bg-tertiary transition-all duration-200 text-left group"
      >
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', severityDotColor(bug.severity))} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate group-hover:text-accent-blue transition-colors">{bug.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-text-muted font-mono">{bug.id.slice(0, 8)}</span>
            <span className="text-[10px] text-text-muted">{formatTimeAgo(bug.createdAt)}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full glass-panel p-4 hover:bg-bg-elevated hover:border-border-light transition-all duration-200 text-left group"
    >
      <div className="flex items-start gap-3">
        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5', severityDotColor(bug.severity))} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-text-primary group-hover:text-accent-blue transition-colors">
              {bug.title}
            </h4>
            <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1', statusColors[bug.status] || 'bg-text-muted')} />
          </div>
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{bug.description}</p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={cn('badge text-[10px]', severityColor(bug.severity))}>{bug.severity}</span>
            <span className="badge bg-bg-hover text-text-muted border-border text-[10px]">{bug.priority}</span>
            <span className="badge bg-bg-hover text-text-muted border-border text-[10px] capitalize">{bug.status.toLowerCase().replace('_', ' ')}</span>

            {bug.qualityScore && (
              <span className={cn(
                'badge text-[10px]',
                bug.qualityScore >= 80 ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20'
                  : bug.qualityScore >= 60 ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/20'
                  : 'bg-accent-coral/10 text-accent-coral border-accent-coral/20'
              )}>
                QS: {bug.qualityScore}
              </span>
            )}

            <div className="flex items-center gap-1 ml-auto text-text-muted">
              <Clock className="w-3 h-3" />
              <span className="text-[10px]">{formatTimeAgo(bug.createdAt)}</span>
            </div>
          </div>

          {bug.affectedModules.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Tag className="w-3 h-3 text-text-muted" />
              {bug.affectedModules.slice(0, 3).map((m) => (
                <span key={m} className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">
                  {m}
                </span>
              ))}
              {bug.affectedModules.length > 3 && (
                <span className="text-[10px] text-text-muted">+{bug.affectedModules.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
