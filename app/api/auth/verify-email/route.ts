import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/database/db';
import { emailVerificationTokens, users } from '@/lib/database/schema';
import { hashToken } from '@/lib/auth/tokens';

function back(req: NextRequest, status: string): NextResponse {
  const url = new URL('/verify-email', req.url);
  url.searchParams.set('status', status);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return back(req, 'invalid');
  if (!db) return back(req, 'demo');

  const record = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, hashToken(token)),
  });
  if (!record) return back(req, 'invalid');
  if (record.usedAt) return back(req, 'already');
  if (record.expiresAt.getTime() < Date.now()) return back(req, 'expired');

  const now = new Date();
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, record.id));
  await db
    .update(users)
    .set({ emailVerified: now, updatedAt: now })
    .where(eq(users.id, record.userId));

  return back(req, 'success');
}
