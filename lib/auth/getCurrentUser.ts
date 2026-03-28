import { getServerSession } from 'next-auth';
import { authOptions } from './authOptions';
import { prisma } from '@/lib/database/prisma';

/**
 * Server-side helper — returns the full User row (with org + project memberships)
 * for the currently authenticated session, or null if unauthenticated.
 *
 * Use inside Server Components, Route Handlers, and Server Actions.
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organizations: {
        include: { organization: true },
      },
      projectMembers: {
        include: { project: { include: { organization: true } } },
      },
    },
  });
}

/**
 * Lightweight variant — only returns the session without a DB round-trip.
 * Useful when you only need to check auth status, not the full user record.
 */
export async function getSession() {
  return getServerSession(authOptions);
}
