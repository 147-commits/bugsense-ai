import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

export type DB = ReturnType<typeof drizzle<typeof schema>>;

let warned = false;
function warnOnce(reason: string): void {
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn(`[db] ${reason} — running in demo mode. DB-backed routes will return mock data or 503.`);
}

function initDb(): DB | null {
  if (!process.env.DATABASE_URL) {
    warnOnce('DATABASE_URL is not set');
    return null;
  }
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzle(pool, { schema });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    warnOnce(`failed to initialise Neon pool: ${reason}`);
    return null;
  }
}

/**
 * Drizzle client, or null when DATABASE_URL is missing / connection fails.
 * Callers MUST check for null and either return mock data (reads) or a 503
 * "demo mode" response (writes). Never throws at import time.
 */
export const db: DB | null = initDb();
