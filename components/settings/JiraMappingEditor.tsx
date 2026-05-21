'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RotateCcw, Save } from 'lucide-react';
import type { JiraMappings, JiraPriorityKey, JiraStatusKey } from '@/types/jira';

const STATUS_KEYS: JiraStatusKey[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DUPLICATE'];
const PRIORITY_KEYS: JiraPriorityKey[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

interface FetchResponse {
  connected: boolean;
  mappings?: JiraMappings;
  defaults?: JiraMappings;
}

export default function JiraMappingEditor() {
  const [mappings, setMappings] = useState<JiraMappings | null>(null);
  const [defaults, setDefaults] = useState<JiraMappings | null>(null);
  const [connected, setConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/integrations/jira/mappings');
      if (!res.ok) {
        setConnected(false);
        return;
      }
      const data: FetchResponse = await res.json();
      setConnected(data.connected);
      if (data.mappings) setMappings(data.mappings);
      if (data.defaults) setDefaults(data.defaults);
    } catch {
      setError('Failed to load mappings.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!mappings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/jira/mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappings),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Save failed (${res.status})`);
        return;
      }
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (defaults) setMappings(defaults);
  };

  if (!connected) {
    return (
      <div className="glass-panel p-6">
        <p className="text-sm text-text-secondary">
          Jira is not connected for this organization.{' '}
          <a href="/settings" className="text-accent-blue hover:underline">
            Connect it in Settings
          </a>{' '}
          first.
        </p>
      </div>
    );
  }

  if (!mappings) {
    return <div className="text-xs text-text-muted">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Jira project key</label>
          <input
            value={mappings.projectKey ?? ''}
            onChange={(e) => setMappings({ ...mappings, projectKey: e.target.value.toUpperCase() || null })}
            placeholder="ENG"
            className="input-field text-sm font-mono"
          />
          <p className="text-[10px] text-text-muted mt-1">
            New issues are created in this project. Uppercase letters/digits/underscore.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Issue type</label>
          <input
            value={mappings.issueTypeName}
            onChange={(e) => setMappings({ ...mappings, issueTypeName: e.target.value })}
            placeholder="Task"
            className="input-field text-sm"
          />
        </div>
      </div>

      <MappingTable
        title="Status"
        description="BugSense status → Jira status name. Inbound transitions use the reverse map."
        keys={STATUS_KEYS}
        values={mappings.status}
        onChange={(k, v) => setMappings({ ...mappings, status: { ...mappings.status, [k]: v } })}
      />

      <MappingTable
        title="Severity → Priority"
        description="BugSense severity → Jira priority name."
        keys={PRIORITY_KEYS}
        values={mappings.priority}
        onChange={(k, v) => setMappings({ ...mappings, priority: { ...mappings.priority, [k]: v } })}
      />

      {error && (
        <div className="glass-panel p-3 border border-severity-critical/30 bg-severity-critical/5 text-xs text-severity-critical">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-50">
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save mappings'}
        </button>
        <button onClick={reset} className="btn-secondary text-sm inline-flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to defaults
        </button>
        {savedAt && Date.now() - savedAt < 5_000 && (
          <span className="text-xs text-accent-emerald inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

function MappingTable<K extends string>({
  title,
  description,
  keys,
  values,
  onChange,
}: {
  title: string;
  description: string;
  keys: K[];
  values: Record<K, string>;
  onChange: (key: K, value: string) => void;
}) {
  return (
    <div className="glass-panel">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <div className="divide-y divide-border">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-4 px-5 py-3">
            <span className="text-xs font-mono text-text-secondary w-32 flex-shrink-0">{k}</span>
            <span className="text-text-muted">→</span>
            <input
              value={values[k] ?? ''}
              onChange={(e) => onChange(k, e.target.value)}
              className="input-field text-sm flex-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
