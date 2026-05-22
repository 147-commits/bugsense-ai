import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Paths that authenticated-but-unverified users may still reach. Everything
// else under the matcher will bounce them to /settings/account.
const UNVERIFIED_BYPASS = ['/settings/account'];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (!token) return; // Unauthenticated — withAuth handles the login redirect.

    const isVerified = !!token.emailVerified;
    if (isVerified) return;

    const pathname = req.nextUrl.pathname;
    if (UNVERIFIED_BYPASS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return;
    }
    const url = new URL('/settings/account', req.url);
    url.searchParams.set('verifyRequired', '1');
    return NextResponse.redirect(url);
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  },
);

/**
 * Matcher excludes:
 *   - Auth pages: /login, /signup, /forgot-password, /reset-password,
 *     /verify-email (token consumption needs no session)
 *   - Public marketing: / (landing), /pricing, /privacy, /terms
 *   - Auth endpoints: /api/auth/**
 *   - Machine-to-machine endpoints that must work without any user
 *     verification state: /api/webhooks/**, /api/health
 *   - Next.js internals and static assets
 */
export const config = {
  matcher: [
    '/((?!login|signup|forgot-password|reset-password|verify-email|pricing|privacy|terms|api/auth|api/webhooks|api/health|_next/static|_next/image|favicon\\.ico|assets|$).*)',
  ],
};
