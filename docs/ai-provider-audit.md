# AI Provider Audit

Date: 2026-05-20

Purpose: prove that every AI call in this codebase goes through one provider
(Anthropic Claude), match what the README and product copy claim, and
document anything that changed during cleanup.

## What I found

Repo-wide search for non-Anthropic provider markers:

```
grep -ri 'llama|nvidia|nvapi|openai|gpt-3|gpt-4|meta/llama'
```

Live-code results: **none.** Matches exist only inside `docs/audit.md`
(a historical audit snapshot) and `README.md` previously, plus the Settings
UI which advertised an OpenAI option — both fixed during this pass.

## Call sites

Every AI invocation in the codebase flows through one of two functions in
`lib/ai/runner.ts`:

- `runJsonAI` — JSON-producing AI calls (12 functions in `bugAnalyzer.ts`)
- `runTextAI` — text response (`chatAboutBug`)

Both go through `getAnthropicClient()` in `lib/ai/client.ts`, which uses the
`@anthropic-ai/sdk` package with `messages.create(...)`. Default model is
`claude-sonnet-4-6` (env-overridable via `AI_MODEL`).

Functions in `lib/ai/bugAnalyzer.ts` that call the model:

1. `analyzeBug`
2. `calculateQualityScore`
3. `detectDuplicates`
4. `generateTestCases`
5. `generateReproductionChecklist`
6. `generateTestCasesFromStory`
7. `generateAPITests`
8. `generateReleaseNotes`
9. `generateTestData`
10. `generateTestPlan`
11. `generateAutomationScript`
12. `expandCoverage`
13. `generateQADocumentation`
14. `chatAboutBug`

Plus `formatForJira` and `formatForGitHub` — pure formatters, no AI call.

## What changed

1. **`app/(app)/settings/page.tsx`** — the AI Provider dropdown listed
   `Anthropic (Claude)` and `OpenAI (GPT-4)` as selectable options. OpenAI
   is not wired anywhere in the code, so the option was misleading.
   Replaced the dropdown with a static display showing
   `Anthropic (Claude) — Only provider supported in v1`.

2. **`README.md` Tech Stack row** — was `Anthropic Claude API (with OpenAI
   fallback support)`. The "OpenAI fallback support" parenthetical was
   false; no OpenAI client exists. Updated to `Anthropic Claude API`.

## Carried over from prior cleanup (not changed in this pass)

These were already fixed in earlier work, recorded here for completeness:

- `lib/ai/bugAnalyzer.ts` originally dispatched between Anthropic and an
  NVIDIA OpenAI-compatible endpoint based on whether `AI_API_KEY` started
  with `nvapi-`, with a default model of `meta/llama-3.3-70b-instruct`.
  The reliability refactor (see git log: "Refactor bugAnalyzer.ts for
  reliability") deleted that branch. The codebase now talks only to
  Anthropic.
- README badge and Tech Stack already updated to reflect Drizzle (not
  Prisma) in an earlier cleanup pass.

## Verification commands

```
grep -ri 'llama\|nvidia\|nvapi\|openai\|gpt-3\|gpt-4\|meta/llama' \
  --include='*.ts' --include='*.tsx' --include='*.md' .
```

Live-code matches: zero. Only matches remaining are inside `docs/audit.md`
(intentionally preserved as a historical snapshot) and inside CI fixtures
none exist.
