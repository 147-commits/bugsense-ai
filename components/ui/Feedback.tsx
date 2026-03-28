'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Loading';

interface FeedbackBarProps {
  onRefine?: (feedback: string) => void;
  isRefining?: boolean;
}

export function FeedbackBar({ onRefine, isRefining }: FeedbackBarProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [showRefine, setShowRefine] = useState(false);
  const [refineNote, setRefineNote] = useState('');

  const handleThumbsDown = () => {
    setFeedback('down');
    setShowRefine(true);
  };

  const handleRefine = () => {
    if (onRefine) {
      onRefine(refineNote || 'Please improve accuracy and add more detail');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted">Was this helpful?</span>
        <button
          onClick={() => setFeedback('up')}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            feedback === 'up'
              ? 'bg-accent-emerald/15 text-accent-emerald'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
          )}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleThumbsDown}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            feedback === 'down'
              ? 'bg-accent-coral/15 text-accent-coral'
              : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
          )}
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>

        {feedback === 'up' && (
          <span className="text-[11px] text-accent-emerald animate-fade-in">Thanks!</span>
        )}

        {onRefine && (
          <button
            onClick={() => setShowRefine(!showRefine)}
            disabled={isRefining}
            className="ml-auto flex items-center gap-1.5 text-[11px] text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            {isRefining ? <Spinner size="sm" /> : <RefreshCw className="w-3 h-3" />}
            {isRefining ? 'Refining...' : 'Refine output'}
          </button>
        )}
      </div>

      {showRefine && onRefine && (
        <div className="flex gap-2 animate-slide-up">
          <input
            type="text"
            value={refineNote}
            onChange={(e) => setRefineNote(e.target.value)}
            placeholder="What should be improved? (optional)"
            className="input-field py-2 text-xs flex-1"
          />
          <button
            onClick={handleRefine}
            disabled={isRefining}
            className="btn-primary px-3 py-2 text-xs"
          >
            <Sparkles className="w-3 h-3" />
            Refine
          </button>
        </div>
      )}
    </div>
  );
}
