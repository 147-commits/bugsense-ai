import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { db } from '@/lib/database/db';
import { pushBugToJira, SyncDryRunError, SyncNotConfiguredError } from '@/lib/jira/sync-out';
import { demoModeResponse, parseParams } from '@/lib/validation';

const ParamsSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!db) return demoModeResponse('Syncing to Jira requires a configured database.');

  const parsed = parseParams(params, ParamsSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await pushBugToJira(parsed.data.id, { siteOrigin: req.nextUrl.origin });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SyncNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof SyncDryRunError) {
      return NextResponse.json({ dryRun: true, message: err.message });
    }
    console.error('[bugs/jira/sync]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Sync to Jira failed.' }, { status: 502 });
  }
}
