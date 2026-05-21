export type ServerConfig = {
  baseUrl: string;
  apiKey: string | null;
  transport: 'stdio' | 'http';
  httpPort: number;
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_HTTP_PORT = 8765;

function arg(name: string, argv: string[]): string | undefined {
  const prefix = `--${name}=`;
  const direct = argv.find((a) => a.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const idx = argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  return undefined;
}

export function loadConfig(argv: string[] = process.argv.slice(2)): ServerConfig {
  const baseUrl = arg('base-url', argv) ?? process.env.BUGSENSE_BASE_URL ?? DEFAULT_BASE_URL;
  const apiKey = arg('api-key', argv) ?? process.env.BUGSENSE_API_KEY ?? null;
  const transportRaw =
    arg('transport', argv) ?? process.env.BUGSENSE_MCP_TRANSPORT ?? 'stdio';
  const transport: ServerConfig['transport'] = transportRaw === 'http' ? 'http' : 'stdio';
  const httpPortRaw = arg('port', argv) ?? process.env.BUGSENSE_MCP_PORT;
  const httpPort = httpPortRaw ? Number.parseInt(httpPortRaw, 10) : DEFAULT_HTTP_PORT;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    transport,
    httpPort: Number.isFinite(httpPort) ? httpPort : DEFAULT_HTTP_PORT,
  };
}
