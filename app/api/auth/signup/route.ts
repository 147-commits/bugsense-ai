import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/database/db';
import { users } from '@/lib/database/schema';
import { recordAuthEvent } from '@/lib/auth/audit';
import { enforceRateLimit, ipKey } from '@/lib/security/rate-limit';
import { requireSameOrigin } from '@/lib/security/same-origin';
import { safeRoute } from '@/lib/security/safe-route';
import { demoModeResponse, parseBody } from '@/lib/validation';

const SignupSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});

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
  // Email verification is intentionally bypassed for now — new users are
  // marked verified at signup so they can use the workspace immediately.
  // The verification token table, /api/auth/verify-email handler, the
  // middleware gate, and the UnverifiedEmailBanner all remain in place
  // so re-enabling verification later is a one-line flip (drop the
  // `emailVerified` field below + restore the token-issuance block).
  const [user] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      name: name?.trim() || null,
      passwordHash,
      emailVerified: new Date(),
    })
    .returning({ id: users.id });

  if (!user) {
    return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
  }

  await recordAuthEvent({ kind: 'SIGNUP', userId: user.id, req });

  return NextResponse.json({ ok: true }, { status: 201 });
  });
}
