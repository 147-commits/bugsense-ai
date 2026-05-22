import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/database/db';
import { passwordResetTokens, users } from '@/lib/database/schema';
import { hashToken } from '@/lib/auth/tokens';
import { enforceRateLimit, ipKey } from '@/lib/security/rate-limit';
import { safeRoute } from '@/lib/security/safe-route';
import { demoModeResponse, parseBody } from '@/lib/validation';

const ResetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  return safeRoute('auth/reset-password', async () => {
  const limited = await enforceRateLimit({ key: ipKey(req), limit: 10 });
  if (limited) return limited;

  const parsed = await parseBody(req, ResetSchema);
  if (!parsed.ok) return parsed.response;

  if (!db) return demoModeResponse('Password reset requires a configured database.');

  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, hashToken(parsed.data.token)),
  });
  if (!record) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (record.usedAt) {
    return NextResponse.json({ error: 'already_used' }, { status: 400 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'expired' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const now = new Date();
  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, record.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, record.id));

  return NextResponse.json({ ok: true });
  });
}
