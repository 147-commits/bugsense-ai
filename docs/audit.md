# BugSense AI — Codebase Audit

Snapshot as of 2026-05-20. Read-only audit; no code changed.

---

## 1. Routes under `/app`

`(app)` and `(auth)` are route groups — they do **not** appear in URLs.

### Public / shell

| File | URL | Component | Purpose |
|---|---|---|---|
| `app/layout.tsx` | — | Server | Root HTML shell, metadata, wraps children in `Providers`. |
| `app/providers.tsx` | — | Client | NextAuth `SessionProvider` wrapper. |
| `app/page.tsx` | `/` | Server | Server-side redirect to `/dashboard`. |
| `app/not-found.tsx` | (404) | Server | Static 404 with home link. |
| `app/(app)/layout.tsx` | — | Client | Wraps authenticated app pages in `AppShell` (sidebar + topbar). |
| `app/(auth)/layout.tsx` | — | Server | Centered-card shell for sign-in / sign-up. |
| `middleware.ts` | (all) | — | `next-auth/middleware` gate. Public matcher excludes `/login`, `/register`, `/api/auth/*`, `/_next/*`, `/favicon.ico`, `/assets/*`. |

### Authenticated app routes (`(app)` group, all `"use client"`)

| URL | File | Purpose | API calls |
|---|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | Overview: stat cards, trend / module charts, recent bugs, project-scoped. | `GET /api/bugs/stats` |
| `/analytics` | `analytics/page.tsx` | "QA Insights": clusters, recurring bugs, quality radar. **Mock-only — no fetches.** | none |
| `/analyze` | `analyze/page.tsx` | Bug Analyzer: submit raw input, see structured AI card + QA chat. | `POST /api/analyze` (chat panel may call others via `QAChat`) |
| `/apitests` | `apitests/page.tsx` | API test suite generator (delegates to `GeneratorPage`). | `POST /api/apitests` |
| `/automation` | `automation/page.tsx` | UI automation script generator (POM). | `POST /api/automation` |
| `/bugs` | `bugs/page.tsx` | Bug Database with search/filters. **Mock-only — no fetches.** | none |
| `/coverage` | `coverage/page.tsx` | Coverage gap analyser. | `POST /api/coverage` |
| `/history` | `history/page.tsx` | Past generations + bug analyses per project, with detail modal. | `GET /api/history?projectId=…` |
| `/projects` | `projects/page.tsx` | CRUD projects (tech stack, conventions). | `GET/POST /api/projects`, `PATCH/DELETE /api/projects/[id]` |
| `/projects/[id]` | `projects/[id]/page.tsx` | Project detail with content tabs. | `GET /api/projects/[id]/content` |
| `/qadocs` | `qadocs/page.tsx` | QA document generator (10 doc types). | `POST /api/qadocs` |
| `/releasenotes` | `releasenotes/page.tsx` | Release notes (Changelog / Engineering / Customer / Slack). | `POST /api/releasenotes` |
| `/settings` | `settings/page.tsx` | UI settings — AI provider, integrations, data. **No save endpoint wired.** | none |
| `/testdata` | `testdata/page.tsx` | Test-data generator (BVA, partitions, edge, masking). | `POST /api/testdata` |
| `/testgen` | `testgen/page.tsx` | Test case generator from user stories. | `POST /api/testgen` |
| `/testplan` | `testplan/page.tsx` | Sprint test plan generator (ISO 29119-3). | `POST /api/testplan` |

### Auth routes (`(auth)` group)

| URL | File | Component | Purpose |
|---|---|---|---|
| `/login` | `(auth)/login/page.tsx` | Client | Credentials sign-in via NextAuth. Supports `?error=`, `?callbackUrl=`. |
| `/register` | `(auth)/register/page.tsx` | Client | Sign-up, then auto-sign-in. Calls `POST /api/auth/register`, then `signIn('credentials')`. |

Reachability check: every page is linked from `Sidebar.tsx`, `TopBar.tsx`, or another in-app page. No orphans.

---

## 2. API endpoints under `/app/api`

All `POST` handlers parse JSON via `await req.json()` — no zod validation today. All authenticated routes call `requireAuth()`; `register` and NextAuth handler are unauthenticated by design.

### Auth

| Endpoint | Method | Auth | Input | Output | Side effects |
|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | — | NextAuth-managed | NextAuth-managed | Session cookie issued. Uses `lib/auth/authOptions.ts` (Credentials provider, JWT session, bcrypt). |
| `/api/auth/register` | POST | none | `{ name?, email, password }` (password ≥ 8 chars) | `{ ok: true }` (201) / `{ error }` (400, 409) | `INSERT users` after `bcrypt.hash(password, 12)`; rejects duplicate email. |

### Health

| Endpoint | Method | Auth | Input | Output | Side effects |
|---|---|---|---|---|---|
| `/api/health` | GET | none | — | `{ status, version, timestamp, services: { ai, database } }` | None. Reports configured/demo state by env-var presence. |

### Projects

| Endpoint | Method | Auth | Input | Output | Side effects |
|---|---|---|---|---|---|
| `/api/projects` | GET | required | — | `Project[]` with `_count.bugReports`, `_count.members`. | Bootstrap: creates personal `organizations` + `organizationMembers` row on first call if user has none. |
| `/api/projects` | POST | required | `{ name, description?, techStack?, testConventions? }` | `Project` (with counts), 201 | `INSERT projects` + `INSERT projectMembers(role=OWNER)`. Slug derived from name; collision suffixed with `Date.now().toString(36)`. |
| `/api/projects/[id]` | PATCH | required + OWNER/ADMIN | `{ name?, description?, techStack?, testConventions? }` | `Project` (with counts) | `UPDATE projects`. 403 if not OWNER/ADMIN. |
| `/api/projects/[id]` | DELETE | required + OWNER/ADMIN | — | 204 | `DELETE projects` (cascade through FK `onDelete: 'cascade'` to members, bug reports, content). |
| `/api/projects/[id]/content` | GET | required | `?type=all\|bugs\|documents\|<gc-type>` | `{ project: ProjectWithCounts, generatedContent: GeneratedContent[], bugReports: BugReport[] }` (limit 200 each) | None. `type=documents` filters GC to `testplan\|releasenotes\|qadocs`. |

### Bugs

| Endpoint | Method | Auth | Input | Output | Side effects |
|---|---|---|---|---|---|
| `/api/bugs` | GET | required | `?projectId & ?severity & ?status & ?search & ?sortBy & ?order=asc\|desc` | `{ bugs: BugReport[] (with testCases), total: number }` | None. Search uses `ILIKE` on `title` OR `description`. Sort whitelisted to known columns. |
| `/api/bugs/stats` | GET | required | `?projectId?` | `{ totalBugs, criticalBugs, resolvedBugs, avgQualityScore, severityDistribution[], recentBugs, trendData:[], topModules:[] }` | None. `trendData`/`topModules` are placeholders (not yet computed). |
| `/api/analyze` | POST | required | `{ rawInput, logContent?, screenshotBase64?, projectId? }` | `{ bugReport, qualityScore, duplicates, testCases, reproductionChecklist }` | If `projectId`: `INSERT bugReports`. Calls `analyzeBug`, `calculateQualityScore`, `detectDuplicates` (against last 50 bugs of project), `generateTestCases`, `generateReproductionChecklist`. |
| `/api/chat` | POST | required | `{ bugReportId?, message, history?, projectId? }` | `{ response: string, projectId? }` | If `bugReportId`: `INSERT chatMessages × 2` (user + assistant). Loads bug context if `bugReportId` provided. |
| `/api/duplicates` | POST | required | `{ title, description, projectId? }` | Duplicate-detection JSON (see §4 `detectDuplicates`) | None. Compares against last 50 bugs in project (or globally). |
| `/api/export` | POST | required | `{ platform: 'jira'\|'github', bugReportId }` | `{ platform, exportData, message }` | None. Reads bug, returns formatted payload. |
| `/api/history` | GET | required | `?projectId` (required) | `{ items: TimelineItem[] }` merged from `generatedContent` + `bugReports`, sorted desc by `createdAt`, limit 100 each. | None. |

### Generators (all the same pattern: AI call + optional persistence)

| Endpoint | Method | Auth | Input | Output | Side effects |
|---|---|---|---|---|---|
| `/api/qadocs` | POST | required | `{ input, docType?, projectId? }` (default `docType='test_strategy'`) | AI doc result (see §4 `generateQADocumentation`) | If `projectId`: `INSERT generatedContent(type='qadocs')`. |
| `/api/releasenotes` | POST | required | `{ input, format?, projectId? }` | AI release notes | If `projectId`: `INSERT generatedContent(type='releasenotes')`. |
| `/api/testdata` | POST | required | `{ scenario, options?: { count, format, includeEdgeCases, locale }, projectId? }` | AI test data | If `projectId`: `INSERT generatedContent(type='testdata')`. |
| `/api/testgen` | POST | required | `{ userStory, options?, projectId? }` | AI test cases from story | If `projectId`: `INSERT generatedContent(type='testgen', framework?)`. |
| `/api/testplan` | POST | required | `{ sprintInfo, options?, projectId? }` | AI test plan | If `projectId`: `INSERT generatedContent(type='testplan')`. |
| `/api/automation` | POST | required | `{ scenario, framework?, options?, projectId? }` | AI automation project | If `projectId`: `INSERT generatedContent(type='automation', framework, language)`. |
| `/api/apitests` | POST | required | `{ apiDescription, format?, projectId? }` | AI API tests | If `projectId`: `INSERT generatedContent(type='apitests', framework=format)`. |
| `/api/coverage` | POST | required | `{ existingTests, expansionType?, projectId? }` | AI coverage analysis | If `projectId`: `INSERT generatedContent(type='coverage')`. |

### Orphaned API endpoints (no client references)

| Endpoint | Method | Status |
|---|---|---|
| `/api/quality-score` | POST | Functional — calls `calculateQualityScore`. No client fetches it. Subsumed by `/api/analyze` which calls the same function inline. |
| `/api/testcases` | POST | Functional — calls `generateTestCases`. No client fetches it. Subsumed by `/api/analyze`; `/testgen` UI uses `/api/testgen` (different function). |

---

## 3. Tables in `lib/database/schema.ts`

Drizzle / Postgres. All IDs are `varchar` cuid2 generated by `$defaultFn`. All tables have `createdAt` timestamp default `now()`, most have `updatedAt`.

### Enums (`pgEnum`)
- `Severity`: `CRITICAL | HIGH | MEDIUM | LOW | INFO`
- `Priority`: `P0 | P1 | P2 | P3 | P4`
- `BugStatus`: `OPEN | IN_PROGRESS | RESOLVED | CLOSED | DUPLICATE`
- `MemberRole`: `OWNER | ADMIN | MEMBER | VIEWER`
- `PlanTier`: `FREE | PRO | ENTERPRISE`
- `IntegrationType`: `GITHUB | JIRA | LINEAR | SLACK | WEBHOOK`

### `User`
Columns: `id`, `email` (unique, not null), `emailVerified`, `name`, `avatarUrl`, `passwordHash`, `createdAt`, `updatedAt`.
Indexes: `email`.
Relations: `many organizationMembers (organizations)`, `many projectMembers`, `many usageLogs`.

### `Organization`
Columns: `id`, `name`, `slug` (unique), `planTier` (default `FREE`), `createdAt`, `updatedAt`.
Indexes: `slug`.
Relations: `many organizationMembers (members)`, `many projects`, `many usageLogs`, `many integrations`.

### `OrganizationMember`
Columns: `id`, `userId → User (cascade)`, `organizationId → Organization (cascade)`, `role` (default `MEMBER`), `joinedAt`.
Indexes: unique `(userId, organizationId)`; `userId`; `organizationId`.
Relations: `one user`, `one organization`.

### `Project`
Columns: `id`, `name`, `slug`, `description?`, `techStack: text[]` (default `[]`), `testConventions: jsonb?`, `organizationId → Organization (cascade)`, `createdAt`, `updatedAt`.
Indexes: unique `(organizationId, slug)`; `organizationId`.
Relations: `one organization`, `many projectMembers (members)`, `many bugReports`, `many generatedContent`, `many usageLogs`, `many integrations`.

### `ProjectMember`
Columns: `id`, `userId → User (cascade)`, `projectId → Project (cascade)`, `role` (default `MEMBER`), `joinedAt`.
Indexes: unique `(userId, projectId)`; `userId`; `projectId`.
Relations: `one user`, `one project`.

### `UsageLog`
Columns: `id`, `userId? → User (set null)`, `organizationId? → Organization (set null)`, `projectId? → Project (set null)`, `action`, `resourceType?`, `resourceId?`, `tokensUsed?`, `cost?`, `metadata? jsonb`, `createdAt`.
Indexes: `userId`; `organizationId`; `projectId`; `createdAt`.
Relations: `one user`, `one organization`, `one project`.

### `Integration`
Columns: `id`, `organizationId? → Organization (cascade)`, `projectId? → Project (cascade)`, `type IntegrationType`, `name`, `config jsonb`, `isActive` (default `true`), `lastSyncAt?`, `createdAt`, `updatedAt`.
Indexes: `organizationId`; `projectId`; `type`.
Relations: `one organization`, `one project`.

### `BugReport`
Columns: `id`, `projectId? → Project (set null)`, `rawInput`, `title`, `description`, `severity Severity` (default `MEDIUM`), `priority Priority` (default `P2`), `status BugStatus` (default `OPEN`), `stepsToReproduce: text[]`, `expectedResult?`, `actualResult?`, `environment? jsonb`, `rootCauseHypotheses: text[]`, `affectedModules: text[]`, `qualityScore? double`, `duplicateOfId?` (self-ref, no FK constraint), `screenshotUrls: text[]`, `logContent?`, `aiAnalysis? jsonb`, `impactPrediction? jsonb`, `tags: text[]`, `clusterId?`, `createdAt`, `updatedAt`.
Indexes: `projectId`; `severity`; `status`; `createdAt`; `clusterId`.
Relations: `one project`, self-relation `duplicates ↔ duplicateOf` (`relationName: 'BugReportDuplicates'`), `one cluster`, `many testCases`, `many chatMessages`.

### `TestCase`
Columns: `id`, `bugReportId? → BugReport (cascade)`, `sourceType` (default `'bug'`), `sourceInput?`, `title`, `description`, `steps: text[]`, `expectedResult`, `type` (default `'regression'`), `priority Priority` (default `P2`), `framework?`, `codeSnippet?`, `createdAt`.
Indexes: `bugReportId`; `sourceType`.
Relations: `one bugReport`.

### `BugCluster`
Columns: `id`, `name`, `description?`, `bugCount` (default `0`), `createdAt`, `updatedAt`.
No indexes beyond PK.
Relations: `many bugReports`. (Note: `BugReport.clusterId` has no FK constraint to this table — relation is implicit.)

### `ChatMessage`
Columns: `id`, `bugReportId → BugReport (cascade)`, `role`, `content`, `createdAt`.
Indexes: `bugReportId`.
Relations: `one bugReport`.

### `GeneratedContent`
Columns: `id`, `projectId? → Project (set null)`, `type`, `input`, `output jsonb`, `framework?`, `language?`, `createdAt`.
Indexes: `projectId`; `type`; `createdAt`.
Relations: `one project`.

### `AnalyticsSnapshot`
Columns: `id`, `date` (default `now()`), `totalBugs`, `criticalBugs`, `highBugs`, `mediumBugs`, `lowBugs`, `resolvedBugs`, `duplicateBugs`, `avgQualityScore?`, `topModules? jsonb`, `createdAt`.
Indexes: `date`.
Relations: none defined.
**Not written by any code today** — table exists but no insert path.

---

## 4. AI functions in `lib/ai/bugAnalyzer.ts`

### Shared infrastructure
- Model: `process.env.AI_MODEL` (default `meta/llama-3.3-70b-instruct`). **No Claude model ID is hardcoded anywhere** despite README badge.
- Provider detected by key prefix: `nvapi-` → NVIDIA OpenAI-compatible (`https://integrate.api.nvidia.com/v1/chat/completions`); otherwise Anthropic Messages API (`https://api.anthropic.com/v1/messages`, header `anthropic-version: 2023-06-01`).
- `AI_API_KEY` is treated as missing if absent, contains `'xxxxx'`, or is < 20 chars (placeholder-aware) → mock mode.
- Central caller `callAI()`: prepends a global `ACCURACY_RULES` system block, `max_tokens: 4096`, `temperature: 0.3`, retries 3× on 408/429/504/5xx/empty with 5s/10s backoff.
- JSON extraction by local helper `extractJSON` (regex / brace-balance). **No schema validation** — `lib/ai/validator.ts` exists but is not imported by `bugAnalyzer.ts`.
- Mock fallback `getMockResponse()`: keyword-routed `if`-chain over the system prompt, returns hand-written deterministic JSON. Only non-determinism is the current date in release notes / QA docs.

### Functions

**`analyzeBug(rawInput, logContent?, screenshotDescription?)`**
- Out: full enterprise defect report — `defectId`, `title`, `description`, `severity`, `severityJustification`, `priority`, `priorityJustification`, `classification`, `stepsToReproduce`, `expected/actualResult`, `environment`, `rootCauseAnalysis[]`, `impactRadius`, `recommendedFix`, `testingRecommendations`, `triageRecommendation`, `negativeSpace`, `affectedModules`, `tags`, `confidence`, `clarificationNeeded`, plus legacy `technicalAnalysis`, `impactPrediction`.
- Prompt: inline ~110 lines, role = "BugSense AI — principal QA engineer", ISTQB/IEEE 1044 framing, severity/priority guidelines, output schema.
- Mock: deterministic SSO OAuth bug report.

**`calculateQualityScore(bugReport)`**
- Out: `{ score, rating: 'Godsend'|'Completionist'|'Literalist'|'Novice'|'Needs Work', breakdown: { identification, classification, reproduction, environment, evidence, analysis }, suggestions[], strengths[], summary }`.
- Prompt: 100-point rubric across 6 weighted dimensions (10/15/30/15/15/15).
- Mock: fixed score = 72 with full breakdown.

**`detectDuplicates(newBug, existingBugs)`**
- Out: `{ duplicates[], clusters[], summary: { totalCandidates, highConfidence, mediumConfidence, lowConfidence } }` with similarity breakdown per candidate.
- Prompt: weighted similarity (title 30% / desc 35% / component 15% / symptom 20%).
- Short-circuit: returns empty result if `existingBugs.length === 0` (no AI call).
- Mock: empty arrays.

**`generateTestCases({ title, description, stepsToReproduce })`**
- Out: array of `{ title, description, steps[], expectedResult, type: 'regression'|'smoke'|'edge_case'|'negative', priority: 'P0'..'P3' }`.
- Prompt: short, "QA test engineer".
- Mock: 5 hardcoded SSO-themed regression tests.

**`generateReproductionChecklist(bugReport)`**
- Out: `{ phase1_environment[], phase2_reproductionSteps[], phase3_isolationMatrix[], phase4_evidenceChecklist[], minimalReproduction, reproductionResult, crossEnvironment[], checklist[] (legacy), scenarios[] (legacy) }`.
- Prompt: inline four-phase debugging methodology.
- Mock: fixed SSO-themed checklist.

**`generateTestCasesFromStory(userStory, options)`**
- Options: `includeNegative`, `includeEdgeCases`, `includeSecurity`, `includePerformance`, `includeAccessibility`, `framework?`.
- Out: `{ testSuite, testCases[] (IEEE 829-shaped with traceability, BDD/Gherkin, code snippet when framework set), coverageAnalysis, executionTemplate }`.
- Prompt: dynamic — `testsPerCategory` computed from selected categories; appends BDD block only if `framework` set.
- Mock: 4 hardcoded password-reset test cases.

**`generateAPITests(apiDescription, format)`**
- Format: `'postman' | 'curl' | 'playwright' | 'cypress' | 'jest' | 'supertest'`.
- Out: `{ endpoint, testScripts[] with full assertion layers, setupCode, teardownCode, envVariables, totalTests }`.
- Prompt: framework-specific block selected from `formatInstructions`.
- Mock: 8 hardcoded Playwright tests for `/api/auth/login`.

**`generateReleaseNotes(input, format)`**
- Out: `{ version, versionBump, …, changelog, engineeringNotes, customerNotes, slackOutput, sections (legacy), markdownOutput }`. Prompt always asks for all three audience variants regardless of `format` arg.
- Date injected via `new Date().toISOString().split('T')[0]`.
- Mock: hardcoded v3.0.0 release notes; date is live.

**`generateTestData(scenario, options)`**
- Options: `count`, `format: 'json'|'csv'|'sql'|'typescript'`, `includeEdgeCases`, `locale` (default `'en-US'`).
- Out: `{ scenario, schema, validData[], bvaTable[], equivalencePartitions[], edgeCaseData[], invalidData[], dataMasking[], formattedOutput, totalRecords }`.
- Mock: hardcoded user-registration dataset.

**`generateTestPlan(sprintInfo, options)`**
- Options: `sprintDuration`, `teamSize`, `includeRegression`, `riskLevel: 'low'|'medium'|'high'`.
- Out: full ISO/IEC/IEEE 29119-3 plan (scope, risk matrix, quadrants, estimation, resource allocation, schedule, env, entry/exit, DoD, markdown).
- Mock: hardcoded Sprint 24 auth-improvements plan.

**`generateAutomationScript(scenario, framework, options)`**
- Framework: `'playwright' | 'cypress' | 'selenium-js' | 'puppeteer' | 'webdriverio'`. Options: `language`, `includePageObject`, `includeHelpers`, `includeCIConfig`.
- Out: `{ framework, language, projectStructure, files[], packageJson, setupInstructions[], runCommand, debugCommand }`.
- Mock: hardcoded Playwright/TS login-flow project (6 files).

**`expandCoverage(existingTests, expansionType)`**
- `expansionType: 'edge_cases'|'negative'|'security'|'performance'|'accessibility'|'all'`.
- Out: `{ analysis (current/projected score, gaps), gapAnalysis, coverageHeatMap, newTestCases, prioritizedOrder, resourceEstimate, coverageImprovement, executiveSummary }`.
- Mock: hardcoded login-coverage gap analysis with 6 new tests.

**`generateQADocumentation(input, docType)`**
- `docType` ∈ 10 literals (`test_strategy`, `test_summary`, `traceability_matrix`, `test_closure`, `defect_report`, `test_environment`, `qa_checklist`, `test_execution_report`, `uat_signoff`, `risk_assessment`).
- Prompt is the only one **partly centralized**: `getDocTypePrompt(docType, dateStr)` returns one of 10 templates from a `Record<QADocType, string>`; remainder of the system prompt (output schema + "FINAL CHECKS") is appended inline.
- Out: `{ document, sections[], tables[], markdownOutput, summary }`.
- Mock: hardcoded sections for `test_strategy`, `test_summary`, `traceability_matrix`, `test_closure`, `defect_report`; others fall back to `test_strategy`.

**`chatAboutBug(bugContext, messages, userMessage)`** — outlier
- Out: plain string (markdown) — the only function that does **not** return parsed JSON.
- Bypasses `callAI`: implements its own `fetch`, `max_tokens: 2048` (others use 4096), **no `temperature`**, **no `ACCURACY_RULES`**, no retry logic.
- Mock: `getMockChatResponse(userMessage)` — keyword-routed deterministic text.

**`formatForJira(bug)` / `formatForGitHub(bug)`**
- Synchronous pure formatters. Jira → `{ fields: { summary, description, labels } }` (Jira wiki markup). GitHub → `{ title, body, labels }` (Markdown, labels include `severity:<lower>`).
- No AI calls. No mock branch.

---

## 5. Inconsistencies

### README is stale (Prisma → Drizzle)
- Badge (line 10) and "Database" row (line 51) still say Prisma 5.22.
- Setup steps `npx prisma generate`, `npx prisma db push`, `npx prisma db seed` (lines 94–96) — no Prisma in `package.json`, no `prisma/` directory. Actual scripts: `db:generate`, `db:migrate`, `db:studio` (not documented).
- `## Project Structure` (lines 162–173) claims `lib/database/prisma.ts` and a top-level `prisma/` dir; actual files are `lib/database/{db.ts,index.ts,schema.ts}`.
- Footer credit (line 300) still names Prisma.

### `vercel.json` will break the build
- `"buildCommand": "prisma generate && next build"` — `prisma` is not installed; Vercel deploy will fail post-migration. Either remove the prefix or replace with `npm run db:generate` (if a deploy-time migration is needed).

### README understates the surface area
- Not documented: `(auth)` routes, `middleware.ts`, `/api/auth/[...nextauth]`, `/api/auth/register`, `/api/projects*`, `/api/history`, `/api/qadocs`, `/api/releasenotes`, `/api/testdata`, `/api/testgen`, `/api/testplan`, `/api/automation`, `/api/apitests`, `/api/coverage`, `/api/chat` (mentioned but other generators are not).
- `components/ui/` and `lib/ai/` are listed with single files but contain more (`AIDisclaimer.tsx`, `CodeBlock.tsx`, `Feedback.tsx`; `validator.ts`).
- README claims "PostgreSQL (optional — works with mock data out of the box)" — practically false: `lib/database/db.ts` throws if `DATABASE_URL` is missing at import time, and `/api/*` routes all require it.

### Provider / model mismatch
- README and Claude badge advertise Anthropic Claude. Actual default model is `meta/llama-3.3-70b-instruct` via NVIDIA. The code switches to Anthropic Messages API only if the key does not begin with `nvapi-`. No Claude model ID appears in source.

### Validation gaps
- `CLAUDE.md` mandates zod input validation and typed JSON responses for every route; **none of the 22 routes validate input with zod today**. Several `as unknown as Record<string, unknown>` casts (analyze, generators, export) violate the "no `any`" spirit at runtime.
- `lib/ai/validator.ts` exposes `validateBugAnalysis`, `validateTestCases`, `validateCodeOutput`, `cleanAIText`. Only `validateBugAnalysis` is wired (in `/api/analyze`). The other three are orphan validators despite being the only safety net between AI output and the DB.

### Schema vs runtime
- `BugReport.clusterId` references `BugCluster` only by name — no FK constraint, no `onDelete` policy. Drizzle relation works at the query layer but the database does not enforce it.
- `AnalyticsSnapshot` table exists but no code reads or writes it.
- `types/index.ts` defines `ChatMessage` independently; Drizzle infers another `ChatMessage` from the table. Both exist; neither is consumed by name.

### Other
- `app/(app)/analytics/page.tsx` and `app/(app)/bugs/page.tsx` render exclusively from `lib/utils/mockData.ts` — bug DB and analytics are not wired to the API even though the endpoints exist.
- `app/(app)/settings/page.tsx` UI is fully local state — no save action exists.
- `lib/auth/getCurrentUser.ts` exports `getCurrentUser` and `getSession`; neither is imported anywhere.

---

## 6. Dead code, unused exports, TODOs

### Real `TODO` / `FIXME` / `HACK` / `XXX` markers
None in source. Matches found are either documentation references (`CLAUDE.md`), a list of placeholder strings inside `validator.ts:92`, or a `CVE-2026-XXXX` string in a mock release-notes example (`bugAnalyzer.ts:2234`). No `@ts-ignore` or `@ts-expect-error` exists anywhere.

### Empty `catch` blocks
None. All `catch` blocks log and respond. (One harmless `res.json().catch(() => ({ error: 'Request failed' }))` in `projects/page.tsx` is a deliberate promise fallback.)

### `console.log` in committed code
CLAUDE.md forbids `console.log`. Several routes use `console.error('… error:', error)` — those are arguably acceptable but worth standardising on a logger as the codebase grows.

### Likely dead API routes
- `app/api/quality-score/route.ts` — no client fetches it; `/api/analyze` does the same call inline.
- `app/api/testcases/route.ts` — no client fetches it; `/api/analyze` does the same call inline, and `/testgen` UI uses a different function.

Both are still listed in the README; verify before removing.

### Unused exports

`lib/`
| File:Line | Symbol | Notes |
|---|---|---|
| `lib/auth/getCurrentUser.ts:11` | `getCurrentUser` | Whole file unimported. |
| `lib/auth/getCurrentUser.ts:32` | `getSession` | Same. |
| `lib/ai/validator.ts:45` | `validateTestCases` | Only `validateBugAnalysis` is used. |
| `lib/ai/validator.ts:71` | `validateCodeOutput` | Unused. |
| `lib/ai/validator.ts:107` | `cleanAIText` | Unused. |
| `lib/utils/index.ts:38` | `severityDotColor` | Unused. |
| `lib/utils/index.ts:60` | `truncate` | Shadowed by local copies in `history/page.tsx`, `projects/[id]/page.tsx`. |
| `lib/utils/index.ts:65` | `generateId` | Unused. |
| `lib/utils/index.ts:76` | `getQualityScoreLabel` | Unused. |
| `lib/utils/mockData.ts:190` | `mockTestCases` | Unused. |

`components/`
| File:Line | Symbol | Notes |
|---|---|---|
| `components/ui/Loading.tsx:15` | `CardSkeleton` | Unused. |
| `components/ui/Loading.tsx:25` | `AnalysisSkeleton` | Unused. |
| `components/ui/Loading.tsx:44` | `ProgressBar` | Unused. |
| `components/ui/AIDisclaimer.tsx:6` | `AIDisclaimer` | Unused — whole file unimported. |
| `components/ui/AIDisclaimer.tsx:21` | `ConfidenceBadge` | Unused. |
| `components/charts/BugCharts.tsx:103` | `Sparkline` | Unused. Code comment already marks it as legacy. |

`types/`
| File:Line | Symbol | Notes |
|---|---|---|
| `types/index.ts:70` | `ChatMessage` | Unused (and clashes with Drizzle-inferred `ChatMessage`). |
| `types/index.ts:78` | `BugCluster` | Unused. |
| `types/index.ts:86` | `AnalyzeRequest` | Unused. |
| `types/index.ts:92` | `AnalyzeResponse` | Unused. |
| `types/index.ts:111` | `ExportConfig` | Unused. |

All "unused" entries are based on a repo-wide name grep. Some (the validators, `Sparkline`, `AIDisclaimer`) look like deliberate library surface waiting to be consumed — verify before removing.

### Other Prisma residue worth noting
Mock release-notes strings in `bugAnalyzer.ts:854, 2239, 2247, 2273` still reference `npx prisma migrate deploy`. They are prompt content, not executable code, but if you scrub Prisma site-wide, they should be updated.
