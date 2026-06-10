import { getRequestContext } from './request-context';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

interface LogPayload {
  ts: string;
  level: LogLevel;
  msg: string;
  requestId?: string;
  route?: string;
  context?: LogContext;
  err?: { name: string; message: string; stack?: string };
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function envLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? '').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[envLevel()];
}

function serializeError(err: unknown): { name: string; message: string; stack?: string } | undefined {
  if (!err) return undefined;
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { name: 'NonError', message: String(err) };
}

function emit(payload: LogPayload): void {
  if (process.env.NODE_ENV === 'production') {
    // JSON one-line — easy for any log ingestor to parse.
    process.stdout.write(JSON.stringify(payload) + '\n');
    return;
  }
  // Human-readable in dev. Stays on a single line for the message; context/err on follow-up lines.
  const parts = [
    payload.ts,
    payload.level.toUpperCase().padEnd(5),
    payload.requestId ? `[${payload.requestId.slice(0, 8)}]` : '',
    payload.route ? `(${payload.route})` : '',
    payload.msg,
  ].filter(Boolean);
  const stream = payload.level === 'error' || payload.level === 'warn' ? process.stderr : process.stdout;
  stream.write(parts.join(' ') + '\n');
  if (payload.context && Object.keys(payload.context).length > 0) {
    stream.write('  ctx: ' + JSON.stringify(payload.context) + '\n');
  }
  if (payload.err) {
    stream.write(`  err: ${payload.err.name}: ${payload.err.message}\n`);
    if (payload.err.stack) stream.write(payload.err.stack + '\n');
  }
}

function log(level: LogLevel, msg: string, contextOrError?: LogContext | Error | unknown, error?: unknown): void {
  if (!shouldEmit(level)) return;

  let context: LogContext | undefined;
  let err: unknown = error;
  if (contextOrError instanceof Error) {
    err = contextOrError;
  } else if (contextOrError && typeof contextOrError === 'object') {
    context = contextOrError as LogContext;
  }

  const ctx = getRequestContext();
  emit({
    ts: new Date().toISOString(),
    level,
    msg,
    requestId: ctx?.id,
    route: ctx?.route,
    context,
    err: serializeError(err),
  });
}

export const logger = {
  debug: (msg: string, context?: LogContext) => log('debug', msg, context),
  info: (msg: string, context?: LogContext) => log('info', msg, context),
  warn: (msg: string, contextOrError?: LogContext | Error, error?: unknown) =>
    log('warn', msg, contextOrError, error),
  error: (msg: string, contextOrError?: LogContext | Error, error?: unknown) =>
    log('error', msg, contextOrError, error),
};

export type Logger = typeof logger;
