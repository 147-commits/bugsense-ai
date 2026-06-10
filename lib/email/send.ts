import { logger } from '@/lib/observability/logger';
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/utils/fetch-with-timeout';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  delivered: boolean;
  reason?: string;
}

/**
 * Send a transactional email via Resend.
 *
 * When `RESEND_API_KEY` is not set, the message is logged to stdout
 * and `delivered: false` is returned with reason `no_api_key`. The
 * caller MUST NOT treat this as an error — dev/local environments
 * intentionally bypass email infrastructure so signup and recovery
 * flows still function. The verification or reset URL embedded in
 * the message body is plainly visible in the logged text body so
 * the developer can copy/paste it.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? 'BugSense <noreply@bugsense.local>';

  if (!apiKey) {
    logger.warn('RESEND_API_KEY not set — message logged, not sent', {
      to: msg.to,
      subject: msg.subject,
      body: msg.text,
    });
    return { delivered: false, reason: 'no_api_key' };
  }

  try {
    const res = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
      timeoutMs: 10_000,
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn('Resend send failed', { status: res.status, to: msg.to, body });
      return { delivered: false, reason: `http_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      logger.warn('Resend send timed out', { to: msg.to }, err);
      return { delivered: false, reason: 'timeout' };
    }
    logger.warn('Resend send threw', { to: msg.to }, err);
    return { delivered: false, reason: 'network_error' };
  }
}
