import { decryptToken, refreshTokens } from './oauth';
import type { ADFDoc } from './adf';
import type { JiraConfig } from '@/types/jira';

export class JiraError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export interface JiraClient {
  cloudId: string;
  siteUrl: string;
  config: JiraConfig;
  persist: (config: JiraConfig) => Promise<void>;
}

export interface JiraIssueCreate {
  fields: {
    project: { key: string };
    summary: string;
    description: ADFDoc;
    issuetype: { name: string };
    priority?: { name: string };
  };
}

export interface JiraIssueRef {
  id: string;
  key: string;
  self?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: { name: string };
}

async function jiraFetch<T>(
  client: JiraClient,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  await ensureFreshToken(client);

  const doFetch = async (): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${client.config.tokens.accessToken}`);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    return fetch(`https://api.atlassian.com/ex/jira/${client.cloudId}${path}`, { ...init, headers });
  };

  let res = await doFetch();
  if (res.status === 401) {
    await forceRefresh(client);
    res = await doFetch();
  }
  if (!res.ok) {
    throw new JiraError(`Jira ${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function ensureFreshToken(client: JiraClient): Promise<void> {
  const expiresAt = new Date(client.config.tokens.expiresAt).getTime();
  if (expiresAt - Date.now() > 60_000) return;
  await forceRefresh(client);
}

async function forceRefresh(client: JiraClient): Promise<void> {
  const refresh = decryptToken(client.config.tokens.refreshTokenEnc);
  const fresh = await refreshTokens(refresh);
  client.config = { ...client.config, tokens: fresh };
  await client.persist(client.config);
}

export function createIssue(client: JiraClient, payload: JiraIssueCreate): Promise<JiraIssueRef> {
  return jiraFetch<JiraIssueRef>(client, '/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface JiraIssueUpdate {
  fields: Partial<JiraIssueCreate['fields']>;
}

export function updateIssue(client: JiraClient, issueKey: string, payload: JiraIssueUpdate): Promise<void> {
  return jiraFetch<void>(client, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function listTransitions(client: JiraClient, issueKey: string): Promise<JiraTransition[]> {
  const data = await jiraFetch<{ transitions: JiraTransition[] }>(
    client,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
  );
  return data.transitions;
}

export function transitionIssue(client: JiraClient, issueKey: string, transitionId: string): Promise<void> {
  return jiraFetch<void>(client, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: transitionId } }),
  });
}

export function addRemoteLink(client: JiraClient, issueKey: string, url: string, title: string): Promise<void> {
  return jiraFetch<void>(client, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/remotelink`, {
    method: 'POST',
    body: JSON.stringify({ object: { url, title } }),
  });
}

export function getIssue(client: JiraClient, issueKey: string): Promise<JiraIssueRef & { fields: Record<string, unknown> }> {
  return jiraFetch(client, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`);
}
