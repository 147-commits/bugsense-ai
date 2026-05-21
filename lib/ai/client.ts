import Anthropic from '@anthropic-ai/sdk';

let cached: Anthropic | null | undefined;

const PLACEHOLDER_FRAGMENTS = ['xxxxx', 'your-key', 'replace', 'placeholder'];

function isUsableKey(key: string | undefined): key is string {
  if (!key) return false;
  if (key.length < 20) return false;
  const lower = key.toLowerCase();
  return !PLACEHOLDER_FRAGMENTS.some((p) => lower.includes(p));
}

/**
 * Returns a configured Anthropic client, or null when no usable API key is
 * present. NEVER throws at import time or call time — callers must handle the
 * null branch by falling back to mock responses.
 */
export function getAnthropicClient(): Anthropic | null {
  if (cached !== undefined) return cached;

  const key = process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!isUsableKey(key)) {
    cached = null;
    return cached;
  }

  try {
    cached = new Anthropic({ apiKey: key });
  } catch {
    cached = null;
  }
  return cached;
}

/** For tests only. */
export function _resetAnthropicClientForTests(): void {
  cached = undefined;
}

export const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4-6';
