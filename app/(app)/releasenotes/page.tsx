'use client';

import { FileText, Tag, Bug, Sparkles, AlertTriangle } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

export default function ReleaseNotesPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Release Notes Generator" subtitle="Generate release notes from tickets, commits, or changelogs" />
      <GeneratorPage
        title="Generate Release Notes"
        subtitle="Paste Jira tickets, commit messages, or change descriptions"
        icon={<FileText className="w-5 h-5 text-accent-amber" />}
        placeholder="JIRA-1234: Fixed SSO login crash on OAuth callback - Critical
JIRA-1235: Added dark mode support for dashboard
JIRA-1236: Improved page load speed by 40% with lazy loading
JIRA-1237: Fixed currency symbol not updating on region change
JIRA-1238: Added file upload progress indicator
JIRA-1239: Removed deprecated v1 API endpoints (BREAKING)
JIRA-1240: Fixed search pagination count after filtering
JIRA-1241: Known issue - charts flicker on Safari 17"
        apiEndpoint="/api/releasenotes"
        buildPayload={(input, options) => ({ input, format: options.format || 'standard' })}
        generatorOptions={[
          { id: 'format', label: 'Format Style', type: 'select', defaultValue: 'standard', options: [
            { value: 'standard', label: 'Standard Release Notes' },
            { value: 'technical', label: 'Technical Changelog' },
            { value: 'user-facing', label: 'User-Facing (Simple)' },
            { value: 'changelog', label: 'CHANGELOG.md Format' },
            { value: 'slack', label: 'Slack Announcement' },
          ]},
        ]}
        exampleInputs={[
          { label: 'Feature Release', value: 'FEAT-101: Added dark mode\nFEAT-102: New onboarding wizard\nFIX-203: Login timeout on slow connections\nFIX-204: CSV export encoding issue\nPERF-301: Dashboard loads 60% faster\nBREAKING: Removed /api/v1 endpoints, migrate to /api/v2' },
          { label: 'Hotfix', value: 'HOTFIX: Critical - Payment processing fails for amounts > $10,000\nHOTFIX: High - Session expires during checkout flow\nHOTFIX: Medium - Email notifications delayed by 5+ minutes' },
          { label: 'Git Commits', value: 'feat: add two-factor authentication\nfix: resolve memory leak in dashboard polling\nfix: correct timezone handling for UTC midnight\nrefactor: migrate auth to NextAuth v5\nchore: upgrade dependencies\ndocs: update API documentation\nperf: optimize database queries with proper indexing' },
        ]}
        renderResult={(result) => {
          const sections = result.sections as Record<string, Array<Record<string, string>>>;
          const markdown = result.markdownOutput as string;
          const slack = result.slackOutput as string;

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="glass-panel p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-bold text-text-primary font-mono">{result.version as string}</span>
                  <span className="text-xs text-text-muted">{result.date as string}</span>
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-1">{result.title as string}</h3>
                <p className="text-sm text-text-secondary">{result.summary as string}</p>
              </div>

              {/* Sections */}
              {sections?.newFeatures?.length > 0 && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-accent-emerald" />
                    <h4 className="text-sm font-semibold text-accent-emerald">New Features</h4>
                  </div>
                  {sections.newFeatures.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                      <span className="text-xs font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{f.ticket}</span>
                      <div>
                        <p className="text-sm text-text-primary font-medium">{f.title}</p>
                        <p className="text-xs text-text-secondary">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sections?.improvements?.length > 0 && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-accent-blue" />
                    <h4 className="text-sm font-semibold text-accent-blue">Improvements</h4>
                  </div>
                  {sections.improvements.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                      <span className="text-xs font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{f.ticket}</span>
                      <div>
                        <p className="text-sm text-text-primary font-medium">{f.title}</p>
                        <p className="text-xs text-text-secondary">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sections?.bugFixes?.length > 0 && (
                <div className="glass-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Bug className="w-4 h-4 text-accent-coral" />
                    <h4 className="text-sm font-semibold text-accent-coral">Bug Fixes</h4>
                  </div>
                  {sections.bugFixes.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{f.ticket}</span>
                        {f.severity && (
                          <span className={cn('badge text-[10px]',
                            f.severity === 'critical' ? 'badge-critical' : f.severity === 'high' ? 'badge-high' : f.severity === 'medium' ? 'badge-medium' : 'badge-low'
                          )}>{f.severity}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-text-primary font-medium">{f.title}</p>
                        <p className="text-xs text-text-secondary">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sections?.breakingChanges?.length > 0 && (
                <div className="glass-panel p-5 border-accent-coral/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-accent-coral" />
                    <h4 className="text-sm font-semibold text-accent-coral">Breaking Changes</h4>
                  </div>
                  {sections.breakingChanges.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl bg-accent-coral/5 border border-accent-coral/10 mb-2 last:mb-0">
                      <p className="text-sm text-text-primary font-medium">{f.title}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{f.description}</p>
                      {f.migration && <p className="text-xs text-accent-amber mt-1">Migration: {f.migration}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Raw Outputs */}
              {markdown && <CodeBlock code={markdown} filename="RELEASE_NOTES.md" language="markdown" />}
              {slack && (
                <div className="glass-panel p-4">
                  <span className="text-xs font-semibold text-text-secondary mb-2 block">Slack Message</span>
                  <div className="p-3 rounded-xl bg-bg-tertiary text-sm text-text-secondary whitespace-pre-wrap">{slack}</div>
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
