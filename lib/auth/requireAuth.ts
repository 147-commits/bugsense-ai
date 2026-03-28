import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from './authOptions';

/**
 * Returns the authenticated user's session or a 401 NextResponse.
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const userId = auth.user.id;
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}
