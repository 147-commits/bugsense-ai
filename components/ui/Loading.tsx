'use client';

import { cn } from '@/lib/utils';

export function Spinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <svg className={cn('animate-spin text-accent-blue', sizes[size], className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-bg-tertiary rounded-lg animate-pulse', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="glass-panel p-5 space-y-4">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-blue/10 animate-pulse" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </div>
      <div className="glass-panel p-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({ progress, label }: { progress: number; label?: string }) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-text-secondary">{label}</span>
          <span className="text-text-muted font-mono">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-blue to-accent-violet rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function AnalysisProgress({ stage }: { stage: string }) {
  const stages = [
    { key: 'parsing', label: 'Parsing Input', icon: '📝' },
    { key: 'analyzing', label: 'AI Analysis', icon: '🧠' },
    { key: 'scoring', label: 'Quality Scoring', icon: '📊' },
    { key: 'duplicates', label: 'Checking Duplicates', icon: '🔍' },
    { key: 'testcases', label: 'Generating Tests', icon: '🧪' },
    { key: 'complete', label: 'Complete', icon: '✅' },
  ];

  const currentIdx = stages.findIndex((s) => s.key === stage);

  return (
    <div className="glass-panel p-6 space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">Analyzing Bug Report</h3>
      <div className="space-y-3">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all duration-300',
                i < currentIdx
                  ? 'bg-accent-emerald/15 scale-100'
                  : i === currentIdx
                  ? 'bg-accent-blue/15 animate-pulse scale-110'
                  : 'bg-bg-tertiary scale-95 opacity-40'
              )}
            >
              {s.icon}
            </div>
            <span
              className={cn(
                'text-sm transition-all duration-300',
                i < currentIdx
                  ? 'text-text-secondary line-through'
                  : i === currentIdx
                  ? 'text-text-primary font-medium'
                  : 'text-text-muted'
              )}
            >
              {s.label}
            </span>
            {i === currentIdx && (
              <Spinner size="sm" className="ml-auto" />
            )}
            {i < currentIdx && (
              <span className="ml-auto text-accent-emerald text-xs">Done</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
