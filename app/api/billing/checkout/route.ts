import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/authOptions';
import { db } from '@/lib/database/db';
import { organizationMembers, organizations, users } from '@/lib/database/schema';
import { getStripe, isBillingEnabled, isDryRun, logDryRun } from '@/lib/billing/client';
import { priceIdFor } from '@/lib/billing/plans';

const QuerySchema = z.object({
  plan: z.enum(['PRO', 'TEAM']),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const here = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    return NextResponse.redirect(new URL(`/signup?then=${encodeURIComponent(here)}`, req.url));
  }

  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.redirect(new URL('/pricing', req.url));
  }
  const tier = parsed.data.plan;

  if (!isBillingEnabled()) {
    return NextResponse.json(
      { error: 'Billing is not configured.', detail: 'Set STRIPE_SECRET_KEY.' },
      { status: 503 },
    );
  }
  if (!db) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const priceId = priceIdFor(tier);
  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_${tier} is not set.` },
      { status: 503 },
    );
  }

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, session.user.id),
    orderBy: organizationMembers.joinedAt,
    with: { organization: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'No workspace.' }, { status: 404 });
  }
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only owners/admins can upgrade.' }, { status: 403 });
  }
  const org = membership.organization;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { email: true, name: true },
  });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not initialised.' }, { status: 503 });
  }

  // Get-or-create Stripe customer so the same record is reused on every
  // upgrade, downgrade, or portal visit.
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    if (isDryRun()) {
      logDryRun('POST', '/v1/customers', { email: user?.email, name: org.name });
      customerId = `cus_dryrun_${org.id}`;
    } else {
      const customer = await stripe.customers.create({
        email: user?.email ?? undefined,
        name: user?.name ?? org.name,
        metadata: { organizationId: org.id },
      });
      customerId = customer.id;
    }
    await db
      .update(organizations)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(organizations.id, org.id));
  }

  const origin = req.nextUrl.origin;
  const successUrl = `${origin}/settings?checkout=success&plan=${tier}`;
  const cancelUrl = `${origin}/pricing?checkout=cancelled`;

  if (isDryRun()) {
    logDryRun('POST', '/v1/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { organizationId: org.id, plan: tier },
    });
    return NextResponse.redirect(new URL('/settings?checkout=dry_run', req.url));
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { organizationId: org.id, plan: tier },
    subscription_data: {
      metadata: { organizationId: org.id, plan: tier },
    },
  });

  if (!checkout.url) {
    return NextResponse.json({ error: 'No checkout URL returned.' }, { status: 502 });
  }
  return NextResponse.redirect(checkout.url);
}
