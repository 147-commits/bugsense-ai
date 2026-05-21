'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Link2, Settings as SettingsIcon, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JiraStatus {
  connected: boolean;
  siteName?: string;
  siteUrl?: string;
  projectKey?: string | null;
  lastSyncAt?: string | null;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  demoMode?: boolean;
}

export default function JiraSection() {
  const [status, setStatus] = useState<JiraStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/jira/status');
      if (res.ok) setStatus((await res.json()) as JiraStatus);
      else setStatus({ connected: false });
    } catch {
      setStatus({ connected: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = status?.role === 'OWNER' || status?.role === 'ADMIN';

  const onConnect = () => {
    window.location.href = '/api/integrations/jira/connect';
  };

  const onDisconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/integrations/jira/disconnect', { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (status === null) {
    return <div className="text-xs text-text-muted">Loading…</div>;
  }

  if (!status.connected) {
    return (
      <div className="flex items-center gap-4 p-3 rounded-xl bg-bg-tertiary">
        <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center">
          <Link2 className="w-4 h-4 text-text-muted" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">Jira</p>
          <p className="text-xs text-text-muted">Two-way sync: bugs become Jira issues; status flows back.</p>
        </div>
        <button
          onClick={onConnect}
          className="text-xs px-3 py-1.5 rounded-lg font-medium bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-bg-tertiary">
      <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center">
        <Link2 className="w-4 h-4 text-accent-emerald" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text-primary truncate">{status.siteName ?? 'Jira'}</p>
          {status.siteUrl && (
            <a
              href={status.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-text-muted hover:text-text-primary"
              aria-label="Open Jira site"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <p className="text-xs text-text-muted truncate">
          {status.projectKey
            ? `Project ${status.projectKey}`
            : 'No Jira project key set — open mapping to choose one.'}
          {status.lastSyncAt && ` · last sync ${formatTimeAgo(status.lastSyncAt)}`}
        </p>
      </div>
      <a
        href="/settings/jira/mapping"
        className={cn(
          'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
          'bg-bg-hover text-text-secondary hover:text-text-primary inline-flex items-center gap-1',
        )}
      >
        <SettingsIcon className="w-3 h-3" />
        Mapping
      </a>
      {canManage && (
        <button
          onClick={onDisconnect}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-lg font-medium bg-bg-hover text-accent-coral hover:bg-accent-coral/10 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Unlink className="w-3 h-3" />
          {busy ? '…' : 'Disconnect'}
        </button>
      )}
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
