export interface SlackNotificationsConfig {
  critical_bug: boolean;
  readiness_flip: boolean;
  test_failure: boolean;
  daily_digest: boolean;
}

export interface SlackTokens {
  accessTokenEnc: string;
  scopes: string[];
}

export interface SlackConfig {
  team_id: string;
  team_name: string;
  channel_id: string;
  channel_name: string;
  bot_user_id: string;
  app_id: string;
  tokens: SlackTokens | null;
  notifications: SlackNotificationsConfig;
}

export const DEFAULT_SLACK_NOTIFICATIONS: SlackNotificationsConfig = {
  critical_bug: true,
  readiness_flip: true,
  test_failure: true,
  daily_digest: true,
};

export function parseSlackConfig(raw: unknown): SlackConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.team_id !== 'string' ||
    typeof obj.team_name !== 'string' ||
    typeof obj.channel_id !== 'string' ||
    typeof obj.channel_name !== 'string' ||
    typeof obj.bot_user_id !== 'string' ||
    typeof obj.app_id !== 'string' ||
    !obj.notifications
  ) {
    return null;
  }
  return obj as unknown as SlackConfig;
}

export function parseNotifications(raw: unknown): SlackNotificationsConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const fields: (keyof SlackNotificationsConfig)[] = [
    'critical_bug',
    'readiness_flip',
    'test_failure',
    'daily_digest',
  ];
  for (const f of fields) {
    if (typeof obj[f] !== 'boolean') return null;
  }
  return obj as unknown as SlackNotificationsConfig;
}
