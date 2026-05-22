import crypto from 'crypto';

const AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const REVOKE_URL = 'https://slack.com/api/auth.revoke';

// Bot scopes:
// - chat:write       — post messages via chat.postMessage
// - incoming-webhook — exposes Slack's channel-picker UI during install and
//                      gives us channel_id back without a separate picker
// - channels:read    — lookup channel names if we ever need to refresh
export const BOT_SCOPES = ['chat:write', 'incoming-webhook', 'channels:read'] as const;

interface OAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function readOAuthEnv(): OAuthEnv | null {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function buildInstallUrl(state: string): string {
  const env = readOAuthEnv();
  if (!env) throw new Error('Slack OAuth env missing');
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('scope', BOT_SCOPES.join(','));
  url.searchParams.set('user_scope', '');
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

export interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: { id: string; name: string };
  authed_user?: { id: string };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    url: string;
    configuration_url: string;
  };
}

export async function exchangeCode(code: string): Promise<SlackOAuthResponse> {
  const env = readOAuthEnv();
  if (!env) throw new Error('Slack OAuth env missing');
  const params = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    code,
    redirect_uri: env.redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`Slack oauth.v2.access HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok) throw new Error(`Slack OAuth error: ${data.error ?? 'unknown'}`);
  return data;
}

export async function revokeToken(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  return (await res.json()) as { ok: boolean; error?: string };
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
