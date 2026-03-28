'use client';

import { useState, useCallback } from 'react';
import { Upload, X, FileText, Image, Sparkles, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BugFormProps {
  onSubmit: (data: { rawInput: string; logContent?: string; screenshotBase64?: string }) => void;
  isLoading: boolean;
}

const exampleBugs = [
  "Login page crashes when using SSO with corporate account. White screen appears after OAuth redirect. Console shows TypeError: Cannot read properties of undefined (reading 'accessToken'). Happens on Chrome 120, Windows 11.",
  "Payment form shows wrong currency symbol ($) after switching region to EU. Amount is correct but symbol doesn't update until page refresh. Affects billing settings page.",
  "File upload silently fails for files larger than 10MB. No error message is shown. Upload spinner completes normally but file is not stored. Server returns 413 in network tab.",
  "Dashboard charts display no data for ~5 minutes around midnight UTC. Manual refresh fixes it. Seems related to daily data aggregation job.",
];

export default function BugForm({ onSubmit, isLoading }: BugFormProps) {
  const [rawInput, setRawInput] = useState('');
  const [logContent, setLogContent] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    if (file.type.startsWith('text/') || file.name.endsWith('.log') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogContent(ev.target?.result as string);
        setShowLogs(true);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.type.startsWith('text/') || file.name.endsWith('.log')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogContent(ev.target?.result as string);
        setShowLogs(true);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleSubmit = () => {
    if (!rawInput.trim()) return;
    onSubmit({
      rawInput: rawInput.trim(),
      logContent: logContent || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Main Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">Bug Description</label>
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="text-xs text-accent-blue hover:text-accent-blue/80 flex items-center gap-1 transition-colors"
          >
            Try an example
            <ChevronDown className={cn('w-3 h-3 transition-transform', showExamples && 'rotate-180')} />
          </button>
        </div>

        {showExamples && (
          <div className="grid grid-cols-1 gap-2 animate-slide-up">
            {exampleBugs.map((example, i) => (
              <button
                key={i}
                onClick={() => { setRawInput(example); setShowExamples(false); }}
                className="text-left text-xs text-text-secondary p-3 rounded-xl bg-bg-tertiary border border-border hover:border-accent-blue/30 hover:bg-bg-hover transition-all line-clamp-2"
              >
                {example}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Describe the bug in detail... Include what happened, what you expected, and any error messages you saw."
          className="input-field min-h-[160px] resize-y font-mono text-sm leading-relaxed"
          disabled={isLoading}
        />
        <div className="flex justify-between text-xs text-text-muted">
          <span>Paste raw bug reports, error messages, or descriptions</span>
          <span>{rawInput.length} chars</span>
        </div>
      </div>

      {/* File Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200',
          'border-border hover:border-accent-blue/30 hover:bg-bg-tertiary/50',
          isLoading && 'opacity-50 pointer-events-none'
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".log,.txt,.png,.jpg,.jpeg,.csv"
          onChange={handleFileUpload}
        />
        <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
          <div className="w-10 h-10 mx-auto rounded-xl bg-bg-tertiary flex items-center justify-center">
            <Upload className="w-5 h-5 text-text-muted" />
          </div>
          <p className="text-sm text-text-secondary">
            Drop files here or <span className="text-accent-blue">browse</span>
          </p>
          <p className="text-xs text-text-muted">Screenshots, error logs, or text files</p>
        </label>

        {fileName && (
          <div className="mt-3 inline-flex items-center gap-2 bg-bg-tertiary px-3 py-1.5 rounded-lg">
            <FileText className="w-3.5 h-3.5 text-accent-blue" />
            <span className="text-xs text-text-secondary">{fileName}</span>
            <button
              onClick={() => { setFileName(null); setLogContent(''); }}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Log Content */}
      {showLogs && (
        <div className="space-y-2 animate-slide-up">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">Error Logs</label>
            <button
              onClick={() => { setShowLogs(false); setLogContent(''); }}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Remove
            </button>
          </div>
          <textarea
            value={logContent}
            onChange={(e) => setLogContent(e.target.value)}
            placeholder="Paste error logs or stack traces here..."
            className="input-field min-h-[100px] resize-y font-mono text-xs leading-relaxed"
          />
        </div>
      )}

      {!showLogs && (
        <button
          onClick={() => setShowLogs(true)}
          className="text-xs text-text-muted hover:text-text-secondary flex items-center gap-1.5 transition-colors"
        >
          <AlertCircle className="w-3 h-3" />
          Add error logs or stack trace
        </button>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!rawInput.trim() || isLoading}
        className="btn-primary w-full py-3 text-base"
      >
        <Sparkles className="w-4.5 h-4.5" />
        {isLoading ? 'Analyzing...' : 'Analyze with AI'}
      </button>
    </div>
  );
}
