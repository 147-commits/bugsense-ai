import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/utils/fetch-with-timeout';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchWithTimeout', () => {
  it('returns the underlying response when it resolves in time', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await fetchWithTimeout('https://example.com', { timeoutMs: 1000 });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('throws FetchTimeoutError when the deadline is exceeded', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_input, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    await expect(
      fetchWithTimeout('https://example.com/slow', { timeoutMs: 30 }),
    ).rejects.toBeInstanceOf(FetchTimeoutError);
  });

  it('propagates an upstream abort from the caller-supplied signal', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_input, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    const ac = new AbortController();
    const promise = fetchWithTimeout('https://example.com', { timeoutMs: 5000, signal: ac.signal });
    setTimeout(() => ac.abort(), 20);
    // The internal AbortController also aborts; the error is the DOMException
    // (not a FetchTimeoutError) because the timer never fired.
    await expect(promise).rejects.toBeInstanceOf(DOMException);
  });
});
