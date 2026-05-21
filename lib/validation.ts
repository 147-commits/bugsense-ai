import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; response: NextResponse };

/**
 * Returns the validated JSON body, or an error response shaped
 * `{ error, issues }` with status 400 when:
 *   - the body is not valid JSON
 *   - the body fails the supplied schema
 */
export async function parseBody<T>(req: NextRequest, schema: z.ZodType<T>): Promise<Ok<T> | Err> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Request body is not valid JSON.' },
        { status: 400 },
      ),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid request body.', issues: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Validate URL search params against a schema. */
export function parseQuery<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
): Ok<T> | Err {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid query parameters.', issues: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Validate route params (e.g. dynamic `[id]` segments). */
export function parseParams<T>(params: unknown, schema: z.ZodType<T>): Ok<T> | Err {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid route parameters.', issues: parsed.error.issues },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Returned by routes that strictly require a database connection when
 * `db` is null (no DATABASE_URL configured).
 */
export function demoModeResponse(detail?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Demo mode — DATABASE_URL is not configured. This endpoint requires a database.',
      detail: detail ?? 'Set DATABASE_URL in your environment and restart the server.',
      demoMode: true,
    },
    { status: 503 },
  );
}
