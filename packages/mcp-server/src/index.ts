#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import http from 'node:http';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.transport === 'http') {
    const server = createServer(config);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);

    const httpServer = http.createServer((req, res) => {
      transport.handleRequest(req, res).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
        res.end(`MCP transport error: ${message}`);
      });
    });

    await new Promise<void>((resolve) => httpServer.listen(config.httpPort, resolve));
    // stderr so it does not interfere with MCP stdio framing if mistakenly piped
    process.stderr.write(
      `bugsense-mcp http transport listening on :${config.httpPort} (base ${config.baseUrl})\n`,
    );

    const shutdown = async (): Promise<void> => {
      httpServer.close();
      await server.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  // Default: stdio transport (used by Claude Desktop, Cursor, Claude Code, Windsurf)
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Do NOT write to stdout — it is the MCP framing channel.
  process.stderr.write(`bugsense-mcp stdio transport ready (base ${config.baseUrl})\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`bugsense-mcp fatal: ${message}\n`);
  process.exit(1);
});
