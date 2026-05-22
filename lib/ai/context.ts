import { AsyncLocalStorage } from 'async_hooks';

export interface AiContext {
  organizationId: string;
}

const storage = new AsyncLocalStorage<AiContext>();

/**
 * Run the given function with an AI context bound. The runner reads this
 * context to gate calls against the org's monthly quota and to record the
 * call afterwards.
 */
export function withAiContext<T>(ctx: AiContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getAiContext(): AiContext | undefined {
  return storage.getStore();
}
