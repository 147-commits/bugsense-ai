'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function Spinner({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-8 h-8' };
  return <Loader2 className={cn('animate-spin text-text-muted', sizes[size], className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-bg-tertiary rounded-lg animate-pulse', className)} />;
}

export function AnalysisProgress({ stage }: { stage: string }) {
  const stages = [
    { key: 'parsing', label: 'Parsing Input' },
    { key: 'analyzing', label: 'AI Analysis' },
    { key: 'scoring', label: 'Quality Scoring' },
    { key: 'duplicates', label: 'Checking Duplicates' },
    { key: 'testcases', label: 'Generating Tests' },
    { key: 'complete', label: 'Complete' },
  ];

  const currentIdx = stages.findIndex((s) => s.key === stage);

  return (
    <div className="glass-panel p-5 space-y-3">
      <h3 className="text-sm font-medium text-text-primary">Analyzing Bug Report</h3>
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium border',
              i < currentIdx ? 'bg-accent border-accent text-white' :
              i === currentIdx ? 'border-accent text-accent' :
              'border-border text-text-muted'
            )}>
              {i < currentIdx ? '✓' : i + 1}
            </div>
            <span className={cn('text-sm', i <= currentIdx ? 'text-text-primary' : 'text-text-muted')}>
              {s.label}
            </span>
            {i === currentIdx && <Spinner size="sm" className="ml-auto" />}
          </div>
        ))}
      </div>
    </div>
  );
}
