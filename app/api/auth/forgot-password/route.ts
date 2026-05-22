import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/database/db';
import { passwordResetTokens, users } from '@/lib/database/schema';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { sendEmail } from '@/lib/email/send';
import { passwordResetEmail } from '@/lib/email/templates';
import { enforceRateLimit, ipKey } from '@/lib/security/rate-limit';
import { demoModeResponse, parseBody } from '@/lib/validation';

const ForgotSchema = z.object({
  email: z.string().email().max(254),
});

const RESET_TTL_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit({ key: ipKey(req), limit: 10 });
  if (limited) return limited;

  const parsed = await parseBody(req, ForgotSchema);
  if (!parsed.ok) return parsed.response;

  if (!db) return demoModeResponse('Password reset requires a configured database.');

  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, passwordHash: true },
  });

  // Only send email when the account exists AND uses password auth. Always
  // return the same shape so an attacker cannot enumerate registered emails.
  if (user?.passwordHash) {
    const rawToken = generateToken();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const resetUrl = `${req.nextUrl.origin}/reset-password?token=${rawToken}`;
    const msg = passwordResetEmail(resetUrl);
    await sendEmail({ to: email, ...msg });
  }

  return NextResponse.json({ ok: true });
}
