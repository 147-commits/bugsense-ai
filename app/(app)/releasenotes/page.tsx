'use client';

import { useState } from 'react';
import { FileText, Tag, Bug, Sparkles, AlertTriangle, Shield, Trash2, ArrowDown, MessageSquare, Users, Code2 } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

export default function ReleaseNotesPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Release Notes Generator" subtitle="Keep a Changelog + SemVer — three output variants" />
      <GeneratorPage
        title="Generate Release Notes"
        subtitle="Paste Jira tickets, commit messages, or change descriptions"
        icon={<FileText className="w-5 h-5 text-accent-amber" />}
        placeholder="FEAT-123: Added dark mode support with system preference detection
FEAT-124: Added file upload progress indicator with cancel
PERF-456: Dashboard lazy-loads widgets — 40% faster initial render
BUG-789: Fixed SSO login crash on OAuth callback (Critical)
BUG-790: Fixed currency symbol not updating on region change
BUG-791: Fixed search pagination count after filtering
SEC-101: Patched XSS vulnerability in user profile bio field
BREAK-001: Removed /api/v1 endpoints — all consumers must migrate to /api/v2
DEP-010: Deprecated /api/v1/webhooks — use /api/v2/webhooks instead
KNOWN: Charts flicker on Safari 17 (workaround: use Chrome)"
        apiEndpoint="/api/releasenotes"
        buildPayload={(input, options) => ({ input, format: options.format || 'standard' })}
        generatorOptions={[
          { id: 'format', label: 'Primary Format', type: 'select', defaultValue: 'standard', options: [
            { value: 'standard', label: 'Standard (Keep a Changelog)' },
            { value: 'technical', label: 'Technical Changelog' },
            { value: 'user-facing', label: 'Customer-Facing' },
            { value: 'changelog', label: 'CHANGELOG.md' },
            { value: 'slack', label: 'Slack Announcement' },
          ]},
        ]}
        exampleInputs={[
          { label: 'Feature Release', value: 'FEAT-101: Added dark mode with system preference detection\nFEAT-102: New onboarding wizard with 5-step flow\nFIX-203: Login timeout on slow connections (>3s latency)\nFIX-204: CSV export UTF-8 encoding issue for international characters\nPERF-301: Dashboard loads 60% faster with virtualized lists\nBREAKING: Removed /api/v1 endpoints, migrate to /api/v2\nSEC-050: Patched CSRF vulnerability in form submissions' },
          { label: 'Hotfix', value: 'HOTFIX: Critical — Payment processing fails for amounts > $10,000 (integer overflow)\nHOTFIX: High — Session expires during checkout, losing cart contents\nHOTFIX: Medium — Email notifications delayed by 5+ minutes (queue backlog)' },
          { label: 'Git Commits', value: 'feat: add two-factor authentication via SMS and TOTP\nfeat: remember device option for 2FA (30-day cookie)\nfix: resolve memory leak in dashboard polling (setInterval not cleared)\nfix: correct timezone handling for UTC midnight edge case\nrefactor!: migrate auth from custom JWT to NextAuth v5 (BREAKING)\nchore: upgrade React 18 → 19, Next.js 14 → 15\nsecurity: patch prototype pollution in lodash dependency' },
        ]}
        renderResult={(result) => <ReleaseNotesResult result={result} />}
      />
    </div>
  );
}

// ── Tab type ──────────────────────────────────────────────────────────────────
type ViewTab = 'changelog' | 'engineering' | 'customer' | 'slack';

function ReleaseNotesResult({ result }: { result: Record<string, unknown> }) {
  const [tab, setTab] = useState<ViewTab>('changelog');

  const changelog = result.changelog as Record<string, Array<Record<string, string>>> | undefined;
  const engineering = result.engineeringNotes as {
    riskAssessment?: Record<string, unknown>;
    deploymentSteps?: string[];
    breakingChanges?: Array<Record<string, string>>;
    performanceImpact?: Array<Record<string, string>>;
    migrations?: Array<Record<string, string>>;
    configChanges?: Array<Record<string, string>>;
    rollbackProcedure?: string;
    markdownOutput?: string;
  } | undefined;
  const customer = result.customerNotes as Record<string, unknown> | undefined;
  const slackOutput = result.slackOutput as string | undefined;
  // Backward compat
  const sections = result.sections as Record<string, Array<Record<string, string>>> | undefined;

  const TABS: { id: ViewTab; label: string; icon: typeof Code2 }[] = [
    { id: 'changelog', label: 'Changelog', icon: FileText },
    { id: 'engineering', label: 'Engineering', icon: Code2 },
    { id: 'customer', label: 'Customer', icon: Users },
    { id: 'slack', label: 'Slack', icon: MessageSquare },
  ];

  const CHANGELOG_CATS: { key: string; label: string; icon: typeof Sparkles; color: string }[] = [
    { key: 'added', label: 'Added', icon: Sparkles, color: 'text-accent-emerald' },
    { key: 'changed', label: 'Changed', icon: Tag, color: 'text-accent-blue' },
    { key: 'deprecated', label: 'Deprecated', icon: AlertTriangle, color: 'text-accent-amber' },
    { key: 'removed', label: 'Removed', icon: Trash2, color: 'text-accent-coral' },
    { key: 'fixed', label: 'Fixed', icon: Bug, color: 'text-accent-cyan' },
    { key: 'security', label: 'Security', icon: Shield, color: 'text-accent-violet' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-lg font-bold text-text-primary font-mono">{result.version as string}</span>
          {result.versionBump ? (
            <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold border',
              result.versionBump === 'major' ? 'bg-accent-coral/15 text-accent-coral border-accent-coral/20' :
              result.versionBump === 'minor' ? 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/20' :
              'bg-accent-blue/15 text-accent-blue border-accent-blue/20'
            )}>
              {(result.versionBump as string).toUpperCase()}
            </span>
          ) : null}
          <span className="text-xs text-text-muted">{result.date as string}</span>
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">{result.title as string}</h3>
        <p className="text-sm text-text-secondary mb-2">{result.summary as string}</p>
        {result.versionRationale ? (
          <p className="text-[10px] text-text-muted italic">{result.versionRationale as string}</p>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
                tab === t.id ? 'bg-accent-blue/15 text-accent-blue' : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Changelog Tab ─────────────────────────────────────────── */}
      {tab === 'changelog' && (
        <div className="space-y-4">
          {changelog ? (
            CHANGELOG_CATS.map(({ key, label, icon: Icon, color }) => {
              const items = changelog[key];
              if (!items || items.length === 0) return null;
              return (
                <div key={key} className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={cn('w-4 h-4', color)} />
                    <h4 className={cn('text-sm font-semibold', color)}>{label}</h4>
                    <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.ticket && <span className="text-xs font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{item.ticket}</span>}
                        {item.component && <span className="text-[10px] text-text-muted">[{item.component}]</span>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-text-primary">{item.description || item.title}</p>
                        {item.severity && (
                          <span className={cn('badge text-[10px] mt-0.5 inline-block',
                            item.severity === 'critical' ? 'bg-accent-coral/10 text-accent-coral border-accent-coral/20' :
                            item.severity === 'high' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/20' :
                            'bg-bg-tertiary text-text-muted border-border'
                          )}>{item.severity}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          ) : sections ? (
            /* Backward compat with old format */
            <>
              {sections.newFeatures?.length > 0 && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-accent-emerald" />
                    <h4 className="text-sm font-semibold text-accent-emerald">Added</h4>
                  </div>
                  {sections.newFeatures.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 mb-2">
                      <span className="text-xs font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{f.ticket}</span>
                      <div><p className="text-sm text-text-primary font-medium">{f.title}</p><p className="text-xs text-text-secondary">{f.description}</p></div>
                    </div>
                  ))}
                </div>
              )}
              {sections.bugFixes?.length > 0 && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Bug className="w-4 h-4 text-accent-cyan" />
                    <h4 className="text-sm font-semibold text-accent-cyan">Fixed</h4>
                  </div>
                  {sections.bugFixes.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 mb-2">
                      <span className="text-xs font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{f.ticket}</span>
                      <div><p className="text-sm text-text-primary font-medium">{f.title}</p><p className="text-xs text-text-secondary">{f.description}</p></div>
                    </div>
                  ))}
                </div>
              )}
              {sections.breakingChanges?.length > 0 && (
                <div className="glass-panel p-5 border-accent-coral/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-accent-coral" />
                    <h4 className="text-sm font-semibold text-accent-coral">Breaking Changes</h4>
                  </div>
                  {sections.breakingChanges.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl bg-accent-coral/5 border border-accent-coral/10 mb-2">
                      <p className="text-sm text-text-primary font-medium">{f.title}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{f.description}</p>
                      {f.migration && <p className="text-xs text-accent-amber mt-1">Migration: {f.migration}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {result.markdownOutput ? (
            <CodeBlock code={result.markdownOutput as string} filename="CHANGELOG.md" language="markdown" />
          ) : null}
        </div>
      )}

      {/* ── Engineering Tab ────────────────────────────────────────── */}
      {tab === 'engineering' && engineering && (
        <div className="space-y-4">
          {/* Risk Assessment */}
          {engineering.riskAssessment ? (() => {
            const risk = engineering.riskAssessment as Record<string, unknown>;
            return (
              <div className="glass-panel p-5">
                <h4 className="text-sm font-semibold text-text-primary mb-3">Risk Assessment</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
                    <span className={cn('text-lg font-bold',
                      risk.overallRisk === 'High' ? 'text-accent-coral' : risk.overallRisk === 'Medium' ? 'text-accent-amber' : 'text-accent-emerald'
                    )}>{risk.overallRisk as string}</span>
                    <p className="text-[10px] text-text-muted">Overall Risk</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
                    <span className="text-lg font-bold text-text-primary">{risk.rollbackComplexity as string}</span>
                    <p className="text-[10px] text-text-muted">Rollback</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-bg-tertiary text-center">
                    <span className={cn('text-lg font-bold', risk.requiresDowntime ? 'text-accent-coral' : 'text-accent-emerald')}>
                      {risk.requiresDowntime ? 'Yes' : 'No'}
                    </span>
                    <p className="text-[10px] text-text-muted">Downtime</p>
                  </div>
                </div>
                {risk.justification ? <p className="text-xs text-text-muted mt-2">{risk.justification as string}</p> : null}
              </div>
            );
          })() : null}

          {/* Deployment Steps */}
          {Array.isArray(engineering.deploymentSteps) && engineering.deploymentSteps.length > 0 ? (
            <div className="glass-panel p-5">
              <h4 className="text-sm font-semibold text-text-primary mb-3">Deployment Steps</h4>
              {(engineering.deploymentSteps as string[]).map((step, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <span className="text-xs font-mono text-accent-blue flex-shrink-0">{i + 1}.</span>
                  <span className="text-xs text-text-secondary">{step.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Breaking Changes with Before/After */}
          <BreakingChangesSection items={engineering.breakingChanges as Array<Record<string, string>> | undefined} />

          {/* Performance Impact */}
          {(engineering.performanceImpact as Array<Record<string, string>>)?.length > 0 && (
            <div className="glass-panel p-5">
              <h4 className="text-sm font-semibold text-text-primary mb-3">Performance Impact</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-2 text-text-muted font-medium">Area</th>
                      <th className="text-center py-1.5 px-2 text-accent-coral font-medium">Before</th>
                      <th className="text-center py-1.5 px-2 text-text-muted"><ArrowDown className="w-3 h-3 inline" /></th>
                      <th className="text-center py-1.5 px-2 text-accent-emerald font-medium">After</th>
                      <th className="text-left py-1.5 px-2 text-text-muted font-medium">Improvement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(engineering.performanceImpact as Array<Record<string, string>>).map((p, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 px-2 text-text-primary font-medium">{p.area}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-accent-coral">{p.before}</td>
                        <td className="py-1.5 px-2 text-center text-text-muted">→</td>
                        <td className="py-1.5 px-2 text-center font-mono text-accent-emerald">{p.after}</td>
                        <td className="py-1.5 px-2 text-accent-emerald font-medium">{p.improvement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Migrations & Config */}
          {(engineering.migrations as Array<Record<string, string>>)?.length > 0 && (
            <div className="glass-panel p-5">
              <h4 className="text-sm font-semibold text-text-primary mb-3">Migrations</h4>
              {(engineering.migrations as Array<Record<string, string>>).map((m, i) => (
                <div key={i} className="p-3 rounded-lg bg-bg-tertiary mb-2 last:mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-medium">{m.type}</span>
                    <span className="text-xs text-text-primary">{m.description}</span>
                  </div>
                  <code className="text-[10px] text-accent-emerald font-mono">$ {m.command}</code>
                  {m.rollbackCommand && <p className="text-[10px] text-text-muted mt-0.5">Rollback: <code className="font-mono">{m.rollbackCommand}</code></p>}
                </div>
              ))}
            </div>
          )}

          {/* Rollback */}
          {engineering.rollbackProcedure && (
            <div className="glass-panel p-5">
              <h4 className="text-sm font-semibold text-text-primary mb-2">Rollback Procedure</h4>
              <pre className="text-xs text-text-secondary whitespace-pre-wrap">{engineering.rollbackProcedure as string}</pre>
            </div>
          )}

          {(engineering.markdownOutput as string)?.length > 20 && (
            <CodeBlock code={engineering.markdownOutput as string} filename="ENGINEERING_NOTES.md" language="markdown" />
          )}
        </div>
      )}

      {/* ── Customer Tab ──────────────────────────────────────────── */}
      {tab === 'customer' && customer && (
        <div className="space-y-4">
          {(customer.highlights as Array<Record<string, string>>)?.length > 0 && (
            <div className="glass-panel p-5">
              <h4 className="text-sm font-semibold text-accent-emerald mb-3">Highlights</h4>
              {(customer.highlights as Array<Record<string, string>>).map((h, i) => (
                <div key={i} className="p-3 rounded-xl bg-accent-emerald/5 border border-accent-emerald/10 mb-2 last:mb-0">
                  <p className="text-sm text-text-primary font-semibold">{h.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{h.description}</p>
                </div>
              ))}
            </div>
          )}

          {(customer.improvements as Array<Record<string, string>>)?.length > 0 && (
            <div className="glass-panel p-5">
              <h4 className="text-sm font-semibold text-accent-blue mb-3">Improvements</h4>
              {(customer.improvements as Array<Record<string, string>>).map((item, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <p className="text-sm text-text-primary font-medium">{item.title}</p>
                  <p className="text-xs text-text-secondary">{item.description}</p>
                </div>
              ))}
            </div>
          )}

          {(customer.fixes as Array<Record<string, string>>)?.length > 0 && (
            <div className="glass-panel p-5">
              <h4 className="text-sm font-semibold text-accent-cyan mb-3">Fixes</h4>
              {(customer.fixes as Array<Record<string, string>>).map((item, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <p className="text-sm text-text-primary font-medium">{item.title}</p>
                  <p className="text-xs text-text-secondary">{item.description}</p>
                </div>
              ))}
            </div>
          )}

          {(customer.knownIssues as Array<Record<string, string>>)?.length > 0 && (
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-accent-amber" />
                <h4 className="text-sm font-semibold text-accent-amber">Known Issues</h4>
              </div>
              {(customer.knownIssues as Array<Record<string, string>>).map((ki, i) => (
                <div key={i} className="p-3 rounded-xl bg-accent-amber/5 border border-accent-amber/10 mb-2 last:mb-0">
                  <p className="text-sm text-text-primary font-medium">{ki.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{ki.description}</p>
                  {ki.workaround && <p className="text-xs text-accent-emerald mt-1">Workaround: {ki.workaround}</p>}
                </div>
              ))}
            </div>
          )}

          {(customer.markdownOutput as string)?.length > 20 && (
            <CodeBlock code={customer.markdownOutput as string} filename="RELEASE_NOTES.md" language="markdown" />
          )}
        </div>
      )}

      {/* ── Slack Tab ─────────────────────────────────────────────── */}
      {tab === 'slack' && (
        <div className="space-y-4">
          {slackOutput && (
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-accent-violet" />
                <h4 className="text-sm font-semibold text-text-primary">Slack Announcement</h4>
              </div>
              <div className="p-4 rounded-xl bg-bg-tertiary text-sm text-text-secondary whitespace-pre-wrap leading-relaxed border border-border">
                {slackOutput}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(slackOutput)}
                className="btn-secondary text-xs mt-3"
              >
                Copy to clipboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakingChangesSection({ items }: { items: Array<Record<string, string>> | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="glass-panel p-5 border-accent-coral/20">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-accent-coral" />
        <h4 className="text-sm font-semibold text-accent-coral">Breaking Changes</h4>
      </div>
      {items.map((bc, i) => (
        <div key={i} className="p-4 rounded-xl bg-accent-coral/5 border border-accent-coral/10 mb-3 last:mb-0 space-y-2">
          <p className="text-sm text-text-primary font-semibold">{bc.title}</p>
          <p className="text-xs text-text-secondary">{bc.description}</p>
          {bc.before && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-accent-coral/10">
                <span className="text-[10px] text-accent-coral font-semibold">Before</span>
                <pre className="text-[10px] text-text-secondary font-mono mt-1 whitespace-pre-wrap">{bc.before}</pre>
              </div>
              <div className="p-2 rounded-lg bg-accent-emerald/10">
                <span className="text-[10px] text-accent-emerald font-semibold">After</span>
                <pre className="text-[10px] text-text-secondary font-mono mt-1 whitespace-pre-wrap">{bc.after}</pre>
              </div>
            </div>
          )}
          {bc.migrationGuide && (
            <div className="p-2 rounded-lg bg-bg-tertiary">
              <span className="text-[10px] text-accent-amber font-semibold">Migration Guide</span>
              <pre className="text-[10px] text-text-secondary font-mono mt-1 whitespace-pre-wrap">{bc.migrationGuide}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
