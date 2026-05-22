'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Settings as SettingsIcon, Slack } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channelName?: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  demoMode?: boolean;
}

export default function SlackSection() {
  const [status, setStatus] = useState<SlackStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/slack/status');
      if (res.ok) setStatus((await res.json()) as SlackStatus);
      else setStatus({ connected: false });
    } catch {
      setStatus({ connected: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (status === null) {
    return <div className="text-xs text-text-muted">Loading…</div>;
  }

  if (!status.connected) {
    return (
      <div className="flex items-center gap-4 p-3 rounded-xl bg-bg-tertiary">
        <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center">
          <Slack className="w-4 h-4 text-text-muted" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">Slack</p>
          <p className="text-xs text-text-muted">
            Notifications for critical bugs, release readiness flips, and daily digests.
          </p>
        </div>
        <a
          href="/api/integrations/slack/install"
          className="text-xs px-3 py-1.5 rounded-lg font-medium bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          Add to Slack
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-bg-tertiary">
      <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center">
        <Slack className="w-4 h-4 text-accent-emerald" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {status.teamName ?? 'Slack'}
        </p>
        <p className="text-xs text-text-muted truncate">
          Posting to #{status.channelName ?? 'channel'}
        </p>
      </div>
      <a
        href="/settings/integrations/slack"
        className={cn(
          'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
          'bg-bg-hover text-text-secondary hover:text-text-primary inline-flex items-center gap-1',
        )}
      >
        <SettingsIcon className="w-3 h-3" />
        Configure
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
    </div>
  );
}
