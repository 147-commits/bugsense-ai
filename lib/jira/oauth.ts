import crypto from 'crypto';
import { encryptToken } from '@/lib/crypto/tokens';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';
import type { JiraOAuthTokens } from '@/types/jira';

export { decryptToken, encryptToken } from '@/lib/crypto/tokens';

const AUTH_URL = 'https://auth.atlassian.com/authorize';
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

const DEFAULT_SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'manage:jira-webhook',
  'offline_access',
] as const;

interface OAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function readOAuthEnv(): OAuthEnv | null {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;
  const redirectUri = process.env.JIRA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string {
  const env = readOAuthEnv();
  if (!env) throw new Error('JIRA OAuth env missing');
  const url = new URL(AUTH_URL);
  url.searchParams.set('audience', 'api.atlassian.com');
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('scope', DEFAULT_SCOPES.join(' '));
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

interface AtlassianTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface AccessibleResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
}

export async function exchangeCode(code: string): Promise<{
  tokens: JiraOAuthTokens;
  resources: AccessibleResource[];
}> {
  const env = readOAuthEnv();
  if (!env) throw new Error('JIRA OAuth env missing');
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      redirect_uri: env.redirectUri,
    }),
    timeoutMs: 10_000,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as AtlassianTokenResponse;
  const resources = await fetchAccessibleResources(data.access_token);
  return { tokens: tokensFromResponse(data), resources };
}

export async function refreshTokens(refreshToken: string): Promise<JiraOAuthTokens> {
  const env = readOAuthEnv();
  if (!env) throw new Error('JIRA OAuth env missing');
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: refreshToken,
    }),
    timeoutMs: 10_000,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  return tokensFromResponse((await res.json()) as AtlassianTokenResponse);
}

function tokensFromResponse(data: AtlassianTokenResponse): JiraOAuthTokens {
  return {
    accessToken: data.access_token,
    refreshTokenEnc: encryptToken(data.refresh_token),
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scopes: data.scope.split(' '),
  };
}

async function fetchAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const res = await fetchWithTimeout(RESOURCES_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    timeoutMs: 10_000,
  });
  if (!res.ok) {
    throw new Error(`accessible-resources failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as AccessibleResource[];
}

// ── State (CSRF) signing ────────────────────────────────────────────────────

interface StatePayload {
  userId: string;
  orgId: string;
  nonce: string;
  iat: number;
}

function stateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET required to sign OAuth state');
  return secret;
}

export function signState(payload: { userId: string; orgId: string }): string {
  const full: StatePayload = {
    ...payload,
    nonce: crypto.randomBytes(8).toString('hex'),
    iat: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyState(state: string, maxAgeMs = 10 * 60_000): StatePayload | null {
  const idx = state.indexOf('.');
  if (idx < 0) return null;
  const body = state.slice(0, idx);
  const sig = state.slice(idx + 1);
  const expected = crypto.createHmac('sha256', stateSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
    if (Date.now() - parsed.iat > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString('base64url');
}
