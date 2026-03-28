'use client';

import { Shield, TrendingUp } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import { cn } from '@/lib/utils';

export default function CoveragePage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Coverage Expander" subtitle="Expand existing test coverage with AI-identified gaps" />
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
        renderResult={(result) => {
          const analysis = result.analysis as Record<string, unknown>;
          const newTests = (result.newTestCases || []) as Array<Record<string, unknown>>;

          const catColors: Record<string, string> = {
            edge_case: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
            negative: 'bg-accent-coral/10 text-accent-coral border-accent-coral/20',
            security: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
            performance: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
            accessibility: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
          };

          return (
            <div className="space-y-4">
              {/* Coverage Score */}
              {analysis && (
                <div className="glass-panel p-5">
                  <h4 className="text-sm font-semibold text-text-primary mb-3">Coverage Analysis</h4>
                  <div className="flex items-center gap-6 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-accent-coral font-mono">{analysis.currentScore as number}%</p>
                      <p className="text-[10px] text-text-muted">Current</p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-accent-emerald" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-accent-emerald font-mono">{analysis.projectedScore as number}%</p>
                      <p className="text-[10px] text-text-muted">After Expansion</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-lg font-bold text-accent-blue">{result.coverageImprovement as string}</p>
                      <p className="text-[10px] text-text-muted">Improvement</p>
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary mb-3">{analysis.existingCoverage as string}</p>

                  {(analysis.gaps as string[])?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-accent-amber">Identified Gaps:</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(analysis.gaps as string[]).map((g, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* New Test Cases */}
              <div className="glass-panel p-4">
                <span className="text-xs font-semibold text-text-secondary">{result.totalNewTests as number} new test cases to add</span>
              </div>

              {newTests.map((tc, i) => (
                <div key={i} className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('badge text-[10px]', catColors[tc.category as string] || 'badge-info')}>
                      {(tc.category as string)?.replace('_', ' ')}
                    </span>
                    <span className="badge bg-bg-hover text-text-muted border-border text-[10px]">{tc.priority as string}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-text-primary mb-1">{tc.title as string}</h4>
                  <p className="text-xs text-text-secondary mb-2">{tc.description as string}</p>

                  <div className="space-y-1 mb-2">
                    {(tc.steps as string[])?.map((step, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <span className="text-[10px] font-mono text-accent-blue mt-0.5">{j + 1}.</span>
                        <span className="text-xs text-text-secondary">{step}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border space-y-1">
                    <div>
                      <span className="text-[10px] text-accent-emerald font-medium">Expected: </span>
                      <span className="text-xs text-text-secondary">{tc.expectedResult as string}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-accent-amber font-medium">Why needed: </span>
                      <span className="text-xs text-text-secondary">{tc.whyNeeded as string}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        }}
      />
    </div>
  );
}
