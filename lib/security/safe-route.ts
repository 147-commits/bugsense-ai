import { NextResponse } from 'next/server';

/**
 * Wrap a route handler body so any thrown error becomes a typed JSON 500
 * instead of bubbling up as a non-parseable Next.js error page. The client
 * code path that handles `res.json()` failures degrades to a generic
 * "something went wrong" message, which is unhelpful when the real cause
 * is a missing migration, a DB blip, or any other server-side throw.
 *
 * Usage:
 *
 *   export async function POST(req: NextRequest) {
 *     return safeRoute('signup', async () => {
 *       // existing handler body
 *     });
 *   }
 *
 * `tag` is used in the server-side log so the offending route is easy to
 * find when triaging Sentry events.
 */
export async function safeRoute(
  tag: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${tag}] unhandled route error:`, message);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    return NextResponse.json(
      {
        error: 'server_error',
        detail: 'The server hit an unexpected error. Check the server logs.',
      },
      { status: 500 },
    );
  }
}
