import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

const POST_URL = 'https://slack.com/api/chat.postMessage';

export class SlackClientError extends Error {}

export interface PostMessageInput {
  accessToken: string;
  channel: string;
  blocks: unknown[];
  /** Plain-text fallback for notifications and accessibility. */
  text: string;
}

export async function postMessage(input: PostMessageInput): Promise<void> {
  const res = await fetchWithTimeout(POST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel: input.channel,
      blocks: input.blocks,
      text: input.text,
    }),
    timeoutMs: 10_000,
  });
  if (!res.ok) {
    throw new SlackClientError(`Slack chat.postMessage HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) {
    throw new SlackClientError(`Slack chat.postMessage error: ${data.error ?? 'unknown'}`);
  }
}
