import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import { requireSameOrigin } from '@/lib/security/same-origin';

function fakeRequest(opts: {
  host?: string | null;
  origin?: string | null;
  referer?: string | null;
  proto?: string | null;
  url?: string;
}): NextRequest {
  const headers = new Headers();
  if (opts.host) headers.set('host', opts.host);
  if (opts.origin) headers.set('origin', opts.origin);
  if (opts.referer) headers.set('referer', opts.referer);
  if (opts.proto) headers.set('x-forwarded-proto', opts.proto);
  return {
    headers,
    nextUrl: new URL(opts.url ?? 'http://localhost:3000/api/auth/signup'),
  } as unknown as NextRequest;
}

describe('requireSameOrigin', () => {
  it('returns null when Origin matches host', () => {
    const req = fakeRequest({ host: 'localhost:3000', origin: 'http://localhost:3000' });
    expect(requireSameOrigin(req)).toBeNull();
  });

  it('returns 403 when Origin is a different host', async () => {
    const req = fakeRequest({ host: 'localhost:3000', origin: 'http://evil.example.com' });
    const res = requireSameOrigin(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
    const body = await res?.json();
    expect(body).toMatchObject({ error: 'forbidden', reason: 'origin_mismatch' });
  });

  it('returns 403 when no Origin and no Referer', async () => {
    const req = fakeRequest({ host: 'localhost:3000' });
    const res = requireSameOrigin(req);
    expect(res?.status).toBe(403);
    const body = await res?.json();
    expect(body.reason).toBe('origin_missing');
  });

  it('falls back to Referer when Origin is absent and matches', () => {
    const req = fakeRequest({
      host: 'localhost:3000',
      referer: 'http://localhost:3000/signup',
    });
    expect(requireSameOrigin(req)).toBeNull();
  });

  it('rejects a Referer from a different origin', async () => {
    const req = fakeRequest({
      host: 'localhost:3000',
      referer: 'http://evil.example.com/whatever',
    });
    const res = requireSameOrigin(req);
    expect(res?.status).toBe(403);
    const body = await res?.json();
    expect(body.reason).toBe('referer_mismatch');
  });

  it('rejects a malformed Referer URL', async () => {
    const req = fakeRequest({ host: 'localhost:3000', referer: 'not a url' });
    const res = requireSameOrigin(req);
    expect(res?.status).toBe(403);
  });

  it('honours x-forwarded-proto under a reverse proxy', () => {
    const req = fakeRequest({
      host: 'bugsense.example.com',
      proto: 'https',
      origin: 'https://bugsense.example.com',
    });
    expect(requireSameOrigin(req)).toBeNull();
  });

  it('returns 403 when the host header is missing entirely', async () => {
    const req = fakeRequest({ origin: 'http://localhost:3000' });
    const res = requireSameOrigin(req);
    expect(res?.status).toBe(403);
    const body = await res?.json();
    expect(body.reason).toBe('host_missing');
  });
});
