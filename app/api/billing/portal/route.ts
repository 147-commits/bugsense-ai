import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { organizationMembers } from '@/lib/database/schema';
import { getStripe, isBillingEnabled, isDryRun, logDryRun } from '@/lib/billing/client';
import { requireSameOrigin } from '@/lib/security/same-origin';

export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: 'Billing not configured.' }, { status: 503 });
  }
  if (!db) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const membership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, auth.user.id),
    orderBy: organizationMembers.joinedAt,
    with: { organization: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'No workspace.' }, { status: 404 });
  }
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only owners/admins can manage billing.' }, { status: 403 });
  }

  const customerId = membership.organization.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json(
      { error: 'No Stripe customer for this workspace yet — subscribe first.' },
      { status: 404 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not initialised.' }, { status: 503 });
  }

  const returnUrl = `${req.nextUrl.origin}/settings/billing`;
  if (isDryRun()) {
    logDryRun('POST', '/v1/billing_portal/sessions', { customer: customerId, return_url: returnUrl });
    return NextResponse.json({ url: `${returnUrl}?dry_run=1` });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return NextResponse.json({ url: portal.url });
}
