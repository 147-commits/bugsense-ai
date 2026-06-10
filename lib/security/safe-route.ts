import { NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';
import { newRequestId, runWithRequestContext } from '@/lib/observability/request-context';

/**
 * Wrap a route handler body so:
 *   - a fresh request ID is generated and made available via `getRequestContext()`
 *     for downstream logger calls
 *   - any thrown error becomes a typed JSON response
 *   - drizzle/Neon failures are translated to a 503 with a friendlier message
 *     instead of the generic 500
 *
 * Usage:
 *
 *   export async function POST(req: NextRequest) {
 *     return safeRoute('signup', async () => {
 *       // existing handler body
 *     });
 *   }
 *
 * `tag` identifies the route in logs.
 */
export async function safeRoute(
  tag: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const ctx = { id: newRequestId(), route: tag, startedAt: Date.now() };
  return runWithRequestContext(ctx, async () => {
    try {
      const res = await handler();
      // Surface the request id so clients can quote it when reporting issues.
      res.headers.set('x-request-id', ctx.id);
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('unhandled route error', { tag }, err);

      if (isDatabaseFailure(err, message)) {
        const res = NextResponse.json(
          {
            error: 'database_unavailable',
            detail:
              'The database is temporarily unavailable. Please try again in a moment. If the problem persists, contact support and quote the request id.',
            requestId: ctx.id,
          },
          { status: 503 },
        );
        res.headers.set('x-request-id', ctx.id);
        return res;
      }

      const res = NextResponse.json(
        {
          error: 'server_error',
          detail: 'The server hit an unexpected error. Quote the request id when contacting support.',
          requestId: ctx.id,
        },
        { status: 500 },
      );
      res.headers.set('x-request-id', ctx.id);
      return res;
    }
  });
}

/**
 * Heuristic — drizzle wraps the underlying pg error so the original code
 * is hidden, but the message reliably begins with "Failed query:" when a
 * query rejects (missing relation, connection drop, auth failure, etc.).
 * Treat those as database availability problems so users see a useful
 * 503 instead of a generic 500.
 */
function isDatabaseFailure(err: unknown, message: string): boolean {
  if (message.startsWith('Failed query:')) return true;
  // Common Neon/pg / connection error markers we want to capture even when
  // the failure happens outside of a drizzle query (e.g. transaction setup).
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|terminating connection|connection terminated|websocket/i.test(message)) {
    return true;
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && /^(08|57|53)/.test(code)) return true; // pg sqlstate classes: connection, operator-intervention, insufficient-resources
  }
  return false;
}
