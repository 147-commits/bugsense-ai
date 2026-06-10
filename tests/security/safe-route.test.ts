import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import { safeRoute } from '@/lib/security/safe-route';

describe('safeRoute', () => {
  it('returns the handler response unchanged on the happy path, with x-request-id', async () => {
    const res = await safeRoute('test/ok', async () => {
      return NextResponse.json({ ok: true }, { status: 201 });
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(await res.json()).toEqual({ ok: true });
  });

  it('translates a "Failed query:" throw into a 503 database_unavailable', async () => {
    const res = await safeRoute('test/db', async () => {
      throw new Error('Failed query: select 1');
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('database_unavailable');
    expect(body.requestId).toBeTruthy();
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
  });

  it('translates a connection-class pg sqlstate error into 503', async () => {
    const res = await safeRoute('test/db-conn', async () => {
      const err = new Error('connection terminated unexpectedly') as Error & { code: string };
      err.code = '08006';
      throw err;
    });
    expect(res.status).toBe(503);
  });

  it('treats ECONNREFUSED in the message as DB-class', async () => {
    const res = await safeRoute('test/db-econ', async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
    });
    expect(res.status).toBe(503);
  });

  it('returns 500 server_error for a generic application throw', async () => {
    const res = await safeRoute('test/generic', async () => {
      throw new Error('something logic-level broke');
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('server_error');
    expect(body.requestId).toBeTruthy();
  });

  it('treats non-Error throwables (string) as server_error', async () => {
    const res = await safeRoute('test/string-throw', async () => {
      throw 'just a string';
    });
    expect(res.status).toBe(500);
  });
});
