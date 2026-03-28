'use client';

import { FileText, CheckCircle, AlertTriangle, Shield, Zap, Accessibility } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn, severityColor } from '@/lib/utils';

export default function TestGenPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Test Case Generator" subtitle="Generate test cases from user stories & requirements" />
      <GeneratorPage
        title="Generate Test Cases"
        subtitle="Paste a user story or requirement"
        icon={<FileText className="w-5 h-5 text-accent-blue" />}
        placeholder="As a user, I want to be able to reset my password via email so that I can regain access to my account if I forget my credentials.

Acceptance criteria:
- User clicks 'Forgot Password' on login page
- System sends reset email within 30 seconds
- Reset link expires after 24 hours
- Password must meet complexity requirements
- User receives confirmation after successful reset"
        apiEndpoint="/api/testgen"
        buildPayload={(input, options) => ({ userStory: input, options })}
        generatorOptions={[
          { id: 'includeNegative', label: 'Negative tests', type: 'toggle', defaultValue: true },
          { id: 'includeEdgeCases', label: 'Edge cases', type: 'toggle', defaultValue: true },
          { id: 'includeSecurity', label: 'Security tests', type: 'toggle', defaultValue: false },
          { id: 'includePerformance', label: 'Performance tests', type: 'toggle', defaultValue: false },
          { id: 'includeAccessibility', label: 'Accessibility tests', type: 'toggle', defaultValue: false },
          { id: 'framework', label: 'Framework', type: 'select', defaultValue: '', options: [
            { value: '', label: 'No code output' },
            { value: 'playwright', label: 'Playwright' },
            { value: 'cypress', label: 'Cypress' },
            { value: 'jest', label: 'Jest' },
            { value: 'selenium', label: 'Selenium' },
          ]},
        ]}
        exampleInputs={[
          { label: 'Password Reset', value: 'As a user, I want to reset my password via email so I can regain access. Acceptance criteria: Reset email sent within 30s, link expires in 24h, password complexity required, confirmation shown after reset.' },
          { label: 'Shopping Cart', value: 'As a customer, I want to add items to my shopping cart so I can purchase multiple products at once. Users can update quantities, remove items, see running total, and cart persists across sessions.' },
          { label: 'File Upload', value: 'As a user, I want to upload documents (PDF, DOCX, images) up to 25MB. System should show upload progress, validate file types, scan for viruses, and allow multiple file selection.' },
        ]}
        renderResult={(result) => {
          const suite = result.testSuite as Record<string, unknown>;
          const cases = (result.testCases || []) as Array<Record<string, unknown>>;
          const coverage = result.coverageAnalysis as Record<string, unknown>;

          return (
            <div className="space-y-4">
              {/* Suite Header */}
              {suite && (
                <div className="glass-panel p-5">
                  <h3 className="text-base font-bold text-text-primary mb-1">{suite.title as string}</h3>
                  <p className="text-xs text-text-secondary mb-3">{suite.description as string}</p>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-accent-blue font-mono">{suite.totalCases as number}</p>
                      <p className="text-[10px] text-text-muted">Test Cases</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-accent-emerald font-mono">{suite.coverageScore as number}%</p>
                      <p className="text-[10px] text-text-muted">Coverage</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Cases */}
              {cases.map((tc, i) => {
                const catColors: Record<string, string> = {
                  positive: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
                  negative: 'bg-accent-coral/10 text-accent-coral border-accent-coral/20',
                  edge_case: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
                  security: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
                  performance: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
                  accessibility: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
                };
                return (
                  <div key={i} className="glass-panel p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-muted">{tc.id as string}</span>
                        <span className={cn('badge text-[10px]', catColors[tc.category as string] || 'badge-info')}>{(tc.category as string)?.replace('_', ' ')}</span>
                        <span className="badge bg-bg-hover text-text-muted border-border text-[10px]">{tc.priority as string}</span>
                      </div>
                      {tc.automatable ? <span className="text-[10px] text-accent-emerald">⚡ Automatable</span> : null}
                    </div>
                    <h4 className="text-sm font-semibold text-text-primary mb-1">{tc.title as string}</h4>
                    <p className="text-xs text-text-secondary mb-2">{tc.description as string}</p>
                    {(tc.preconditions as string[])?.length > 0 && (
                      <div className="mb-2">
                        <span className="text-[10px] text-text-muted font-medium">Preconditions:</span>
                        {(tc.preconditions as string[]).map((p, j) => <p key={j} className="text-xs text-text-muted ml-2">• {p}</p>)}
                      </div>
                    )}
                    <div className="space-y-1 mb-2">
                      {(tc.steps as string[])?.map((step, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <span className="text-[10px] text-accent-blue font-mono mt-0.5">{j + 1}.</span>
                          <span className="text-xs text-text-secondary">{step}</span>
                        </div>
                      ))}
                    </div>
                    {tc.testData ? <p className="text-xs text-text-muted mb-1"><span className="font-medium">Test Data:</span> {tc.testData as string}</p> : null}
                    <div className="pt-2 border-t border-border">
                      <span className="text-[10px] text-accent-emerald font-medium">Expected: </span>
                      <span className="text-xs text-text-secondary">{tc.expectedResult as string}</span>
                    </div>
                    {tc.codeSnippet && (tc.codeSnippet as string).length > 5 ? (
                      <div className="mt-3"><CodeBlock code={tc.codeSnippet as string} language="typescript" /></div>
                    ) : null}
                  </div>
                );
              })}

              {/* Coverage Analysis */}
              {coverage && (
                <div className="glass-panel p-5">
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Coverage Analysis</h4>
                  {(coverage.missingCoverage as string[])?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-accent-amber font-medium">⚠ Potential Gaps:</span>
                      {(coverage.missingCoverage as string[]).map((g, i) => <p key={i} className="text-xs text-text-muted ml-3">• {g}</p>)}
                    </div>
                  )}
                  {(coverage.recommendations as string[])?.length > 0 && (
                    <div>
                      <span className="text-xs text-accent-blue font-medium">💡 Recommendations:</span>
                      {(coverage.recommendations as string[]).map((r, i) => <p key={i} className="text-xs text-text-muted ml-3">• {r}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
