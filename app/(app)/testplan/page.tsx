'use client';

import { ClipboardList, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

export default function TestPlanPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Sprint Test Plan" subtitle="Generate complete test plans from sprint stories" />
      <GeneratorPage
        title="Generate Test Plan"
        subtitle="Paste your sprint user stories or Jira tickets"
        icon={<ClipboardList className="w-5 h-5 text-accent-cyan" />}
        placeholder="Sprint 24 - Auth Improvements: US-401 Implement 2FA via SMS and authenticator app, US-402 Remember device option for 2FA, US-403 Password strength meter, US-404 Account lockout after 5 failures, US-405 Social login (Google, GitHub), BUG-891 Fix session timeout redirect, BUG-892 Fix password reset 404"
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
          { label: 'Auth Sprint', value: 'Sprint 24: US-401 Implement 2FA via SMS/authenticator, US-402 Remember device for 2FA, US-403 Password strength meter, US-404 Account lockout after 5 failures, BUG-891 Fix session timeout redirect, BUG-892 Fix password reset 404' },
          { label: 'E-commerce Sprint', value: 'Sprint 12: US-201 Shopping cart persistence across sessions, US-202 Apply discount codes at checkout, US-203 Order tracking page with real-time updates, US-204 Guest checkout without registration, BUG-445 Tax calculation wrong for international orders' },
        ]}
        renderResult={(result) => {
          const plan = result.testPlan as Record<string, unknown>;
          const stories = (result.stories || []) as Array<Record<string, unknown>>;
          const schedule = (result.schedule || []) as Array<Record<string, unknown>>;
          const criteria = result.entryExitCriteria as Record<string, string[]>;
          const risks = (result.risks || []) as Array<Record<string, string>>;
          const regression = (result.regressionSuite || []) as Array<Record<string, unknown>>;
          const markdown = result.markdownOutput as string;

          return (
            <div className="space-y-4">
              {/* Plan Header */}
              {plan && (
                <div className="glass-panel p-5">
                  <h3 className="text-base font-bold text-text-primary mb-1">{plan.sprintName as string}</h3>
                  <p className="text-sm text-text-secondary mb-3">{plan.objective as string}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2 rounded-lg bg-bg-tertiary text-center">
                      <p className="text-lg font-bold text-accent-blue font-mono">{plan.estimatedHours as number}h</p>
                      <p className="text-[10px] text-text-muted">Estimated</p>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-tertiary text-center">
                      <p className="text-lg font-bold text-accent-amber font-mono">{plan.riskAssessment as string}</p>
                      <p className="text-[10px] text-text-muted">Risk</p>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-tertiary text-center">
                      <p className="text-lg font-bold text-accent-emerald font-mono">{(plan.testEnvironments as string[])?.length}</p>
                      <p className="text-[10px] text-text-muted">Environments</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stories Breakdown */}
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
                          story.riskLevel === 'high' ? 'badge-critical' : story.riskLevel === 'medium' ? 'badge-medium' : 'badge-low'
                        )}>{story.riskLevel as string} risk</span>
                      </div>
                      {(story.testCases as Array<Record<string, unknown>>)?.map((tc, j) => (
                        <div key={j} className="flex items-center gap-3 text-xs ml-4 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                          <span className="text-text-secondary flex-1">{tc.title as string}</span>
                          <span className="text-text-muted">{tc.estimatedMinutes as number}min</span>
                          <span className="text-text-muted font-mono">{tc.priority as string}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Schedule */}
              {schedule.length > 0 && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-accent-blue" />
                    <h4 className="text-sm font-semibold text-text-primary">Schedule</h4>
                  </div>
                  {schedule.map((day, i) => (
                    <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue text-xs font-bold flex items-center justify-center">D{day.day as number}</span>
                      <div className="flex-1">
                        {(day.activities as string[])?.map((a, j) => <p key={j} className="text-xs text-text-secondary">• {a}</p>)}
                        {day.milestone ? <p className="text-xs text-accent-emerald mt-0.5">🏁 {day.milestone as string}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Entry/Exit Criteria */}
              {criteria && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-panel p-4">
                    <span className="text-xs font-semibold text-accent-emerald mb-2 block">✅ Entry Criteria</span>
                    {criteria.entry?.map((c, i) => <p key={i} className="text-xs text-text-secondary mb-1">• {c}</p>)}
                  </div>
                  <div className="glass-panel p-4">
                    <span className="text-xs font-semibold text-accent-blue mb-2 block">🏁 Exit Criteria</span>
                    {criteria.exit?.map((c, i) => <p key={i} className="text-xs text-text-secondary mb-1">• {c}</p>)}
                  </div>
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
                      <p className="text-sm text-text-primary font-medium">{r.risk}</p>
                      <p className="text-xs text-text-secondary mt-0.5">Mitigation: {r.mitigation}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Markdown */}
              {markdown && <CodeBlock code={markdown} filename="TEST_PLAN.md" language="markdown" />}
            </div>
          );
        }}
      />
    </div>
  );
}
