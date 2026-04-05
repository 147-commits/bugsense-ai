'use client';

import { useState, useRef, useCallback } from 'react';
import { Copy, Check, Download, ChevronDown, RotateCcw, Square, Loader2 } from 'lucide-react';
import { FeedbackBar } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/hooks/useStore';

interface GeneratorOption {
  id: string;
  label: string;
  type: 'select' | 'toggle' | 'number';
  options?: { value: string; label: string }[];
  defaultValue?: string | boolean | number;
}

interface GeneratorPageProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  placeholder: string;
  apiEndpoint: string;
  buildPayload: (input: string, options: Record<string, unknown>) => Record<string, unknown>;
  renderResult: (result: Record<string, unknown>) => React.ReactNode;
  generatorOptions?: GeneratorOption[];
  exampleInputs?: { label: string; value: string }[];
}

export default function GeneratorPage({
  title, subtitle, icon, placeholder, apiEndpoint,
  buildPayload, renderResult, generatorOptions = [], exampleInputs = [],
}: GeneratorPageProps) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    generatorOptions.forEach((opt) => { defaults[opt.id] = opt.defaultValue ?? (opt.type === 'toggle' ? false : ''); });
    return defaults;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const cancelledRef = useRef(false);
  const { currentProject } = useAppStore();

  const handleGenerate = useCallback(async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    cancelledRef.current = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (cancelledRef.current) { setError('Generation stopped.'); break; }
      if (attempt > 0) {
        setError(`Retrying... (attempt ${attempt + 1}/3)`);
        await new Promise(r => setTimeout(r, 3000));
        if (cancelledRef.current) break;
        setError(null);
      }

      try {
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...buildPayload(input, options), projectId: currentProject?.id }),
        });
        if (cancelledRef.current) break;
        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 429 || res.status >= 500) {
            if (attempt === 2) setError('AI is busy. Please wait 30 seconds and try again.');
            continue;
          }
          throw new Error(errText);
        }
        const data = await res.json();
        if (!cancelledRef.current) { setResult(data); setError(null); }
        break;
      } catch {
        if (attempt === 2) setError('Generation failed. Wait 30 seconds and try again.');
      }
    }
    setIsLoading(false);
  }, [input, options, apiEndpoint, buildPayload, currentProject?.id]);

  const handleStop = () => { cancelledRef.current = true; setIsLoading(false); setError('Generation stopped.'); };

  const copyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMarkdown = () => {
    const md = (result as Record<string, unknown>)?.markdownOutput as string;
    if (!md) return downloadJSON();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Input */}
        <div className="space-y-4">
          <div className="glass-panel p-5">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-muted">
                {icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                <p className="text-[11px] text-text-muted">{subtitle}</p>
              </div>
            </div>

            {/* Examples */}
            {exampleInputs.length > 0 && (
              <div className="mb-3">
                <button onClick={() => setShowExamples(!showExamples)} className="text-xs text-accent hover:underline flex items-center gap-1 mb-2">
                  Try an example <ChevronDown className={cn('w-3 h-3 transition-transform', showExamples && 'rotate-180')} />
                </button>
                {showExamples && (
                  <div className="flex flex-wrap gap-1.5">
                    {exampleInputs.map((ex, i) => (
                      <button key={i} onClick={() => { setInput(ex.value); setShowExamples(false); }}
                        className="text-xs text-text-secondary bg-bg-tertiary px-2.5 py-1 rounded-lg hover:text-text-primary hover:bg-bg-elevated transition-colors">
                        {ex.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Textarea */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="input-field min-h-[180px] resize-y font-mono text-xs leading-relaxed mb-3"
              disabled={isLoading}
            />

            {/* Options */}
            {generatorOptions.length > 0 && (
              <div className="space-y-2.5 mb-3 p-3 rounded-lg bg-bg-tertiary border border-border">
                <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Options</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {generatorOptions.map((opt) => (
                    <div key={opt.id}>
                      {opt.type === 'select' && (
                        <div>
                          <label className="text-[11px] text-text-muted mb-1 block">{opt.label}</label>
                          <select value={options[opt.id] as string} onChange={(e) => setOptions((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                            className="w-full bg-bg-primary border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent">
                            {opt.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      )}
                      {opt.type === 'toggle' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={options[opt.id] as boolean} onChange={(e) => setOptions((prev) => ({ ...prev, [opt.id]: e.target.checked }))}
                            className="rounded border-border accent-accent" />
                          <span className="text-xs text-text-secondary">{opt.label}</span>
                        </label>
                      )}
                      {opt.type === 'number' && (
                        <div>
                          <label className="text-[11px] text-text-muted mb-1 block">{opt.label}</label>
                          <input type="number" value={options[opt.id] as number} onChange={(e) => setOptions((prev) => ({ ...prev, [opt.id]: Number(e.target.value) }))}
                            className="w-full bg-bg-primary border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate / Stop */}
            {isLoading ? (
              <button onClick={handleStop} className="w-full py-2.5 rounded-lg font-medium text-sm bg-severity-critical text-white hover:bg-severity-critical/90 transition-colors flex items-center justify-center gap-2">
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            ) : (
              <button onClick={handleGenerate} disabled={!input.trim()} className="btn-primary w-full">
                Generate
              </button>
            )}
          </div>
        </div>

        {/* Right: Output */}
        <div className="space-y-4">
          {isLoading && (
            <div className="glass-panel p-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-primary">Generating...</p>
              <p className="text-xs text-text-muted mt-1">This takes 10-45 seconds. You can switch tabs.</p>
            </div>
          )}

          {error && (
            <div className="glass-panel p-5">
              <p className="text-sm text-severity-critical">{error}</p>
              <button onClick={handleGenerate} className="btn-secondary mt-3 text-xs">
                <RotateCcw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {result && !isLoading && (
            <div className="space-y-4">
              {/* Action Bar */}
              <div className="flex gap-2">
                <button onClick={copyAll} className="btn-ghost text-xs">
                  {copied ? <Check className="w-3.5 h-3.5 text-severity-low" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
                <button onClick={downloadMarkdown} className="btn-ghost text-xs">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button onClick={() => setResult(null)} className="btn-ghost text-xs ml-auto">
                  <RotateCcw className="w-3.5 h-3.5" /> Clear
                </button>
              </div>

              {/* Rendered Result */}
              {renderResult(result)}

              {/* Feedback */}
              <div className="glass-panel p-4">
                <FeedbackBar
                  onRefine={async (feedback) => {
                    setIsLoading(true);
                    try {
                      const res = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...buildPayload(input, options), projectId: currentProject?.id, refineFeedback: feedback }),
                      });
                      if (res.ok) { const data = await res.json(); setResult(data); }
                    } catch {} finally { setIsLoading(false); }
                  }}
                  isRefining={isLoading}
                />
              </div>
            </div>
          )}

          {!result && !isLoading && !error && (
            <div className="glass-panel p-10 text-center">
              <div className="w-12 h-12 mx-auto rounded-lg bg-bg-tertiary flex items-center justify-center mb-3 text-text-muted">
                {icon}
              </div>
              <h3 className="text-sm font-medium text-text-primary mb-1">Output</h3>
              <p className="text-xs text-text-muted max-w-xs mx-auto">
                Enter your input and click Generate to see results
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
