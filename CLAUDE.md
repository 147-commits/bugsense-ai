# Project: BugSense AI
Next.js 14 App Router, TypeScript strict, Tailwind, Drizzle ORM
(Neon Postgres), NextAuth, Anthropic SDK, Zustand, Recharts.

# Hard rules
- TypeScript strict. Never use `any`. If a type is unknown, use `unknown`
  and narrow.
- This project uses Drizzle (Neon serverless Postgres). Schema lives at
  lib/database/schema.ts. There is no Prisma anywhere — do not add it.
- Server-only code (DB queries, AI calls, secrets) lives in /lib or in
  route handlers under /app/api. Never import server code into a client
  component.
- Mark client components with "use client" only when they use hooks,
  state, or browser APIs. Default to server components.
- All API route handlers must validate input with zod and return typed
  JSON. Never trust req.body.
- All AI calls go through lib/ai/bugAnalyzer.ts. If AI_API_KEY is
  missing, fall back to deterministic mock responses — never throw.
- Errors: catch, log with context, return typed error responses. Never
  swallow with empty catch blocks.
- No new dependencies without explicit approval. Use what is already in
  package.json.
- File naming: kebab-case for routes, PascalCase for components,
  camelCase for utilities.

# Workflow rules for the AI agent
1. Before writing code, write a short plan as a comment or message:
   files to change, functions to add, types to add.
2. After writing code, run: `npx tsc --noEmit`, `npm run lint`,
   `npm run build`. Fix every error. Do not declare the task done while
   any error remains.
3. When adding a feature, also add the type definitions in /types and
   the zod schema where input is accepted.
4. When changing the DB schema, also generate the migration:
   `npm run db:generate`. Do not edit the generated SQL by hand.
5. If a requirement is ambiguous, stop and ask. Do not guess.

# Forbidden patterns
- `as any`, `// @ts-ignore`, `// @ts-expect-error` without a comment
  explaining why
- catch (e) {} with empty body
- console.log in committed code (use a proper logger or remove)
- Hardcoded secrets, URLs, or API keys
- Inventing packages or APIs that are not in package.json or the
  official docs
