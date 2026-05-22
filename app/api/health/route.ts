import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/database/db';

// Explicit placeholder/dummy values rejected as "unconfigured" so a misfilled
// .env doesn't silently look healthy. Matches the convention used by the AI
// client elsewhere in the codebase.
const PLACEHOLDER_VALUES = ['', 'your-api-key-here', 'sk-ant-xxxx', 'REPLACE_ME'];
const PLACEHOLDER_PREFIXES = ['sk-ant-test-'];

function configured(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  if (PLACEHOLDER_VALUES.includes(value)) return false;
  return !PLACEHOLDER_PREFIXES.some((p) => value.startsWith(p));
}

type DbState = 'up' | 'down' | 'demo_mode';

async function checkDatabase(): Promise<DbState> {
  if (!db) return 'demo_mode';
  try {
    await db.execute(sql`SELECT 1`);
    return 'up';
  } catch (err) {
    console.warn('[health] db check failed:', err instanceof Error ? err.message : err);
    return 'down';
  }
}

export async function GET() {
  const databaseState = await checkDatabase();

  const services = {
    database: databaseState,
    ai: configured(process.env.AI_API_KEY) ? 'configured' : 'unconfigured',
    encryption:
      configured(process.env.TOKEN_ENC_KEY) || configured(process.env.JIRA_TOKEN_ENC_KEY)
        ? 'configured'
        : 'unconfigured',
    integrations: {
      jira:
        configured(process.env.JIRA_CLIENT_ID) && configured(process.env.JIRA_CLIENT_SECRET)
          ? 'configured'
          : 'unconfigured',
      slack:
        configured(process.env.SLACK_CLIENT_ID) && configured(process.env.SLACK_CLIENT_SECRET)
          ? 'configured'
          : 'unconfigured',
      stripe: configured(process.env.STRIPE_SECRET_KEY) ? 'configured' : 'unconfigured',
    },
  } as const;

  const dbDown = databaseState === 'down';
  return NextResponse.json(
    {
      status: dbDown ? 'unhealthy' : 'healthy',
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
      services,
    },
    { status: dbDown ? 503 : 200 },
  );
}
