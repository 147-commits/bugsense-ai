import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function applyHeaders(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

// Marketing, auth, and machine-to-machine endpoints. Reachable without a
// session and never gated by the verify-email check.
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/pricing',
  '/privacy',
  '/terms',
  '/robots.txt',
  '/sitemap.xml',
]);
const PUBLIC_PREFIXES = ['/api/auth', '/api/webhooks', '/api/health', '/api/cron'];

// Authenticated-but-unverified users may still reach these.
const UNVERIFIED_BYPASS = new Set(['/settings/account']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return applyHeaders(NextResponse.next());
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signIn = new URL('/login', req.url);
    signIn.searchParams.set('callbackUrl', pathname);
    return applyHeaders(NextResponse.redirect(signIn));
  }

  const isVerified = !!token.emailVerified;
  if (isVerified) return applyHeaders(NextResponse.next());

  if (UNVERIFIED_BYPASS.has(pathname) || pathname.startsWith('/settings/account/')) {
    return applyHeaders(NextResponse.next());
  }

  const url = new URL('/settings/account', req.url);
  url.searchParams.set('verifyRequired', '1');
  return applyHeaders(NextResponse.redirect(url));
}

// Run on every path except Next.js internals and static assets. Public-vs-
// protected branching is done at runtime in `middleware()`; doing it via the
// matcher would skip security-header application for excluded paths.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|assets).*)'],
};
