import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth/authOptions';
import { logger } from '@/lib/observability/logger';

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
    const segment = ctx.params.nextauth.join('/');
    logger.error('NextAuth handler threw', { segment }, err);
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
