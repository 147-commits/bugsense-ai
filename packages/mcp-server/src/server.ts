import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BugSenseClient, BugSenseHttpError } from './client.js';
import { tools } from './tools.js';
import type { ServerConfig } from './config.js';

export function createServer(config: ServerConfig): McpServer {
  const client = new BugSenseClient(config);

  const server = new McpServer(
    { name: 'bugsense-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema.shape,
      },
      async (args: unknown) => {
        try {
          const result = await tool.handler(args as never, client);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result as Record<string, unknown>,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = err instanceof BugSenseHttpError ? err.status : undefined;
          const detail =
            err instanceof BugSenseHttpError && err.body ? `\n${JSON.stringify(err.body)}` : '';
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text:
                  status !== undefined
                    ? `Tool ${tool.name} failed (HTTP ${status}): ${message}${detail}`
                    : `Tool ${tool.name} failed: ${message}`,
              },
            ],
          };
        }
      },
    );
  }

  return server;
}
