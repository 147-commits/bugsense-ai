import { NextRequest, NextResponse } from 'next/server';
import { lt } from 'drizzle-orm';
import { db } from '@/lib/database/db';
import { rateLimitBuckets } from '@/lib/database/schema';

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!db) return NextResponse.json({ ran: false, reason: 'no_db' });

  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const deleted = await db
    .delete(rateLimitBuckets)
    .where(lt(rateLimitBuckets.windowStart, cutoff))
    .returning({ key: rateLimitBuckets.key });

  return NextResponse.json({ ran: true, deletedCount: deleted.length });
}
