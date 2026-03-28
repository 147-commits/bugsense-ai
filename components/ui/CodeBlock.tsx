'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CodeBlock({ code, language, filename }: { code: string; language?: string; filename?: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl bg-[#0d1117] border border-border overflow-hidden">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-bg-tertiary border-b border-border">
          <span className="text-[11px] font-mono text-text-muted">{filename}</span>
          <div className="flex items-center gap-2">
            {language && <span className="text-[10px] text-text-muted bg-bg-primary px-2 py-0.5 rounded">{language}</span>}
            <button onClick={copyCode} className="text-text-muted hover:text-text-primary transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
      <div className="relative">
        {!filename && (
          <button onClick={copyCode} className="absolute top-2 right-2 p-1.5 rounded-lg bg-bg-tertiary/80 text-text-muted hover:text-text-primary transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
        <pre className="p-4 overflow-x-auto text-xs leading-relaxed">
          <code className="text-text-secondary font-mono">{code}</code>
        </pre>
      </div>
    </div>
  );
}
