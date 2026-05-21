import type { ServerConfig } from './config.js';

export class BugSenseHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'BugSenseHttpError';
  }
}

export class BugSenseClient {
  constructor(private readonly config: ServerConfig) {}

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(this.config.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = new URL(this.config.baseUrl + path);
    return this.request<T>(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(url: URL, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.config.apiKey) {
      headers.set('authorization', `Bearer ${this.config.apiKey}`);
    }

    let res: Response;
    try {
      res = await fetch(url, { ...init, headers });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new BugSenseHttpError(
        `Network error reaching ${url.toString()}: ${reason}`,
        0,
        null,
      );
    }

    const text = await res.text();
    let parsed: unknown = text;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave as text
      }
    }

    if (!res.ok) {
      throw new BugSenseHttpError(
        `BugSense API ${res.status} ${res.statusText} for ${url.pathname}`,
        res.status,
        parsed,
      );
    }

    return parsed as T;
  }
}
