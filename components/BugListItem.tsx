'use client';

import { Clock } from 'lucide-react';
import { cn, severityColor, priorityLabel, formatTimeAgo } from '@/lib/utils';
import type { BugReport } from '@/types';

interface BugListItemProps {
  bug: BugReport;
  onClick?: () => void;
  compact?: boolean;
}

export default function BugListItem({ bug, onClick, compact = false }: BugListItemProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-bg-tertiary transition-colors text-left"
      >
        <span className={cn('badge text-[10px]', severityColor(bug.severity))}>{bug.severity}</span>
        <p className="text-sm text-text-primary truncate flex-1">{bug.title}</p>
        <span className="text-xs text-text-muted flex-shrink-0">{formatTimeAgo(bug.createdAt)}</span>
      </button>
    );
  }

  const statusStyle: Record<string, string> = {
    OPEN: 'bg-accent/15 text-accent',
    IN_PROGRESS: 'bg-severity-medium/15 text-severity-medium',
    RESOLVED: 'bg-severity-low/15 text-severity-low',
    CLOSED: 'bg-bg-tertiary text-text-muted',
    DUPLICATE: 'bg-bg-tertiary text-text-muted',
  };

  return (
    <button
      onClick={onClick}
      className="w-full glass-panel p-4 hover:bg-bg-tertiary transition-colors text-left"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-text-primary mb-1">{bug.title}</h4>
          <p className="text-xs text-text-secondary line-clamp-2 mb-2">{bug.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('badge text-[10px]', severityColor(bug.severity))}>{bug.severity}</span>
            <span className="badge bg-bg-tertiary text-text-muted text-[10px]">{bug.priority}</span>
            <span className={cn('badge text-[10px]', statusStyle[bug.status] || 'bg-bg-tertiary text-text-muted')}>
              {bug.status.toLowerCase().replace('_', ' ')}
            </span>
            {bug.qualityScore != null && (
              <span className="text-[10px] text-text-muted font-mono">QS: {bug.qualityScore}</span>
            )}
            <span className="flex items-center gap-1 ml-auto text-text-muted">
              <Clock className="w-3 h-3" />
              <span className="text-[10px]">{formatTimeAgo(bug.createdAt)}</span>
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
