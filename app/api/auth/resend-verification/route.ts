import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { emailVerificationTokens, users } from '@/lib/database/schema';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { sendEmail } from '@/lib/email/send';
import { verificationEmail } from '@/lib/email/templates';
import { enforceRateLimit, ipKey } from '@/lib/security/rate-limit';
import { requireSameOrigin } from '@/lib/security/same-origin';
import { safeRoute } from '@/lib/security/safe-route';
import { demoModeResponse } from '@/lib/validation';

const TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  return safeRoute('auth/resend-verification', async () => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const limited = await enforceRateLimit({ key: ipKey(req), limit: 10 });
  if (limited) return limited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!db) return demoModeResponse('Resending verification requires a configured database.');

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.user.id),
    columns: { id: true, email: true, emailVerified: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const rawToken = generateToken();
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  const verifyUrl = `${req.nextUrl.origin}/api/auth/verify-email?token=${rawToken}`;
  const msg = verificationEmail(verifyUrl);
  const send = await sendEmail({ to: user.email, ...msg });

  return NextResponse.json({
    ok: true,
    emailSent: send.delivered,
    emailLogged: send.reason === 'no_api_key',
  });
  });
}
