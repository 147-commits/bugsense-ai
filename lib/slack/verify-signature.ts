import crypto from 'crypto';

/**
 * Verify a Slack request signature using SLACK_SIGNING_SECRET.
 *
 * Slack signs requests as v0=hex(hmac_sha256(secret, "v0:" + timestamp + ":" + body)).
 * Reject requests older than 5 minutes (replay protection).
 *
 * Not currently wired into any endpoint — v1 has no inbound Slack endpoints.
 * Kept here so the v2 slash-commands / interactivity work can drop it in.
 */
export function verifySlackSignature(opts: {
  body: string;
  signature: string;
  timestamp: string;
  signingSecret: string;
  maxAgeSec?: number;
}): boolean {
  const { body, signature, timestamp, signingSecret, maxAgeSec = 60 * 5 } = opts;

  const t = Number(timestamp);
  if (!Number.isFinite(t)) return false;
  if (Math.abs(Date.now() / 1000 - t) > maxAgeSec) return false;

  const base = `v0:${timestamp}:${body}`;
  const computed = `v0=${crypto.createHmac('sha256', signingSecret).update(base).digest('hex')}`;
  if (computed.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}
