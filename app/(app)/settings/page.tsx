'use client';

import { useState } from 'react';
import { Settings, Key, Globe, Bell, Palette, Database, Shield, ExternalLink } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [aiProvider, setAiProvider] = useState('anthropic');
  const [notifications, setNotifications] = useState(true);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [duplicateThreshold, setDuplicateThreshold] = useState(60);

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative w-10 h-5.5 rounded-full transition-colors duration-200',
        enabled ? 'bg-accent-blue' : 'bg-bg-hover'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200',
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );

  return (
    <div className="min-h-screen">
      <TopBar title="Settings" subtitle="Configure your BugSense AI workspace" />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* AI Configuration */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-accent-violet/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-accent-violet" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">AI Configuration</h3>
              <p className="text-xs text-text-muted">Configure AI provider and API keys</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">AI Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="input-field text-sm"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT-4)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">API Key</label>
              <input
                type="password"
                placeholder="sk-ant-..."
                className="input-field text-sm font-mono"
              />
              <p className="text-[10px] text-text-muted mt-1">Set via AI_API_KEY environment variable for production</p>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Model</label>
              <input
                type="text"
                defaultValue="claude-sonnet-4-20250514"
                className="input-field text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Analysis Settings */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-accent-cyan" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Analysis Settings</h3>
              <p className="text-xs text-text-muted">Customize how bugs are analyzed</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Auto-analyze on submit</p>
                <p className="text-xs text-text-muted">Automatically run AI analysis when a bug is submitted</p>
              </div>
              <Toggle enabled={autoAnalyze} onChange={setAutoAnalyze} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Email notifications</p>
                <p className="text-xs text-text-muted">Get notified about critical bugs and duplicates</p>
              </div>
              <Toggle enabled={notifications} onChange={setNotifications} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-text-primary">Duplicate detection threshold</p>
                <span className="text-xs font-mono text-accent-blue">{duplicateThreshold}%</span>
              </div>
              <input
                type="range"
                min={30}
                max={95}
                value={duplicateThreshold}
                onChange={(e) => setDuplicateThreshold(Number(e.target.value))}
                className="w-full accent-accent-blue"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-1">
                <span>Loose (30%)</span>
                <span>Strict (95%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-accent-amber" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Integrations</h3>
              <p className="text-xs text-text-muted">Connect to external tools</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Jira', desc: 'Export bugs directly to Jira issues', connected: false },
              { name: 'GitHub Issues', desc: 'Push bugs to GitHub repositories', connected: false },
              { name: 'Slack', desc: 'Get bug alerts in Slack channels', connected: false },
              { name: 'PostgreSQL', desc: 'Database for persistent storage', connected: true },
            ].map((integration) => (
              <div key={integration.name} className="flex items-center gap-4 p-3 rounded-xl bg-bg-tertiary">
                <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center">
                  <Database className="w-4 h-4 text-text-muted" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{integration.name}</p>
                  <p className="text-xs text-text-muted">{integration.desc}</p>
                </div>
                <button className={cn(
                  'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                  integration.connected
                    ? 'bg-accent-emerald/10 text-accent-emerald'
                    : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                )}>
                  {integration.connected ? 'Connected' : 'Connect'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Data */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-accent-coral/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-accent-coral" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Data & Privacy</h3>
              <p className="text-xs text-text-muted">Manage your data</p>
            </div>
          </div>
          <div className="space-y-3">
            <button className="btn-secondary w-full justify-start">
              <Database className="w-4 h-4" />
              Export all bug data (JSON)
            </button>
            <button className="btn-secondary w-full justify-start text-accent-coral hover:bg-accent-coral/5">
              <Shield className="w-4 h-4" />
              Delete all data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
