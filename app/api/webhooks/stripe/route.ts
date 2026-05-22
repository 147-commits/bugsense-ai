import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/database/db';
import { organizations, processedStripeEvents } from '@/lib/database/schema';
import { getStripe } from '@/lib/billing/client';
import { tierForPriceId } from '@/lib/billing/plans';
import { enforceRateLimit, ipKey } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing'];

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit({ key: ipKey(req), limit: 100 });
  if (limited) return limited;

  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid signature.', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 400 },
    );
  }

  if (!db) {
    // Signature was valid; we just have nowhere to persist. ACK so Stripe
    // doesn't retry forever in a dev environment.
    return NextResponse.json({ received: true, dbMissing: true });
  }

  // Idempotency: insert-once. onConflictDoNothing returns 0 rows on duplicate,
  // which lets us short-circuit before doing any work.
  const inserted = await db
    .insert(processedStripeEvents)
    .values({ eventId: event.id, type: event.type })
    .onConflictDoNothing()
    .returning({ eventId: processedStripeEvents.eventId });
  if (inserted.length === 0) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await applySubscription(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await clearSubscription(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      // Recorded via processedStripeEvents — no plan-tier action needed.
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  if (!db) return;
  const orgId = sub.metadata?.organizationId;
  if (!orgId) return;

  const item = sub.items.data[0];
  const tier = tierForPriceId(item?.price.id);
  if (!tier) return;

  // While the subscription is active or trialing, the workspace keeps its
  // paid tier — including the cancel-at-period-end grace window. When the
  // subscription transitions to canceled / unpaid / incomplete_expired, the
  // workspace drops back to FREE.
  const effectiveTier = ACTIVE_STATUSES.includes(sub.status) ? tier : 'FREE';

  await db
    .update(organizations)
    .set({
      planTier: effectiveTier,
      stripeSubscriptionId: sub.id,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}

async function clearSubscription(sub: Stripe.Subscription): Promise<void> {
  if (!db) return;
  const orgId = sub.metadata?.organizationId;
  if (!orgId) return;
  await db
    .update(organizations)
    .set({
      planTier: 'FREE',
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}
