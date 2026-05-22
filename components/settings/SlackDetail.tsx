'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Send, Slack, Unlink } from 'lucide-react';
import type { SlackNotificationsConfig } from '@/types/slack';

interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channelName?: string;
  channelId?: string;
  notifications?: SlackNotificationsConfig;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

const TOGGLES: { key: keyof SlackNotificationsConfig; label: string; description: string }[] = [
  { key: 'critical_bug', label: 'New critical or high-severity bug', description: 'Fires when /api/analyze persists a CRITICAL or HIGH bug.' },
  { key: 'readiness_flip', label: 'Release readiness flips to NO-GO', description: 'Fires when a project goes from GO to NO_GO on the readiness page.' },
  { key: 'test_failure', label: 'Test run fails', description: 'No-op until test-run ingestion ships.' },
  { key: 'daily_digest', label: 'Daily digest', description: 'Open critical count, current readiness verdict, 24h trend.' },
];

export default function SlackDetail() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [notifications, setNotifications] = useState<SlackNotificationsConfig | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/slack/status');
      if (!res.ok) {
        setStatus({ connected: false });
        return;
      }
      const data = (await res.json()) as SlackStatus;
      setStatus(data);
      if (data.notifications) setNotifications(data.notifications);
    } catch {
      setStatus({ connected: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = status?.role === 'OWNER' || status?.role === 'ADMIN';

  const toggle = (key: keyof SlackNotificationsConfig) => {
    if (!notifications) return;
    setNotifications({ ...notifications, [key]: !notifications[key] });
  };

  const save = async () => {
    if (!notifications) return;
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations/slack/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications),
      });
      if (res.ok) setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations/slack/test', { method: 'POST' });
      if (res.ok) {
        setTestResult({ ok: true, message: 'Test message sent.' });
      } else {
        const body = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
        setTestResult({ ok: false, message: body?.detail ?? body?.error ?? `Failed (${res.status})` });
      }
    } finally {
      setSendingTest(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/integrations/slack/disconnect', { method: 'POST' });
      await load();
      setNotifications(null);
    } finally {
      setDisconnecting(false);
    }
  };

  if (status === null) return <div className="text-xs text-text-muted">Loading…</div>;

  if (!status.connected) {
    return (
      <div className="glass-panel p-6 space-y-3">
        <p className="text-sm text-text-secondary">Slack is not connected for this organization.</p>
        <a href="/api/integrations/slack/install" className="btn-primary text-sm inline-flex items-center gap-2">
          <Slack className="w-4 h-4" />
          Add to Slack
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5 space-y-2">
        <div className="flex items-center gap-3">
          <Slack className="w-5 h-5 text-accent-emerald" />
          <div>
            <p className="text-sm font-medium text-text-primary">{status.teamName}</p>
            <p className="text-xs text-text-muted">Posting to #{status.channelName}</p>
          </div>
        </div>
      </div>

      {notifications && (
        <div className="glass-panel">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">Notifications</h3>
            <p className="text-xs text-text-muted">Choose which events post to Slack.</p>
          </div>
          <div className="divide-y divide-border">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{t.label}</p>
                  <p className="text-xs text-text-muted">{t.description}</p>
                </div>
                <button
                  onClick={() => canManage && toggle(t.key)}
                  disabled={!canManage}
                  className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${
                    notifications[t.key] ? 'bg-accent-emerald' : 'bg-bg-hover'
                  } disabled:opacity-50`}
                  aria-pressed={notifications[t.key]}
                >
                  <span
                    className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200 ${
                      notifications[t.key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-muted">
        Daily digest is sent at 08:00 UTC. Per-workspace timezone is on the roadmap.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        {canManage && (
          <button onClick={save} disabled={saving || !notifications} className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <button onClick={sendTest} disabled={sendingTest} className="btn-secondary text-sm inline-flex items-center gap-2 disabled:opacity-50">
          <Send className="w-3.5 h-3.5" />
          {sendingTest ? 'Sending…' : 'Send test message'}
        </button>
        {canManage && (
          <button onClick={disconnect} disabled={disconnecting} className="btn-secondary text-sm inline-flex items-center gap-2 text-accent-coral hover:bg-accent-coral/5 disabled:opacity-50">
            <Unlink className="w-3.5 h-3.5" />
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
        {savedAt && Date.now() - savedAt < 5_000 && (
          <span className="text-xs text-accent-emerald inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
      </div>

      {testResult && (
        <div className={`glass-panel p-3 text-xs ${testResult.ok ? 'text-accent-emerald' : 'text-severity-critical'}`}>
          {testResult.message}
        </div>
      )}
    </div>
  );
}
