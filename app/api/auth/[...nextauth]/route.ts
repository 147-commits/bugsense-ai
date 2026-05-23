import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth/authOptions';

const handler = NextAuth(authOptions);

type Ctx = { params: { nextauth: string[] } };

/**
 * NextAuth's handler can throw if the adapter is broken (most commonly:
 * the Account/Session/VerificationToken tables don't exist yet because
 * migrations weren't applied). A bare throw becomes an empty 500 on the
 * wire, and the React client then crashes with "Failed to execute 'json'
 * on 'Response': Unexpected end of JSON input". Wrap so the failure is
 * always a parseable JSON body the UI can surface.
 */
async function safeNextAuth(req: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    return await handler(req, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const segment = ctx.params.nextauth.join('/');
    console.error(`[auth/${segment}] NextAuth handler threw:`, message);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return NextResponse.json(
      {
        error: 'server_error',
        detail:
          'Authentication backend failed. Most common cause: database migrations not applied. Run `npm run db:migrate` and retry.',
      },
      { status: 500 },
    );
  }
}

export { safeNextAuth as GET, safeNextAuth as POST };
