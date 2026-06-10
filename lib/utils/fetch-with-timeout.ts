export interface FetchWithTimeoutOptions extends RequestInit {
  /** Hard deadline in ms before the request is aborted. Default 15_000. */
  timeoutMs?: number;
}

export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`fetch to ${url} exceeded ${timeoutMs}ms`);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * `fetch` with an enforced timeout via AbortController.
 *
 * The native fetch will hang indefinitely if the remote never responds —
 * a real risk for third-party APIs (Resend, Slack, Jira, GitHub). Wrap
 * every outbound HTTP call in this so route handlers can return a 504/503
 * within a predictable time budget.
 */
export async function fetchWithTimeout(
  input: string | URL,
  { timeoutMs = 15_000, signal, ...init }: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new FetchTimeoutError(String(input), timeoutMs)), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const reason = controller.signal.reason;
      if (reason instanceof FetchTimeoutError) throw reason;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
