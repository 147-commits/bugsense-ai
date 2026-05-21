import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/database/db';
import { users } from '@/lib/database/schema';
import { demoModeResponse, parseBody } from '@/lib/validation';

const RegisterSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, RegisterSchema);
  if (!parsed.ok) return parsed.response;
  const { name, email, password } = parsed.data;

  if (!db) return demoModeResponse('Sign-up requires a configured database.');

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.insert(users).values({
    email: normalizedEmail,
    name: name?.trim() || null,
    passwordHash,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
