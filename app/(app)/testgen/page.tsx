'use client';

import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

export default function TestGenPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Test Case Generator" subtitle="IEEE 829 compliant test cases from user stories" />
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
          { label: 'Password Reset', value: 'As a user, I want to reset my password via email so I can regain access.\n\nAcceptance criteria:\n- User clicks \'Forgot Password\' on login page\n- System sends reset email within 30s\n- Reset link expires in 24h\n- Password must meet complexity requirements\n- Confirmation shown after successful reset' },
          { label: 'Shopping Cart', value: 'As a customer, I want to add items to my shopping cart so I can purchase multiple products at once.\n\nAcceptance criteria:\n- Users can add items from product page\n- Users can update quantities (1-99)\n- Users can remove items\n- Running total updates in real-time\n- Cart persists across sessions (logged in users)' },
          { label: 'File Upload', value: 'As a user, I want to upload documents (PDF, DOCX, images) up to 25MB.\n\nAcceptance criteria:\n- Show upload progress bar\n- Validate file types (reject .exe, .bat)\n- Scan for viruses before storing\n- Allow multiple file selection (max 10)\n- Display thumbnails after upload' },
        ]}
        renderResult={(result) => <TestGenResult result={result} />}
      />
    </div>
  );
}

// ── Result Renderer ──────────────────────────────────────────────────────────

function TestGenResult({ result }: { result: Record<string, unknown> }) {
  const suite = result.testSuite as Record<string, unknown> | undefined;
  const cases = (result.testCases || []) as Array<Record<string, unknown>>;
  const coverage = result.coverageAnalysis as Record<string, unknown> | undefined;
  const execTemplate = result.executionTemplate as { headers: string[]; rows: string[][] } | undefined;
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  // Collect all gherkin for export
  const gherkinSnippets = cases
    .map((tc) => tc.gherkinOutput as string)
    .filter((g) => g && g.length > 5);

  function exportGherkin() {
    if (gherkinSnippets.length === 0) return;
    const content = `# Auto-generated Gherkin — ${suite?.title ?? 'Test Suite'}\n\n${gherkinSnippets.join('\n\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test_cases.feature';
    a.click();
    URL.revokeObjectURL(url);
  }

  const catColors: Record<string, string> = {
    positive: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
    negative: 'bg-accent-coral/10 text-accent-coral border-accent-coral/20',
    edge_case: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
    security: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
    performance: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
    accessibility: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  };

  return (
    <div className="space-y-4">
      {/* Suite Header */}
      {suite && (
        <div className="glass-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-text-primary mb-1">{suite.title as string}</h3>
              <p className="text-xs text-text-secondary">{suite.description as string}</p>
            </div>
            {gherkinSnippets.length > 0 && (
              <button onClick={exportGherkin} className="btn-secondary text-xs flex-shrink-0">
                <Download className="w-3.5 h-3.5" /> Export Gherkin
              </button>
            )}
          </div>
          <div className="flex gap-4 mt-3">
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
      {cases.map((tc) => {
        const tcId = tc.id as string;
        const isExpanded = expandedCase === tcId;
        const steps = tc.steps as Array<Record<string, string> | string> | undefined;
        const hasStructuredSteps = steps && steps.length > 0 && typeof steps[0] === 'object';
        const testDataTable = tc.testDataTable as Array<Record<string, string>> | undefined;
        const autoFeas = tc.automationFeasibility as Record<string, unknown> | undefined;

        return (
          <div key={tcId} className="glass-panel overflow-hidden">
            {/* Collapsed header */}
            <button
              onClick={() => setExpandedCase(isExpanded ? null : tcId)}
              className="w-full p-4 text-left hover:bg-bg-hover/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-text-muted">{tcId}</span>
                  <span className={cn('badge text-[10px]', catColors[tc.category as string] || 'badge-info')}>
                    {(tc.category as string)?.replace('_', ' ')}
                  </span>
                  <span className="badge bg-bg-hover text-text-muted border-border text-[10px]">{tc.priority as string}</span>
                  {tc.testDesignTechnique ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-mono">
                      {tc.testDesignTechnique as string}
                    </span>
                  ) : null}
                </div>
                {autoFeas?.automatable ? <span className="text-[10px] text-accent-emerald flex-shrink-0">⚡ Automatable</span> : null}
              </div>
              <h4 className="text-sm font-semibold text-text-primary">{tc.title as string}</h4>
              {tc.traceability ? (
                <p className="text-[10px] text-accent-violet mt-0.5 font-medium">{tc.traceability as string}</p>
              ) : null}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border px-5 py-4 space-y-4 bg-bg-tertiary/20">
                <p className="text-xs text-text-secondary">{tc.description as string}</p>

                {/* Preconditions */}
                {(tc.preconditions as string[])?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Preconditions</span>
                    {(tc.preconditions as string[]).map((p, j) => <p key={j} className="text-xs text-text-muted mt-0.5 ml-2">• {p}</p>)}
                  </div>
                )}

                {/* Structured Steps (3 columns) */}
                {hasStructuredSteps ? (
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Test Steps</span>
                    <div className="mt-1.5 overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-2 text-text-muted font-medium w-8">#</th>
                            <th className="text-left py-2 px-2 text-text-muted font-medium">Action</th>
                            <th className="text-left py-2 px-2 text-text-muted font-medium w-36">Test Data</th>
                            <th className="text-left py-2 px-2 text-text-muted font-medium">Expected Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(steps as Array<Record<string, string>>).map((step, j) => (
                            <tr key={j} className="border-b border-border/50">
                              <td className="py-2 px-2 text-accent-blue font-mono align-top">{j + 1}</td>
                              <td className="py-2 px-2 text-text-secondary align-top">{step.action}</td>
                              <td className="py-2 px-2 text-text-muted font-mono align-top">{step.testData}</td>
                              <td className="py-2 px-2 text-accent-emerald/80 align-top">{step.expected}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : steps && (
                  /* Fallback: legacy string steps */
                  <div className="space-y-1">
                    {(steps as string[]).map((step, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <span className="text-[10px] text-accent-blue font-mono mt-0.5">{j + 1}.</span>
                        <span className="text-xs text-text-secondary">{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Test Data Table */}
                {testDataTable && testDataTable.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Test Data Matrix</span>
                    <div className="mt-1.5 overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1.5 px-2 text-text-muted font-medium">Field</th>
                            <th className="text-left py-1.5 px-2 text-accent-emerald font-medium">Valid</th>
                            <th className="text-left py-1.5 px-2 text-accent-coral font-medium">Invalid</th>
                            <th className="text-left py-1.5 px-2 text-accent-amber font-medium">Boundary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testDataTable.map((row, j) => (
                            <tr key={j} className="border-b border-border/50">
                              <td className="py-1.5 px-2 text-text-primary font-medium">{row.field}</td>
                              <td className="py-1.5 px-2 text-text-secondary font-mono">{row.validValue}</td>
                              <td className="py-1.5 px-2 text-text-secondary font-mono">{row.invalidValue}</td>
                              <td className="py-1.5 px-2 text-text-secondary font-mono">{row.boundary}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Overall Expected Result */}
                <div className="p-2.5 rounded-lg bg-accent-emerald/5 border border-accent-emerald/10">
                  <span className="text-[10px] text-accent-emerald font-medium uppercase tracking-wider">Overall Expected Result</span>
                  <p className="text-xs text-text-secondary mt-0.5">{tc.expectedResult as string}</p>
                </div>

                {/* Priority Justification & Risk */}
                <div className="grid grid-cols-2 gap-3">
                  {tc.priorityJustification ? (
                    <div className="p-2.5 rounded-lg bg-bg-tertiary">
                      <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Priority Rationale</span>
                      <p className="text-xs text-text-secondary mt-0.5">{tc.priorityJustification as string}</p>
                    </div>
                  ) : null}
                  {tc.riskIfNotTested ? (
                    <div className="p-2.5 rounded-lg bg-accent-coral/5 border border-accent-coral/10">
                      <span className="text-[10px] text-accent-coral font-semibold uppercase tracking-wider">Risk If Not Tested</span>
                      <p className="text-xs text-text-secondary mt-0.5">{tc.riskIfNotTested as string}</p>
                    </div>
                  ) : null}
                </div>

                {/* Automation Feasibility */}
                {autoFeas && (
                  <div className="p-2.5 rounded-lg bg-bg-tertiary">
                    <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Automation Feasibility</span>
                    <div className="flex flex-wrap gap-3 mt-1">
                      <span className="text-xs text-text-secondary"><span className="font-medium">Framework:</span> {autoFeas.framework as string}</span>
                      <span className="text-xs text-text-secondary"><span className="font-medium">Effort:</span> {autoFeas.estimatedEffort as string}</span>
                      {autoFeas.notes ? <span className="text-xs text-text-muted">{autoFeas.notes as string}</span> : null}
                    </div>
                  </div>
                )}

                {/* Code Snippet */}
                {tc.codeSnippet && (tc.codeSnippet as string).length > 5 ? (
                  <CodeBlock code={tc.codeSnippet as string} language="typescript" />
                ) : null}

                {/* Gherkin */}
                {tc.gherkinOutput && (tc.gherkinOutput as string).length > 5 ? (
                  <CodeBlock code={tc.gherkinOutput as string} filename="test.feature" language="gherkin" />
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      {/* Requirements Coverage Matrix */}
      {coverage && (coverage.requirementsCoverage as Array<Record<string, unknown>>)?.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Requirements Coverage Matrix</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-text-muted font-medium">Acceptance Criterion</th>
                  <th className="text-left py-2 px-2 text-text-muted font-medium">Test Case IDs</th>
                  <th className="text-left py-2 px-2 text-text-muted font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(coverage.requirementsCoverage as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 px-2 text-text-secondary">{row.criterion as string}</td>
                    <td className="py-2 px-2 text-text-muted font-mono">{(row.testCaseIds as string[])?.join(', ')}</td>
                    <td className="py-2 px-2">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium',
                        (row.status as string) === 'Covered' ? 'bg-accent-emerald/15 text-accent-emerald' :
                        (row.status as string) === 'Partial' ? 'bg-accent-amber/15 text-accent-amber' :
                        'bg-accent-coral/15 text-accent-coral'
                      )}>
                        {row.status as string}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Technique Coverage */}
      {coverage && (coverage.techniqueCoverage as Array<Record<string, unknown>>)?.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Test Design Techniques Applied</h4>
          <div className="flex flex-wrap gap-2">
            {(coverage.techniqueCoverage as Array<Record<string, unknown>>).map((tech, i) => (
              <div key={i} className="p-2 rounded-lg bg-bg-tertiary border border-border">
                <span className="text-xs font-medium text-text-primary">{tech.technique as string}</span>
                <p className="text-[10px] text-text-muted font-mono mt-0.5">{(tech.testCaseIds as string[])?.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps & Recommendations */}
      {coverage && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Coverage Gaps & Recommendations</h4>
          {(coverage.gaps as Array<Record<string, unknown>>)?.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {(coverage.gaps as Array<Record<string, unknown>>).map((gap, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-accent-amber/5 border border-accent-amber/10">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5',
                    (gap.riskRating as string) === 'High' ? 'bg-accent-coral/15 text-accent-coral' :
                    (gap.riskRating as string) === 'Medium' ? 'bg-accent-amber/15 text-accent-amber' :
                    'bg-accent-emerald/15 text-accent-emerald'
                  )}>
                    {gap.riskRating as string}
                  </span>
                  <div>
                    <p className="text-xs text-text-secondary">{gap.area as string}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{gap.recommendation as string}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(coverage.missingCoverage as string[])?.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-accent-amber font-medium">Potential Gaps:</span>
              {(coverage.missingCoverage as string[]).map((g, i) => <p key={i} className="text-xs text-text-muted ml-3">• {g}</p>)}
            </div>
          )}
          {(coverage.recommendations as string[])?.length > 0 && (
            <div>
              <span className="text-xs text-accent-blue font-medium">Recommendations:</span>
              {(coverage.recommendations as string[]).map((r, i) => <p key={i} className="text-xs text-text-muted ml-3">• {r}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Execution Template */}
      {execTemplate && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Test Execution Summary Template</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {execTemplate.headers.map((h, i) => (
                    <th key={i} className="text-left py-2 px-2 text-text-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {execTemplate.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {row.map((cell, j) => (
                      <td key={j} className="py-2 px-2 text-text-secondary">{cell || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
