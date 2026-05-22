import { NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/database/db';
import { accounts, sessions, users, verificationTokens } from '@/lib/database/schema';
import { sendEmail } from '@/lib/email/send';
import { magicLinkEmail } from '@/lib/email/templates';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      emailVerified?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    emailVerified?: number | null;
  }
}

function buildProviders(): NextAuthOptions['providers'] {
  const list: NextAuthOptions['providers'] = [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!db) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email.trim().toLowerCase()),
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? user.avatarUrl,
        };
      },
    }),
    EmailProvider({
      from: process.env.RESEND_FROM ?? 'BugSense <noreply@bugsense.local>',
      maxAge: 10 * 60,
      async sendVerificationRequest({ identifier, url }) {
        const msg = magicLinkEmail(url);
        const result = await sendEmail({ to: identifier, ...msg });
        // Missing RESEND_API_KEY is intentional in dev (URL is logged), so
        // don't throw on that — only on real send failures.
        if (!result.delivered && result.reason !== 'no_api_key') {
          throw new Error(`Failed to send magic link: ${result.reason}`);
        }
      },
    }),
  ];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    list.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }
  return list;
}

// @auth/drizzle-adapter is typed against Auth.js v5's Adapter shape. The
// runtime is API-compatible with NextAuth v4; the cast bridges the type-only
// gap. Verified by exercising every adapter method via signup, magic-link,
// and Google flows in PR1-C4/C5.
function adapter(): Adapter | undefined {
  if (!db) return undefined;
  return DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as unknown as Adapter;
}

export const authOptions: NextAuthOptions = {
  adapter: adapter(),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // Refresh emailVerified from DB on sign-in and on explicit client
      // update() calls (used after the user clicks the verification link).
      // Stays cached in the JWT for the rest of the session.
      const shouldRefresh = !!user || trigger === 'update';
      if (shouldRefresh && token.id && db) {
        const row = await db.query.users.findFirst({
          where: eq(users.id, token.id),
          columns: { emailVerified: true },
        });
        token.emailVerified = row?.emailVerified ? row.emailVerified.getTime() : null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.emailVerified =
          typeof token.emailVerified === 'number' ? new Date(token.emailVerified).toISOString() : null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verifyRequest=1',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
