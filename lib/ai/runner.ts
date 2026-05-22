import type { z } from 'zod';
import { checkAiCallAllowed, recordAiCall } from '@/lib/billing/limits';
import { AI_MODEL, getAnthropicClient } from './client';
import { cacheGet, cacheKey, cacheSet } from './cache';
import { getAiContext } from './context';

export class AiQuotaExceededError extends Error {
  constructor(
    public limit: number,
    public used: number,
  ) {
    super('AI call quota exceeded');
    this.name = 'AiQuotaExceededError';
  }
}

async function enforceQuota(): Promise<void> {
  const ctx = getAiContext();
  if (!ctx) return;
  const check = await checkAiCallAllowed(ctx.organizationId);
  if (!check.allowed && check.limit !== null) {
    throw new AiQuotaExceededError(check.limit, check.used);
  }
}

async function noteAttempt(): Promise<void> {
  const ctx = getAiContext();
  if (!ctx) return;
  await recordAiCall(ctx.organizationId);
}

const TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_TEXT_MAX_TOKENS = 2048;
const DEFAULT_TEXT_TEMPERATURE = 0.5;

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function extractJsonObject(text: string): unknown {
  // 1. Direct parse
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  // 2. Fenced ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      // fall through
    }
  }
  // 3. First brace / bracket onwards, brace-balanced
  const firstIdx = text.search(/[{[]/);
  if (firstIdx >= 0) {
    const slice = text.slice(firstIdx);
    try {
      return JSON.parse(slice);
    } catch {
      // 4. Brace-balanced scan for the first complete object
      let depth = 0;
      let start = -1;
      for (let i = 0; i < slice.length; i++) {
        const ch = slice[i];
        if (ch === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0 && start >= 0) {
            try {
              return JSON.parse(slice.substring(start, i + 1));
            } catch {
              start = -1;
            }
          }
        }
      }
    }
  }
  throw new Error('Model response did not contain parseable JSON');
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

async function callAnthropic(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  model: string;
}): Promise<string> {
  const client = getAnthropicClient();
  if (!client) throw new Error('Anthropic client not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await client.messages.create(
      {
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        system: opts.system,
        messages: opts.messages,
      },
      { signal: controller.signal },
    );
    const text = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export type RunJsonOptions<T> = {
  name: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  mock: () => T;
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

export async function runJsonAI<T>(opts: RunJsonOptions<T>): Promise<T> {
  const key = cacheKey(opts.name, opts.system, opts.user);
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  if (!getAnthropicClient()) return opts.mock();

  // Cache miss + real client = about to spend an API call. Gate, then count
  // the attempt regardless of outcome (mock fallback after a real failure
  // still consumed the user's intent).
  await enforceQuota();
  await noteAttempt();

  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const model = opts.model ?? AI_MODEL;

  // ── Attempt 1 ────────────────────────────────────────────────────────────
  let firstRaw = '';
  try {
    firstRaw = await callAnthropic({
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
      maxTokens,
      temperature,
      model,
    });
    const parsed = extractJsonObject(firstRaw);
    const validated = opts.schema.parse(parsed);
    cacheSet(key, validated);
    return validated;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (!firstRaw) {
      // Network, timeout, abort, or API error before any content was returned.
      console.error(`[ai/${opts.name}] call failed (no response): ${reason}`);
      return opts.mock();
    }
    console.error(
      `[ai/${opts.name}] attempt 1 invalid (${reason}); output=${truncate(firstRaw, 500)}`,
    );
  }

  // ── Attempt 2: explicit "JSON only" retry ───────────────────────────────
  const retryUser =
    `Your previous response was not valid JSON or did not match the required shape.\n` +
    `Return ONLY valid JSON matching the structure described in the system prompt. ` +
    `No prose, no markdown, no commentary.\n\n` +
    `Original request:\n${opts.user}\n\n` +
    `Previous response (truncated to 500 chars):\n${truncate(firstRaw, 500)}`;

  try {
    const retryRaw = await callAnthropic({
      system: opts.system,
      messages: [{ role: 'user', content: retryUser }],
      maxTokens,
      temperature,
      model,
    });
    const parsed = extractJsonObject(retryRaw);
    const validated = opts.schema.parse(parsed);
    cacheSet(key, validated);
    return validated;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[ai/${opts.name}] retry failed: ${reason}`);
    return opts.mock();
  }
}

export type RunTextOptions = {
  name: string;
  system: string;
  history: ChatMessage[];
  user: string;
  mock: () => string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

export async function runTextAI(opts: RunTextOptions): Promise<string> {
  const historyKey = opts.history
    .map((m) => `${m.role}:${m.content}`)
    .join('\n');
  const key = cacheKey(opts.name, opts.system, `${historyKey}\n${opts.user}`);
  const hit = cacheGet<string>(key);
  if (hit !== undefined) return hit;

  if (!getAnthropicClient()) return opts.mock();

  await enforceQuota();
  await noteAttempt();

  const maxTokens = opts.maxTokens ?? DEFAULT_TEXT_MAX_TOKENS;
  const temperature = opts.temperature ?? DEFAULT_TEXT_TEMPERATURE;
  const model = opts.model ?? AI_MODEL;

  try {
    const text = await callAnthropic({
      system: opts.system,
      messages: [...opts.history, { role: 'user', content: opts.user }],
      maxTokens,
      temperature,
      model,
    });
    if (!text.trim()) throw new Error('Empty model response');
    cacheSet(key, text);
    return text;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[ai/${opts.name}] failed: ${reason}`);
    return opts.mock();
  }
}
