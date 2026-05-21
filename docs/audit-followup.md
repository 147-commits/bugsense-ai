# Audit Follow-up

Re-audit of `docs/audit.md` after the cleanup pass. Each inconsistency and
dead-code item is marked **FIXED**, **OUT OF SCOPE**, or **NOT
APPLICABLE** with a one-line note.

## Inconsistencies

### README is stale (Prisma → Drizzle)
- Badge, Database row, setup steps, project structure, footer — **FIXED**
  (in an earlier pass; see `docs/ai-provider-audit.md` and git history).

### `vercel.json` will break the build
- Build command is now `next build`. **FIXED** (earlier pass).

### README understates the surface area
- Project Structure section now lists every route, every `lib/` subdir, and
  the auth group. **FIXED** (earlier pass).
- `lib/database/db.ts` no longer throws when `DATABASE_URL` is missing —
  it returns a `null` client and logs once. The README claim that the app
  works without a DB is now actually true for `/bugs` and `/analytics`.
  **FIXED** in this pass.

### Provider / model mismatch
- All AI calls go to Anthropic Claude only. Settings UI no longer offers
  OpenAI. See `docs/ai-provider-audit.md`. **FIXED**.

### Validation gaps
- All 21 route handlers under `/app/api` now use zod schemas via the
  helpers in `lib/validation.ts` (`parseBody`, `parseQuery`, `parseParams`).
  Malformed bodies return **400 with `{ error, issues }`**, never 500.
  Verified end-to-end against `/api/auth/register` (the only POST exempt
  from NextAuth middleware in this environment); every other POST uses the
  same helper. **FIXED**.
- `lib/ai/validator.ts` — `validateBugAnalysis` is kept (used in
  `/api/analyze`). The orphan `validateTestCases`, `validateCodeOutput`,
  `cleanAIText` exports were deleted in this pass. **FIXED**.

### Schema vs runtime
- `BugReport.clusterId` lacks an FK to `BugCluster`. **OUT OF SCOPE** —
  user excluded schema changes beyond what's required to wire `/bugs` and
  `/analytics`. Recorded as a known gap.
- `AnalyticsSnapshot` table exists but no code reads/writes it. **OUT OF
  SCOPE** for the same reason. Recommend deleting the table in a follow-up
  schema-change PR.
- `types/index.ts` `ChatMessage` duplicated Drizzle's inferred type — the
  duplicate type export was deleted in this pass. **FIXED**.

### Other
- `app/(app)/analytics/page.tsx` and `app/(app)/bugs/page.tsx` now fetch
  from `/api/bugs/stats` and `/api/bugs` respectively, with a "Demo mode"
  badge shown when the API returns `demoMode: true`. **FIXED**.
- `app/(app)/settings/page.tsx` UI still has no save action. **OUT OF
  SCOPE** — adding persistence is a new feature, not in this pass.
  Recommend wiring a `/api/settings` GET/PUT endpoint in a follow-up.
- `lib/auth/getCurrentUser.ts` deleted entirely (no callers). **FIXED**.

## Dead code, unused exports

### Real `TODO` / `FIXME` / `HACK` / `XXX` markers
None previously, none now. **NOT APPLICABLE**.

### Empty `catch` blocks
None previously, none now. **NOT APPLICABLE**.

### `console.log` in committed code
Reviewed: every `console.error` in route handlers logs a meaningful failure
with context. `lib/database/db.ts` and `lib/ai/runner.ts` use
`console.warn`/`console.error` for genuinely actionable signals (DB
configuration, AI failure with truncated output). No `console.log`.
**NOT APPLICABLE**.

### Likely dead API routes
- `app/api/quality-score/route.ts` — deleted. **FIXED**.
- `app/api/testcases/route.ts` — deleted. **FIXED**.
- README's API Reference section was also updated to drop the documented
  endpoints for those routes.

### Unused exports

`lib/`
- `lib/auth/getCurrentUser.ts` — file deleted. **FIXED**.
- `lib/ai/validator.ts` — `validateTestCases`, `validateCodeOutput`,
  `cleanAIText` removed. **FIXED**.
- `lib/utils/index.ts` — `severityDotColor`, `truncate`, `generateId`,
  `getQualityScoreLabel` removed. **FIXED**.
- `lib/utils/mockData.ts` — `mockTestCases` removed (and the now-unused
  `TestCase` import). **FIXED**.

`components/`
- `components/ui/Loading.tsx` — `CardSkeleton`, `AnalysisSkeleton`,
  `ProgressBar` removed. `Spinner`, `Skeleton`, `AnalysisProgress` kept.
  **FIXED**.
- `components/ui/AIDisclaimer.tsx` — file deleted (both exports were
  unused). **FIXED**.
- `components/charts/BugCharts.tsx` — `Sparkline` removed. **FIXED**.

`types/`
- `types/index.ts` — `ChatMessage`, `BugCluster`, `AnalyzeRequest`,
  `AnalyzeResponse`, `ExportConfig` all removed. **FIXED**.

### Other Prisma residue (audit §6)
Mock release-notes strings in `bugAnalyzer.ts` previously referenced
`npx prisma migrate deploy`. Replaced with `npm run db:migrate` in an
earlier pass. **FIXED**.

## Out-of-scope items recorded as known gaps

The audit listed three items that are not addressed by this pass because
they would require either schema changes or new features (both explicitly
excluded by the task scope):

1. **`BugReport.clusterId` has no FK to `BugCluster`** — needs a migration
   to add the FK and an `onDelete: 'set null'` policy.
2. **`AnalyticsSnapshot` table is unused** — needs a migration to drop the
   table (or a writer added if there's a use case).
3. **`/settings` page has no save action** — needs a new
   `/api/settings/*` endpoint and a user-preferences table.

Recommend a follow-up PR titled "Schema cleanup + settings persistence" to
clear these.

## New tooling added in this pass

- `eslint` + `eslint-config-next@14.2.15` installed as devDeps so the
  verification step `npm run lint` actually runs. `.eslintrc.json` was
  already present.
- New helper module `lib/validation.ts` exposing `parseBody`,
  `parseQuery`, `parseParams`, and `demoModeResponse`. Every route now
  imports from it.

## Verification results

- `npx tsc --noEmit` — passes.
- `npm run lint` — `✔ No ESLint warnings or errors`.
- `npm run build` — passes; all routes registered.
- `POST /api/auth/register` with malformed JSON → **400** (`{ error: "Request body is not valid JSON." }`).
- `POST /api/auth/register` with `{}` → **400** (`{ error, issues }`).
- Remaining POST routes return 307 (middleware redirect to `/login`) in
  curl probes because they all sit behind NextAuth's middleware; the
  validation helper is structurally identical, so the behavior is the
  same once authenticated.
- `/bugs` and `/analytics` pages: with `DATABASE_URL` unset the API
  returns `demoMode: true` and the page renders the built-in sample data
  with a badge; with `DATABASE_URL` set the page renders live DB data.
