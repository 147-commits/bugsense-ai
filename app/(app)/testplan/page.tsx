'use client';

import { ClipboardList, Calendar, AlertTriangle, CheckCircle, Shield, Users, Layers, Clock } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

export default function TestPlanPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Sprint Test Plan" subtitle="ISO/IEC/IEEE 29119-3 agile test plans" />
      <GeneratorPage
        title="Generate Test Plan"
        subtitle="Paste your sprint user stories or Jira tickets"
        icon={<ClipboardList className="w-5 h-5 text-accent-cyan" />}
        placeholder="Sprint 24 - Auth Improvements:
US-401 Implement 2FA via SMS and authenticator app
US-402 Remember device option for 2FA
US-403 Password strength meter
US-404 Account lockout after 5 failures
US-405 Social login (Google, GitHub)
BUG-891 Fix session timeout redirect
BUG-892 Fix password reset 404"
        apiEndpoint="/api/testplan"
        buildPayload={(input, options) => ({ sprintInfo: input, options })}
        generatorOptions={[
          { id: 'sprintDuration', label: 'Sprint Duration (days)', type: 'number', defaultValue: 14 },
          { id: 'teamSize', label: 'QA Team Size', type: 'number', defaultValue: 2 },
          { id: 'includeRegression', label: 'Include regression suite', type: 'toggle', defaultValue: true },
          { id: 'riskLevel', label: 'Risk Level', type: 'select', defaultValue: 'medium', options: [
            { value: 'low', label: 'Low Risk' },
            { value: 'medium', label: 'Medium Risk' },
            { value: 'high', label: 'High Risk' },
          ]},
        ]}
        exampleInputs={[
          { label: 'Auth Sprint', value: 'Sprint 24 — Auth Improvements:\nUS-401 Implement 2FA via SMS and authenticator app\nUS-402 Remember device option for 2FA\nUS-404 Account lockout after 5 consecutive failures\nBUG-891 Fix session timeout redirect (expired session should go to /login)\nBUG-892 Fix password reset returning 404' },
          { label: 'E-commerce Sprint', value: 'Sprint 12 — Checkout Flow:\nUS-201 Shopping cart persistence across sessions (logged-in users)\nUS-202 Apply discount codes at checkout (validate code, show savings)\nUS-203 Order tracking page with real-time status updates\nUS-204 Guest checkout without registration\nBUG-445 Tax calculation wrong for international orders' },
        ]}
        renderResult={(result) => <TestPlanResult result={result} />}
      />
    </div>
  );
}

function TestPlanResult({ result }: { result: Record<string, unknown> }) {
  const plan = result.testPlan as Record<string, unknown> | undefined;
  const scope = result.scope as { inScope?: Array<Record<string, unknown>>; outOfScope?: Array<Record<string, string>> } | undefined;
  const riskMatrix = (result.riskMatrix || []) as Array<Record<string, unknown>>;
  const quadrants = result.testingQuadrants as Record<string, { label: string; items: string[] }> | undefined;
  const estimation = (result.estimation || []) as Array<Record<string, unknown>>;
  const resourceAllocation = (result.resourceAllocation || []) as Array<Record<string, unknown>>;
  const stories = (result.stories || []) as Array<Record<string, unknown>>;
  const regressionSuite = (result.regressionSuite || []) as Array<Record<string, unknown>>;
  const schedule = (result.schedule || []) as Array<Record<string, unknown>>;
  const envData = (result.environmentAndData || []) as Array<Record<string, string>>;
  const criteria = result.entryExitCriteria as Record<string, string[]> | undefined;
  const dependencies = (result.dependencies || []) as Array<Record<string, string>>;
  const dod = (result.definitionOfDone || []) as string[];
  const risks = (result.risks || []) as Array<Record<string, string>>;
  const markdown = result.markdownOutput as string | undefined;

  const quadrantColors: Record<string, string> = {
    q1: 'border-accent-blue/30 bg-accent-blue/5',
    q2: 'border-accent-emerald/30 bg-accent-emerald/5',
    q3: 'border-accent-amber/30 bg-accent-amber/5',
    q4: 'border-accent-coral/30 bg-accent-coral/5',
  };

  return (
    <div className="space-y-4">
      {/* Plan Header */}
      {plan && (
        <div className="glass-panel p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-base font-bold text-text-primary">{plan.sprintName as string}</h3>
              <p className="text-xs text-text-muted">{plan.sprintDates as string || ''}</p>
            </div>
            <span className="badge bg-accent-amber/15 text-accent-amber border-accent-amber/20">{plan.approvalStatus as string || 'Draft'}</span>
          </div>
          <p className="text-sm text-text-secondary mb-4">{plan.objective as string}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
              <p className="text-lg font-bold text-accent-blue font-mono">{plan.estimatedHours as number}h</p>
              <p className="text-[10px] text-text-muted">Total Estimated</p>
            </div>
            <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
              <p className="text-lg font-bold text-accent-emerald font-mono">{(plan.testEnvironments as string[])?.length || 0}</p>
              <p className="text-[10px] text-text-muted">Environments</p>
            </div>
            <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
              <p className="text-lg font-bold text-accent-violet font-mono">{stories.length}</p>
              <p className="text-[10px] text-text-muted">Stories</p>
            </div>
          </div>
        </div>
      )}

      {/* Scope */}
      {scope && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Test Scope</h4>
          {scope.inScope && scope.inScope.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-semibold text-accent-emerald uppercase tracking-wider block mb-2">In Scope</span>
              {scope.inScope.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-bg-tertiary mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-accent-blue">{item.storyId as string}</span>
                    <span className="text-xs font-medium text-text-primary">{item.title as string}</span>
                  </div>
                  {(item.acceptanceCriteria as string[])?.map((ac, j) => (
                    <p key={j} className="text-[10px] text-text-muted ml-4">• {ac}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
          {scope.outOfScope && scope.outOfScope.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-accent-coral uppercase tracking-wider block mb-2">Out of Scope</span>
              {scope.outOfScope.map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-accent-coral/5 mb-1">
                  <span className="text-xs text-text-secondary">{item.item}</span>
                  <span className="text-[10px] text-text-muted flex-shrink-0">— {item.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Risk Matrix */}
      {riskMatrix.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-accent-amber" />
            <h4 className="text-sm font-semibold text-text-primary">Risk Assessment Matrix</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">ID</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Description</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">L</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">I</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Score</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Mitigation</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {riskMatrix.map((r, i) => {
                  const score = r.score as number;
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-mono text-text-muted">{r.riskId as string}</td>
                      <td className="py-1.5 px-2 text-text-secondary">{r.description as string}</td>
                      <td className="py-1.5 px-2 text-center font-mono">{r.likelihood as number}</td>
                      <td className="py-1.5 px-2 text-center font-mono">{r.impact as number}</td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold',
                          score >= 15 ? 'bg-accent-coral/15 text-accent-coral' :
                          score >= 8 ? 'bg-accent-amber/15 text-accent-amber' :
                          'bg-accent-emerald/15 text-accent-emerald'
                        )}>{score}</span>
                      </td>
                      <td className="py-1.5 px-2 text-text-secondary">{r.mitigation as string}</td>
                      <td className="py-1.5 px-2 text-text-muted font-mono">{r.owner as string}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Testing Quadrants */}
      {quadrants && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-accent-violet" />
            <h4 className="text-sm font-semibold text-text-primary">Agile Testing Quadrants</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => {
              const data = quadrants[q];
              if (!data) return null;
              return (
                <div key={q} className={cn('p-3 rounded-xl border', quadrantColors[q])}>
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{q.toUpperCase()}: {data.label}</span>
                  <div className="mt-1.5 space-y-0.5">
                    {data.items.map((item, i) => (
                      <p key={i} className="text-xs text-text-secondary">• {item}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Estimation Table */}
      {estimation.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-accent-blue" />
            <h4 className="text-sm font-semibold text-text-primary">Test Estimation</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Story</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Design</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Execute</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Automate</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Regress</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Total</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {estimation.map((e, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2">
                      <span className="font-mono text-accent-blue">{e.storyId as string}</span>
                      <span className="text-text-muted ml-1">{e.title as string}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono">{e.testDesignHrs as number}h</td>
                    <td className="py-1.5 px-2 text-center font-mono">{e.testExecutionHrs as number}h</td>
                    <td className="py-1.5 px-2 text-center font-mono">{e.automationHrs as number}h</td>
                    <td className="py-1.5 px-2 text-center font-mono">{e.regressionHrs as number}h</td>
                    <td className="py-1.5 px-2 text-center font-mono font-bold text-accent-blue">{e.totalHrs as number}h</td>
                    <td className="py-1.5 px-2 font-mono text-text-muted">{e.assignee as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resource Allocation */}
      {resourceAllocation.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-accent-emerald" />
            <h4 className="text-sm font-semibold text-text-primary">Resource Allocation</h4>
          </div>
          {resourceAllocation.map((ra, i) => (
            <div key={i} className="p-3 rounded-lg bg-bg-tertiary mb-2 last:mb-0">
              <span className="text-xs font-bold text-text-primary">{ra.member as string}</span>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                <div>
                  <span className="text-[10px] text-text-muted">Primary</span>
                  <p className="text-xs text-text-secondary font-mono">{(ra.primaryStories as string[])?.join(', ')}</p>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted">Backup</span>
                  <p className="text-xs text-text-secondary font-mono">{(ra.backup as string[])?.join(', ')}</p>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted">Regression</span>
                  <p className="text-xs text-text-secondary">{(ra.regressionAreas as string[])?.join(', ')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Story Breakdown */}
      {stories.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Story Test Breakdown</h4>
          {stories.map((story, i) => (
            <div key={i} className="p-3 rounded-xl bg-bg-tertiary mb-2 last:mb-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-accent-blue">{story.storyId as string}</span>
                  <span className="text-sm font-medium text-text-primary">{story.title as string}</span>
                </div>
                <span className={cn('badge text-[10px]',
                  story.riskLevel === 'high' ? 'bg-accent-coral/10 text-accent-coral border-accent-coral/20' :
                  story.riskLevel === 'medium' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/20' :
                  'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20'
                )}>{story.riskLevel as string} risk</span>
              </div>
              {(story.testCases as Array<Record<string, unknown>>)?.map((tc, j) => (
                <div key={j} className="flex items-center gap-3 text-xs ml-4 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />
                  <span className="text-text-secondary flex-1">{tc.title as string}</span>
                  <span className="text-text-muted">{tc.estimatedMinutes as number}min</span>
                  <span className="text-text-muted font-mono">{tc.priority as string}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Regression Suite */}
      {regressionSuite.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Regression Scope</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Area</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Reason</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Tests</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Time</th>
                  <th className="text-center py-1.5 px-2 text-text-muted font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {regressionSuite.map((reg, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2 text-text-primary font-medium">{reg.area as string}</td>
                    <td className="py-1.5 px-2 text-text-secondary">{reg.reason as string}</td>
                    <td className="py-1.5 px-2 text-center font-mono">{reg.tests as number}</td>
                    <td className="py-1.5 px-2 text-center font-mono">{reg.estimatedMinutes as number}m</td>
                    <td className="py-1.5 px-2 text-center font-mono">{reg.priority as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule */}
      {schedule.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-accent-blue" />
            <h4 className="text-sm font-semibold text-text-primary">Daily Schedule</h4>
          </div>
          {schedule.map((day, i) => (
            <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue text-xs font-bold flex items-center justify-center">D{day.day as number}</span>
              <div className="flex-1">
                {(day.activities as string[])?.map((a, j) => <p key={j} className="text-xs text-text-secondary">• {a}</p>)}
                {day.milestone ? <p className="text-xs text-accent-emerald mt-0.5 font-medium">🏁 {day.milestone as string}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entry/Exit Criteria */}
      {criteria && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-panel p-4">
            <span className="text-[10px] font-semibold text-accent-emerald uppercase tracking-wider mb-2 block">Entry Criteria</span>
            {criteria.entry?.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 mb-1">
                <CheckCircle className="w-3 h-3 text-accent-emerald mt-0.5 flex-shrink-0" />
                <p className="text-xs text-text-secondary">{c}</p>
              </div>
            ))}
          </div>
          <div className="glass-panel p-4">
            <span className="text-[10px] font-semibold text-accent-blue uppercase tracking-wider mb-2 block">Exit Criteria</span>
            {criteria.exit?.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 mb-1">
                <CheckCircle className="w-3 h-3 text-accent-blue mt-0.5 flex-shrink-0" />
                <p className="text-xs text-text-secondary">{c}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {dependencies.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Dependencies & Blockers</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Dependency</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Type</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Status</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {dependencies.map((dep, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2 text-text-secondary">{dep.dependency}</td>
                    <td className="py-1.5 px-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border">{dep.type}</span></td>
                    <td className="py-1.5 px-2">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                        dep.status === 'resolved' ? 'bg-accent-emerald/15 text-accent-emerald' :
                        dep.status === 'blocked' ? 'bg-accent-coral/15 text-accent-coral' :
                        'bg-accent-amber/15 text-accent-amber'
                      )}>{dep.status}</span>
                    </td>
                    <td className="py-1.5 px-2 text-text-muted">{dep.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Definition of Done */}
      {dod.length > 0 && (
        <div className="glass-panel p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3">QA Definition of Done</h4>
          {dod.map((item, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-accent-emerald mt-0.5 flex-shrink-0" />
              <span className="text-xs text-text-secondary">{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-accent-amber" />
            <h4 className="text-sm font-semibold text-text-primary">Risks & Mitigations</h4>
          </div>
          {risks.map((r, i) => (
            <div key={i} className="p-3 rounded-xl bg-bg-tertiary mb-2 last:mb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-text-primary font-medium">{r.risk}</p>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium flex-shrink-0',
                  r.probability === 'high' ? 'bg-accent-coral/15 text-accent-coral' :
                  r.probability === 'medium' ? 'bg-accent-amber/15 text-accent-amber' :
                  'bg-accent-emerald/15 text-accent-emerald'
                )}>{r.probability}</span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">Mitigation: {r.mitigation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Markdown */}
      {markdown && markdown.length > 20 && <CodeBlock code={markdown} filename="TEST_PLAN.md" language="markdown" />}
    </div>
  );
}
