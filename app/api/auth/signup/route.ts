import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/database/db';
import { emailVerificationTokens, users } from '@/lib/database/schema';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { sendEmail } from '@/lib/email/send';
import { verificationEmail } from '@/lib/email/templates';
import { enforceRateLimit, ipKey } from '@/lib/security/rate-limit';
import { requireSameOrigin } from '@/lib/security/same-origin';
import { safeRoute } from '@/lib/security/safe-route';
import { demoModeResponse, parseBody } from '@/lib/validation';

const SignupSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  return safeRoute('auth/signup', async () => {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const limited = await enforceRateLimit({ key: ipKey(req), limit: 10 });
  if (limited) return limited;

  const parsed = await parseBody(req, SignupSchema);
  if (!parsed.ok) return parsed.response;
  const { name, email, password } = parsed.data;

  if (!db) return demoModeResponse('Sign-up requires a configured database.');

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name: name?.trim() || null,
      passwordHash,
    })
    .returning({ id: users.id });

  if (!user) {
    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
  }

  const rawToken = generateToken();
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  });

  const origin = req.nextUrl.origin;
  const verifyUrl = `${origin}/api/auth/verify-email?token=${rawToken}`;
  const msg = verificationEmail(verifyUrl);
  const send = await sendEmail({ to: normalizedEmail, ...msg });

  return NextResponse.json(
    {
      ok: true,
      emailSent: send.delivered,
      // Surface "logged" so the dev console message is the obvious source
      // when RESEND_API_KEY isn't configured locally.
      emailLogged: send.reason === 'no_api_key',
    },
    { status: 201 },
  );
  });
}
