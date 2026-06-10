import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { parseBody, parseParams, parseQuery, demoModeResponse } from '@/lib/validation';

function jsonRequest(body: unknown, url = 'http://localhost/api/x'): NextRequest {
  return {
    json: async () => body,
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

function badJsonRequest(): NextRequest {
  return {
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
    nextUrl: new URL('http://localhost/api/x'),
  } as unknown as NextRequest;
}

const Schema = z.object({ name: z.string().min(2), age: z.number().int().nonnegative() });

describe('parseBody', () => {
  it('returns ok+data on a valid payload', async () => {
    const r = await parseBody(jsonRequest({ name: 'Jane', age: 30 }), Schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ name: 'Jane', age: 30 });
  });

  it('returns a 400 NextResponse on a schema mismatch', async () => {
    const r = await parseBody(jsonRequest({ name: 'x', age: -1 }), Schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const body = await r.response.json();
      expect(body.error).toBe('Invalid request body.');
      expect(Array.isArray(body.issues)).toBe(true);
      expect(body.issues.length).toBeGreaterThan(0);
    }
  });

  it('returns a 400 when the body is not valid JSON', async () => {
    const r = await parseBody(badJsonRequest(), Schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const body = await r.response.json();
      expect(body.error).toBe('Request body is not valid JSON.');
    }
  });
});

describe('parseQuery', () => {
  const QSchema = z.object({ q: z.string().min(1), limit: z.string().regex(/^\d+$/) });

  it('reads URL search params and validates', () => {
    const req = {
      nextUrl: new URL('http://localhost/api/search?q=foo&limit=10'),
    } as unknown as NextRequest;
    const r = parseQuery(req, QSchema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ q: 'foo', limit: '10' });
  });

  it('rejects when required params are missing', () => {
    const req = { nextUrl: new URL('http://localhost/api/search?q=foo') } as unknown as NextRequest;
    const r = parseQuery(req, QSchema);
    expect(r.ok).toBe(false);
  });
});

describe('parseParams', () => {
  const PSchema = z.object({ id: z.string().uuid() });

  it('accepts a matching object', () => {
    const r = parseParams({ id: '550e8400-e29b-41d4-a716-446655440000' }, PSchema);
    expect(r.ok).toBe(true);
  });

  it('rejects a non-matching object with a 400', async () => {
    const r = parseParams({ id: 'not-a-uuid' }, PSchema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const body = await r.response.json();
      expect(body.error).toBe('Invalid route parameters.');
    }
  });
});

describe('demoModeResponse', () => {
  it('returns a 503 with the demoMode flag set', async () => {
    const res = demoModeResponse('signup needs the DB');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.demoMode).toBe(true);
    expect(body.detail).toBe('signup needs the DB');
  });
});
