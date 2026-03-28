'use client';

import { useState, useRef, useCallback } from 'react';
import { Sparkles, Copy, Check, Download, ChevronDown, RotateCcw, Square, FileText } from 'lucide-react';
import { Spinner } from '@/components/ui/Loading';
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

    // Retry up to 2 times from frontend if backend fails
    for (let attempt = 0; attempt < 3; attempt++) {
      if (cancelledRef.current) {
        setError('Generation stopped by user.');
        break;
      }

      if (attempt > 0) {
        setError(`Retrying... (attempt ${attempt + 1}/3)`);
        await new Promise(r => setTimeout(r, 3000));
        if (cancelledRef.current) break;
        setError(null);
      }

      try {
        // NO signal/AbortController — this ensures tab switching doesn't kill the request
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...buildPayload(input, options), projectId: currentProject?.id }),
        });

        if (cancelledRef.current) break;

        if (!res.ok) {
          const errText = await res.text();
          // If rate limited or server error, retry
          if (res.status === 429 || res.status >= 500) {
            if (attempt === 2) {
              setError('AI is busy right now. Please wait 30 seconds and try again.');
            }
            continue;
          }
          throw new Error(errText);
        }

        const data = await res.json();
        if (!cancelledRef.current) {
          setResult(data);
          setError(null);
        }
        break; // Success — exit retry loop
      } catch (err) {
        if (attempt === 2) {
          setError('Generation failed after 3 attempts. Wait 30 seconds and try again.');
        }
      }
    }

    setIsLoading(false);
  }, [input, options, apiEndpoint, buildPayload]);

  const handleStop = () => {
    cancelledRef.current = true;
    setIsLoading(false);
    setError('Generation stopped.');
  };

  const copyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMarkdown = () => {
    const md = (result as Record<string, unknown>)?.markdownOutput as string;
    if (!md) return downloadJSON();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
          <div className="glass-panel p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                {icon}
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{title}</h3>
                <p className="text-xs text-text-muted">{subtitle}</p>
              </div>
            </div>

            {exampleInputs.length > 0 && (
              <div className="mb-4">
                <button onClick={() => setShowExamples(!showExamples)} className="text-xs text-accent-blue hover:text-accent-blue/80 flex items-center gap-1 mb-2">
                  Try an example <ChevronDown className={cn('w-3 h-3 transition-transform', showExamples && 'rotate-180')} />
                </button>
                {showExamples && (
                  <div className="space-y-2 animate-slide-up">
                    {exampleInputs.map((ex, i) => (
                      <button key={i} onClick={() => { setInput(ex.value); setShowExamples(false); }}
                        className="w-full text-left text-xs text-text-secondary p-3 rounded-xl bg-bg-tertiary border border-border hover:border-accent-blue/30 transition-all line-clamp-2">
                        <span className="font-medium text-text-primary">{ex.label}:</span> {ex.value.slice(0, 100)}...
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder}
              className="input-field min-h-[200px] resize-y font-mono text-sm leading-relaxed mb-4" disabled={isLoading} />

            {generatorOptions.length > 0 && (
              <div className="space-y-3 mb-4 p-4 rounded-xl bg-bg-tertiary border border-border">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Options</span>
                <div className="grid grid-cols-2 gap-3">
                  {generatorOptions.map((opt) => (
                    <div key={opt.id}>
                      {opt.type === 'select' && (
                        <div>
                          <label className="text-[11px] text-text-muted mb-1 block">{opt.label}</label>
                          <select value={options[opt.id] as string} onChange={(e) => setOptions((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none">
                            {opt.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      )}
                      {opt.type === 'toggle' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={options[opt.id] as boolean} onChange={(e) => setOptions((prev) => ({ ...prev, [opt.id]: e.target.checked }))}
                            className="rounded border-border accent-accent-blue" />
                          <span className="text-xs text-text-secondary">{opt.label}</span>
                        </label>
                      )}
                      {opt.type === 'number' && (
                        <div>
                          <label className="text-[11px] text-text-muted mb-1 block">{opt.label}</label>
                          <input type="number" value={options[opt.id] as number} onChange={(e) => setOptions((prev) => ({ ...prev, [opt.id]: Number(e.target.value) }))}
                            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate / Stop Buttons */}
            {isLoading ? (
              <button onClick={handleStop} className="w-full py-3 rounded-xl font-medium text-sm bg-accent-coral text-white hover:bg-accent-coral/90 transition-all flex items-center justify-center gap-2">
                <Square className="w-4 h-4" /> Stop Generation
              </button>
            ) : (
              <button onClick={handleGenerate} disabled={!input.trim()} className="btn-primary w-full py-3">
                <Sparkles className="w-4 h-4" /> Generate with AI
              </button>
            )}
          </div>
        </div>

        {/* Right: Output */}
        <div className="space-y-4">
          {isLoading && (
            <div className="glass-panel p-8 text-center">
              <Spinner size="lg" className="mx-auto mb-4" />
              <p className="text-sm text-text-primary font-medium">AI is generating...</p>
              <p className="text-xs text-text-muted mt-1">This takes 10-45 seconds. You can switch tabs — it won't stop.</p>
              <p className="text-xs text-text-muted mt-0.5">If it takes longer, the AI will auto-retry.</p>
            </div>
          )}

          {error && (
            <div className="glass-panel p-6 border-severity-critical/30">
              <p className="text-sm text-severity-critical">{error}</p>
              <button onClick={handleGenerate} className="btn-secondary mt-3 text-xs">
                <RotateCcw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {result && !isLoading && (
            <div className="space-y-4 animate-slide-up">
              {/* Action Bar */}
              <div className="flex gap-2">
                <button onClick={copyAll} className="btn-secondary flex-1">
                  {copied ? <Check className="w-4 h-4 text-accent-emerald" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
                <button onClick={downloadMarkdown} className="btn-secondary flex-1">
                  <Download className="w-4 h-4" /> Download
                </button>
                <button onClick={() => { setResult(null); }} className="btn-ghost">
                  <RotateCcw className="w-4 h-4" />
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
                      if (res.ok) {
                        const data = await res.json();
                        setResult(data);
                      }
                    } catch {} finally { setIsLoading(false); }
                  }}
                  isRefining={isLoading}
                />
              </div>
            </div>
          )}

          {!result && !isLoading && !error && (
            <div className="glass-panel p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4">
                {icon}
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-2">AI Output</h3>
              <p className="text-sm text-text-muted max-w-xs mx-auto">
                Enter your input on the left and click Generate to see AI-powered results here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
