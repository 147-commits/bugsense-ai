import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@/lib/observability/logger';
import { runWithRequestContext } from '@/lib/observability/request-context';

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const captured: { stream: 'out' | 'err'; chunk: string }[] = [];
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    captured.length = 0;
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      captured.push({ stream: 'out', chunk: String(chunk) });
      return true;
    });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      captured.push({ stream: 'err', chunk: String(chunk) });
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    (process.env as Record<string, string | undefined>).NODE_ENV =originalNodeEnv;
    if (originalLogLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = originalLogLevel;
  });

  it('emits info to stdout in dev format', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ='development';
    logger.info('hello world');
    const text = captured.map((c) => c.chunk).join('');
    expect(text).toContain('INFO');
    expect(text).toContain('hello world');
    expect(captured[0].stream).toBe('out');
  });

  it('emits error to stderr', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ='development';
    logger.error('boom');
    expect(captured.some((c) => c.stream === 'err' && c.chunk.includes('boom'))).toBe(true);
  });

  it('serializes Error as second arg', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ='development';
    const err = new Error('thing broke');
    logger.error('catching it', err);
    const text = captured.map((c) => c.chunk).join('');
    expect(text).toContain('thing broke');
  });

  it('attaches context object', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ='development';
    logger.warn('partial failure', { route: 'auth/signup', userId: 'u1' });
    const text = captured.map((c) => c.chunk).join('');
    expect(text).toContain('"route":"auth/signup"');
    expect(text).toContain('"userId":"u1"');
  });

  it('emits JSON in production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ='production';
    process.env.LOG_LEVEL = 'debug';
    logger.info('prod line', { foo: 'bar' });
    const text = captured.map((c) => c.chunk).join('');
    expect(text).toMatch(/^\{[^\n]+\}\n$/);
    const parsed = JSON.parse(text.trim());
    expect(parsed).toMatchObject({ level: 'info', msg: 'prod line', context: { foo: 'bar' } });
  });

  it('respects LOG_LEVEL filter (info hides debug)', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ='production';
    process.env.LOG_LEVEL = 'info';
    logger.debug('should not appear');
    logger.info('should appear');
    const text = captured.map((c) => c.chunk).join('');
    expect(text).not.toContain('should not appear');
    expect(text).toContain('should appear');
  });

  it('attaches requestId + route from AsyncLocalStorage', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ='production';
    process.env.LOG_LEVEL = 'debug';
    await runWithRequestContext(
      { id: 'req-xyz-12345678', route: 'test/route', startedAt: Date.now() },
      async () => {
        logger.info('inside');
      },
    );
    const text = captured.map((c) => c.chunk).join('');
    const parsed = JSON.parse(text.trim());
    expect(parsed.requestId).toBe('req-xyz-12345678');
    expect(parsed.route).toBe('test/route');
  });

  it('handles non-Error throwables (string) by surfacing them as err', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ='production';
    process.env.LOG_LEVEL = 'debug';
    logger.error('string throw', 'oops it broke');
    const text = captured.map((c) => c.chunk).join('');
    const parsed = JSON.parse(text.trim());
    expect(parsed.err).toMatchObject({ name: 'NonError', message: 'oops it broke' });
  });
});
