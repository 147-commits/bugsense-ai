'use client';

import { useState } from 'react';
import { Shield, TrendingUp, ChevronRight, ChevronDown, AlertTriangle, Clock } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import { cn } from '@/lib/utils';

const CAT_COLORS: Record<string, string> = {
  edge_case: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
  negative: 'bg-accent-coral/10 text-accent-coral border-accent-coral/20',
  security: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
  performance: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
  accessibility: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  functional: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
};

const GAP_CAT_COLORS: Record<string, string> = {
  requirements: 'bg-accent-blue/10 text-accent-blue',
  technique: 'bg-accent-violet/10 text-accent-violet',
  risk: 'bg-accent-coral/10 text-accent-coral',
  negative: 'bg-accent-amber/10 text-accent-amber',
  non_functional: 'bg-accent-cyan/10 text-accent-cyan',
};

export default function CoveragePage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Coverage Expander" subtitle="Enterprise coverage gap analysis" />
      <GeneratorPage
        title="Expand Test Coverage"
        subtitle="Paste your existing test cases and AI will find gaps"
        icon={<Shield className="w-5 h-5 text-accent-emerald" />}
        placeholder="Existing test cases for User Login:

TC-001: Successful login with valid email and password
TC-002: Login fails with wrong password - shows error message
TC-003: Login fails with non-existent email
TC-004: Redirect to dashboard after successful login
TC-005: Remember me checkbox keeps user logged in
TC-006: Forgot password link navigates to reset page"
        apiEndpoint="/api/coverage"
        buildPayload={(input, options) => ({ existingTests: input, expansionType: options.expansionType || 'all' })}
        generatorOptions={[
          { id: 'expansionType', label: 'Focus Area', type: 'select', defaultValue: 'all', options: [
            { value: 'all', label: 'All Areas (Comprehensive)' },
            { value: 'edge_cases', label: 'Edge Cases & Boundaries' },
            { value: 'negative', label: 'Negative Tests' },
            { value: 'security', label: 'Security Tests' },
            { value: 'performance', label: 'Performance Tests' },
            { value: 'accessibility', label: 'Accessibility Tests' },
          ]},
        ]}
        exampleInputs={[
          { label: 'Login Tests', value: 'TC-001: Successful login with valid credentials\nTC-002: Login fails with wrong password\nTC-003: Login fails with non-existent email\nTC-004: Redirect to dashboard after login\nTC-005: Remember me keeps user logged in\nTC-006: Forgot password link works' },
          { label: 'Cart Tests', value: 'TC-001: Add single item to cart\nTC-002: Remove item from cart\nTC-003: Update item quantity\nTC-004: Cart shows correct total\nTC-005: Proceed to checkout from cart\nTC-006: Empty cart shows message' },
          { label: 'Search Tests', value: 'TC-001: Search returns matching results\nTC-002: Search with no results shows empty state\nTC-003: Filter by category works\nTC-004: Sort by price ascending\nTC-005: Pagination works\nTC-006: Clear filters resets results' },
        ]}
        renderResult={(result) => <CoverageResult result={result} />}
      />
    </div>
  );
}

function CoverageResult({ result }: { result: Record<string, unknown> }) {
  const analysis = result.analysis as Record<string, unknown> | undefined;
  const breakdown = analysis?.coverageBreakdown as Record<string, number> | undefined;
  const gapAnalysis = Array.isArray(result.gapAnalysis) ? result.gapAnalysis as Array<Record<string, string>> : [];
  const heatMap = Array.isArray(result.coverageHeatMap) ? result.coverageHeatMap as Array<Record<string, unknown>> : [];
  const newTests = Array.isArray(result.newTestCases) ? result.newTestCases as Array<Record<string, unknown>> : [];
  const prioritized = Array.isArray(result.prioritizedOrder) ? result.prioritizedOrder as string[] : [];
  const resource = result.resourceEstimate as Record<string, number> | undefined;
  const execSummary = result.executiveSummary as string | undefined;
  const [expandedTest, setExpandedTest] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      {execSummary && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-2">Executive Summary</h4>
          <p className="text-xs text-text-secondary leading-relaxed">{execSummary}</p>
        </div>
      )}

      {/* Coverage Score */}
      {analysis && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Coverage Analysis</h4>
          <div className="flex items-center gap-6 mb-4">
            <div className="text-center">
              <p className={cn('text-2xl font-bold font-mono', (analysis.currentScore as number) < 50 ? 'text-accent-coral' : 'text-accent-amber')}>{analysis.currentScore as number}%</p>
              <p className="text-[10px] text-text-muted">Current</p>
            </div>
            <TrendingUp className="w-5 h-5 text-accent-emerald" />
            <div className="text-center">
              <p className="text-2xl font-bold text-accent-emerald font-mono">{analysis.projectedScore as number}%</p>
              <p className="text-[10px] text-text-muted">Projected</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-lg font-bold text-accent-blue">{result.coverageImprovement as string}</p>
              <p className="text-[10px] text-text-muted">Improvement</p>
            </div>
          </div>

          <p className="text-xs text-text-secondary mb-3">{analysis.existingCoverage as string}</p>

          {/* Coverage Breakdown Bar */}
          {breakdown && (
            <div className="space-y-1.5 mt-3 pt-3 border-t border-border">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Coverage by Type</span>
              {Object.entries(breakdown).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted w-24 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', val >= 60 ? 'bg-accent-emerald' : val >= 30 ? 'bg-accent-amber' : 'bg-accent-coral')} style={{ width: `${val}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-text-muted w-8 text-right">{val}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coverage Heat Map */}
      {heatMap.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Coverage Heat Map</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Module</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Current</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Projected</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Gaps</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {heatMap.map((row, i) => {
                  const curr = row.currentCoverage as number;
                  const proj = row.projectedCoverage as number;
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-text-primary font-medium">{row.module as string}</td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={cn('font-mono', curr >= 60 ? 'text-accent-emerald' : curr >= 30 ? 'text-accent-amber' : 'text-accent-coral')}>{curr}%</span>
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span className="font-mono text-accent-emerald">{proj}%</span>
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-text-muted">{row.gapCount as number}</td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium',
                          row.riskLevel === 'High' ? 'bg-accent-coral/15 text-accent-coral' :
                          row.riskLevel === 'Medium' ? 'bg-accent-amber/15 text-accent-amber' :
                          'bg-accent-emerald/15 text-accent-emerald'
                        )}>{row.riskLevel as string}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      {gapAnalysis.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-accent-amber" />
            <h4 className="text-sm font-semibold text-text-primary">Gap Analysis ({gapAnalysis.length} gaps)</h4>
          </div>
          <div className="space-y-2">
            {gapAnalysis.map((gap, i) => (
              <div key={i} className="p-3 rounded-lg bg-bg-tertiary border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-text-muted">{gap.gapId}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', GAP_CAT_COLORS[gap.category] || 'bg-bg-tertiary text-text-muted')}>
                    {gap.category?.replace('_', ' ')}
                  </span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                    gap.riskLevel === 'High' ? 'bg-accent-coral/15 text-accent-coral' :
                    gap.riskLevel === 'Medium' ? 'bg-accent-amber/15 text-accent-amber' :
                    'bg-accent-emerald/15 text-accent-emerald'
                  )}>{gap.riskLevel}</span>
                  {gap.missingTechnique && gap.missingTechnique !== 'N/A' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-violet/10 text-accent-violet border border-accent-violet/20 font-mono">{gap.missingTechnique}</span>
                  )}
                </div>
                <p className="text-xs text-text-secondary">{gap.description}</p>
                <p className="text-[10px] text-text-muted mt-1">Impact: {gap.impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prioritized Order */}
      {prioritized.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Recommended Priority Order</h4>
          <div className="space-y-1">
            {prioritized.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-bg-tertiary">
                <span className="w-6 h-6 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="text-xs text-text-secondary">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Test Cases */}
      {newTests.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">
            Recommended New Tests ({newTests.length})
          </h4>
          <div className="space-y-2">
            {newTests.map((tc, i) => {
              const isExpanded = expandedTest === i;
              return (
                <div key={i} className="rounded-lg border border-border overflow-hidden">
                  <button onClick={() => setExpandedTest(isExpanded ? null : i)} className="w-full p-3 text-left hover:bg-bg-hover/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
                      <span className={cn('badge text-[10px]', CAT_COLORS[tc.category as string] || 'bg-bg-tertiary text-text-muted border-border')}>
                        {(tc.category as string)?.replace('_', ' ')}
                      </span>
                      <span className="badge bg-bg-hover text-text-muted border-border text-[10px]">{tc.priority as string}</span>
                      {tc.testDesignTechnique ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-violet/10 text-accent-violet border border-accent-violet/20 font-mono">
                          {tc.testDesignTechnique as string}
                        </span>
                      ) : null}
                      {tc.coverageImprovement ? (
                        <span className="text-[10px] font-mono text-accent-emerald ml-auto">{tc.coverageImprovement as string}</span>
                      ) : null}
                    </div>
                    <p className="text-sm text-text-primary font-medium ml-6">{tc.title as string}</p>
                    {tc.closesGap ? (
                      <p className="text-[10px] text-accent-blue ml-6 mt-0.5">Closes {tc.closesGap as string}</p>
                    ) : null}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t border-border bg-bg-tertiary/20 space-y-2">
                      <p className="text-xs text-text-secondary">{tc.description as string}</p>

                      <div className="space-y-1">
                        {(tc.steps as string[])?.map((step, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <span className="text-[10px] font-mono text-accent-blue mt-0.5">{j + 1}.</span>
                            <span className="text-xs text-text-secondary">{step}</span>
                          </div>
                        ))}
                      </div>

                      <div className="p-2 rounded-lg bg-accent-emerald/5 border border-accent-emerald/10">
                        <span className="text-[10px] text-accent-emerald font-medium">Expected: </span>
                        <span className="text-xs text-text-secondary">{tc.expectedResult as string}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {tc.priorityJustification ? (
                          <div className="p-2 rounded-lg bg-bg-tertiary">
                            <span className="text-[10px] text-text-muted font-semibold">Priority Rationale</span>
                            <p className="text-[10px] text-text-secondary mt-0.5">{tc.priorityJustification as string}</p>
                          </div>
                        ) : null}
                        <div className="p-2 rounded-lg bg-accent-amber/5 border border-accent-amber/10">
                          <span className="text-[10px] text-accent-amber font-medium">Risk if Not Tested</span>
                          <p className="text-[10px] text-text-secondary mt-0.5">{tc.whyNeeded as string}</p>
                        </div>
                      </div>

                      {tc.effortMinutes ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                          <Clock className="w-3 h-3" />
                          <span>Estimated effort: {tc.effortMinutes as number} minutes</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resource Estimate */}
      {resource && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Resource Estimate</h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
              <p className="text-lg font-bold text-accent-blue font-mono">{resource.totalNewTests}</p>
              <p className="text-[10px] text-text-muted">New Tests</p>
            </div>
            <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
              <p className="text-lg font-bold text-accent-violet font-mono">{resource.totalDesignHours}h</p>
              <p className="text-[10px] text-text-muted">Design</p>
            </div>
            <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
              <p className="text-lg font-bold text-accent-emerald font-mono">{resource.totalExecutionHours}h</p>
              <p className="text-[10px] text-text-muted">Execution</p>
            </div>
            <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
              <p className="text-lg font-bold text-accent-amber font-mono">{resource.totalAutomationHours}h</p>
              <p className="text-[10px] text-text-muted">Automation</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
