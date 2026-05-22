import crypto from 'crypto';
import * as Sentry from '@sentry/nextjs';
import type { ErrorEvent, EventHint } from '@sentry/nextjs';

export interface SentryEventContext {
  workspaceId?: string | null;
  userId?: string | null;
  plan?: string | null;
  route?: string | null;
  integrationStatus?: Record<string, boolean> | null;
}

/**
 * Hash a user ID for Sentry tagging. HMAC-SHA256 with NEXTAUTH_SECRET keeps
 * the value stable across deploys, indexable in Sentry's UI, and not
 * reversible by anyone who acquires a single tagged event.
 */
export function hashUserId(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return userId.slice(0, 8);
  return crypto.createHmac('sha256', secret).update(userId).digest('hex').slice(0, 16);
}

export function setSentryContext(ctx: SentryEventContext): void {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const scope = Sentry.getCurrentScope();
  if (ctx.workspaceId) scope.setTag('workspace_id', ctx.workspaceId);
  if (ctx.userId) scope.setTag('user_id', hashUserId(ctx.userId));
  if (ctx.plan) scope.setTag('plan', ctx.plan);
  if (ctx.route) scope.setTag('route', ctx.route);
  if (ctx.integrationStatus) scope.setContext('integrations', ctx.integrationStatus);
}

/**
 * Sentry beforeSend filter. Drops events that are noise:
 *   - React hydration mismatch warnings
 *   - NEXT_NOT_FOUND (the framework's own 404 throw — surface those as 404s,
 *     not errors)
 *   - User-cancelled fetches (AbortError / "aborted")
 *
 * Shared between client, server, and edge configs to keep behaviour identical.
 */
export function beforeSendFilter(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  const err = hint.originalException;
  const message = event.message ?? (err instanceof Error ? err.message : '');

  if (message.includes('Hydration') || message.includes('Text content does not match')) {
    return null;
  }
  if (
    message.includes('NEXT_NOT_FOUND') ||
    (err && typeof err === 'object' && 'digest' in err && (err as { digest?: unknown }).digest === 'NEXT_NOT_FOUND')
  ) {
    return null;
  }
  if (err instanceof Error && (err.name === 'AbortError' || /aborted|user cancelled/i.test(err.message))) {
    return null;
  }

  return event;
}
