import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

/**
 * Run middleware on every route EXCEPT:
 *  - /login, /register          (auth pages)
 *  - /api/auth/**               (NextAuth endpoints)
 *  - /_next/**                  (Next.js internals)
 *  - /favicon.ico, /assets/**   (static files)
 */
export const config = {
  matcher: [
    '/((?!login|register|api/auth|_next/static|_next/image|favicon\\.ico|assets).*)',
  ],
};
