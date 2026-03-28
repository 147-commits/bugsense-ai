'use client';

import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import BugForm from '@/components/BugForm';
import BugAnalysisCard from '@/components/BugAnalysisCard';
import QAChat from '@/components/QAChat';
import { AnalysisProgress } from '@/components/ui/Loading';
import { useAppStore } from '@/lib/hooks/useStore';
import type { BugReport, TestCase } from '@/types';

interface AnalysisResult {
  bugReport: BugReport;
  qualityScore: { score: number; breakdown: Record<string, number>; suggestions: string[] };
  testCases: TestCase[];
  reproductionChecklist: { checklist: string[]; scenarios: { name: string; steps: string[]; expectedOutcome: string }[] };
  duplicates: Record<string, unknown>;
}

export default function AnalyzePage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { currentProject } = useAppStore();

  const handleSubmit = async (data: { rawInput: string; logContent?: string; screenshotBase64?: string }) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    // Simulate progress stages
    const stages = ['parsing', 'analyzing', 'scoring', 'duplicates', 'testcases'];
    for (const s of stages) {
      setStage(s);
      await new Promise((r) => setTimeout(r, 800));
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, projectId: currentProject?.id }),
      });

      if (!res.ok) {
        throw new Error('Analysis failed');
      }

      const result = await res.json();
      setStage('complete');
      await new Promise((r) => setTimeout(r, 500));
      setResult(result);
    } catch (err) {
      setError('Failed to analyze bug report. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setStage('');
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Bug Analyzer" subtitle="AI-powered defect analysis" />

      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Submit Bug Report</h3>
                  <p className="text-xs text-text-muted">Paste raw bug descriptions, logs, or error messages</p>
                </div>
              </div>
              <BugForm onSubmit={handleSubmit} isLoading={isAnalyzing} />
            </div>

            {/* Chat - only shows after analysis */}
            {result && (
              <QAChat
                bugId={result.bugReport.id}
                bugTitle={result.bugReport.title}
              />
            )}
          </div>

          {/* Right: Output */}
          <div className="space-y-4">
            {isAnalyzing && <AnalysisProgress stage={stage} />}

            {error && (
              <div className="glass-panel p-6 border-severity-critical/30">
                <p className="text-sm text-severity-critical">{error}</p>
              </div>
            )}

            {result && !isAnalyzing && (
              <BugAnalysisCard
                bug={result.bugReport}
                qualityScore={result.qualityScore}
                testCases={result.testCases as TestCase[]}
                reproChecklist={result.reproductionChecklist}
                duplicates={result.duplicates}
              />
            )}

            {!result && !isAnalyzing && (
              <div className="glass-panel p-12 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">AI Analysis Results</h3>
                <p className="text-sm text-text-muted max-w-xs mx-auto">
                  Submit a bug report on the left and the AI will generate a structured analysis here
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {['Structured Report', 'Quality Score', 'Test Cases', 'Root Cause', 'Duplicates'].map((f) => (
                    <span key={f} className="text-[10px] px-2.5 py-1 rounded-full bg-bg-tertiary text-text-muted border border-border">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
