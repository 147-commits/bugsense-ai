export type JiraStatusKey = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DUPLICATE';
export type JiraPriorityKey = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface JiraOAuthTokens {
  accessToken: string;
  refreshTokenEnc: string;
  expiresAt: string;
  scopes: string[];
}

export interface JiraMappings {
  status: Record<JiraStatusKey, string>;
  priority: Record<JiraPriorityKey, string>;
  issueTypeName: string;
  projectKey: string | null;
}

export interface JiraConfig {
  cloudId: string;
  siteUrl: string;
  siteName: string;
  tokens: JiraOAuthTokens;
  webhookSecret: string;
  mappings: JiraMappings;
}

export const DEFAULT_JIRA_MAPPINGS: JiraMappings = {
  status: {
    OPEN: 'To Do',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Done',
    CLOSED: 'Done',
    DUPLICATE: 'Done',
  },
  priority: {
    CRITICAL: 'Highest',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    INFO: 'Lowest',
  },
  issueTypeName: 'Task',
  projectKey: null,
};

export function parseJiraConfig(raw: unknown): JiraConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const tokens = obj.tokens as Record<string, unknown> | undefined;
  if (
    typeof obj.cloudId !== 'string' ||
    typeof obj.siteUrl !== 'string' ||
    typeof obj.siteName !== 'string' ||
    typeof obj.webhookSecret !== 'string' ||
    !tokens ||
    typeof tokens.accessToken !== 'string' ||
    typeof tokens.refreshTokenEnc !== 'string' ||
    typeof tokens.expiresAt !== 'string' ||
    !Array.isArray(tokens.scopes) ||
    !obj.mappings
  ) {
    return null;
  }
  return obj as unknown as JiraConfig;
}
