import { NextResponse, type NextRequest } from 'next/server';

/**
 * Reject the request if its Origin (or Referer fallback) does not match the
 * server's own origin. This is our CSRF defence for state-mutating routes
 * that do not sit behind NextAuth's built-in CSRF token (NextAuth's own
 * `/api/auth/*` endpoints already protect themselves).
 *
 * The expected origin is derived from the incoming `Host` header rather than
 * a static env var so this works under multi-port dev (Next picks 3000, 3001,
 * 3002, ... as ports become busy) and under any reverse proxy that sets the
 * standard `x-forwarded-proto` header.
 *
 *   const blocked = requireSameOrigin(req);
 *   if (blocked) return blocked;
 *   // ... rest of handler
 *
 * Returns `null` when the request is acceptable, a 403 `NextResponse` when not.
 */
export function requireSameOrigin(req: NextRequest): NextResponse | null {
  const expected = expectedOrigin(req);
  if (!expected) return forbid('host_missing');

  const origin = req.headers.get('origin');
  if (origin) {
    return origin === expected ? null : forbid('origin_mismatch');
  }

  // Fetch spec requires Origin on POST/PUT/PATCH/DELETE, but some legacy
  // clients (older curl, programmatic scripts) only send Referer. Accept it
  // when the URL parses and its origin matches.
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).origin === expected) return null;
    } catch {
      // fall through to forbid
    }
    return forbid('referer_mismatch');
  }

  return forbid('origin_missing');
}

function expectedOrigin(req: NextRequest): string | null {
  const host = req.headers.get('host');
  if (!host) return null;
  const proto = (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')) || 'http';
  return `${proto}://${host}`;
}

function forbid(reason: string): NextResponse {
  return NextResponse.json(
    {
      error: 'forbidden',
      detail: 'Request blocked by same-origin policy. Submit from the application UI.',
      reason,
    },
    { status: 403 },
  );
}
