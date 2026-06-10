import Stripe from 'stripe';
import { logger } from '@/lib/observability/logger';

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return cached;
}

export function isBillingEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * When set, all Stripe-mutating calls (Checkout, Portal, subscription
 * updates) are logged instead of executed. Pairs with JIRA_DRY_RUN and
 * SLACK_DRY_RUN — the same safety knob across every external integration.
 */
export function isDryRun(): boolean {
  return process.env.STRIPE_DRY_RUN === '1';
}

/** Standardised one-line log for dry-run output. */
export function logDryRun(method: string, endpoint: string, payload: unknown): void {
  logger.warn('stripe DRY_RUN', { method, endpoint, payload: redact(payload) });
}

function redact(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/token|secret|password|key/i.test(k) && typeof v === 'string') {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
