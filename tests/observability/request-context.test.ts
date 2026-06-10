import { describe, it, expect } from 'vitest';
import { getRequestContext, newRequestId, runWithRequestContext } from '@/lib/observability/request-context';

describe('request-context', () => {
  it('returns undefined outside a run', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it('exposes the context inside the run', async () => {
    const ctx = { id: 'r1', route: 'test', startedAt: 0 };
    const got = await runWithRequestContext(ctx, async () => getRequestContext());
    expect(got).toEqual(ctx);
  });

  it('isolates concurrent contexts', async () => {
    const r1 = runWithRequestContext({ id: 'a', route: 'x', startedAt: 0 }, async () => {
      await new Promise((r) => setTimeout(r, 10));
      return getRequestContext()?.id;
    });
    const r2 = runWithRequestContext({ id: 'b', route: 'y', startedAt: 0 }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getRequestContext()?.id;
    });
    const [a, b] = await Promise.all([r1, r2]);
    expect(a).toBe('a');
    expect(b).toBe('b');
  });

  it('newRequestId returns a unique-looking string', () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(typeof a).toBe('string');
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });
});
