# BugSense MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
BugSense AI's bug and test data to AI coding agents (Cursor, Claude Code,
Claude Desktop, Windsurf).

The server is a thin shim — every tool call goes through the BugSense REST API
at `/api/*`, so the same auth and validation rules apply.

## Install

The package lives in this repo at `packages/mcp-server`. From the repo root:

```bash
cd packages/mcp-server
npm install         # installs deps and runs `prepare` -> `tsc` build
```

After that, `npx ./packages/mcp-server` (run from the repo root) will launch
the server. The `prepare` script ensures `dist/` is built before `npx` looks up
the `bin` entry, so a single `npm install` is enough.

To rebuild after editing sources: `npm run build`.

## Configuration

The server reads configuration from environment variables or CLI flags.

| Setting | Env var | CLI flag | Default |
|---|---|---|---|
| Base URL of the BugSense app | `BUGSENSE_BASE_URL` | `--base-url=<url>` | `http://localhost:3000` |
| API key | `BUGSENSE_API_KEY` | `--api-key=<key>` | (none) |
| Transport | `BUGSENSE_MCP_TRANSPORT` | `--transport=<stdio\|http>` | `stdio` |
| HTTP port (when transport=http) | `BUGSENSE_MCP_PORT` | `--port=<n>` | `8765` |

The API key is sent as `Authorization: Bearer <key>` on every request.

> **v1 limitation:** the BugSense REST API currently authenticates via
> NextAuth session cookies. Bearer-token support is on the roadmap. Until it
> lands, run the MCP server against an environment where the API trusts
> requests (e.g. a local dev server with auth disabled) or wait for the
> API-key middleware.

## Client setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "bugsense": {
      "command": "npx",
      "args": ["-y", "/absolute/path/to/bugsense-ai/packages/mcp-server"],
      "env": {
        "BUGSENSE_BASE_URL": "http://localhost:3000",
        "BUGSENSE_API_KEY": "your-api-key"
      }
    }
  }
}
```

Restart Claude Desktop. The tools appear under the BugSense server in the
chat composer.

### Cursor

In `~/.cursor/mcp.json` (or your project's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "bugsense": {
      "command": "npx",
      "args": ["-y", "/absolute/path/to/bugsense-ai/packages/mcp-server"],
      "env": {
        "BUGSENSE_BASE_URL": "http://localhost:3000",
        "BUGSENSE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add bugsense \
  --command "npx" \
  --args "-y" "/absolute/path/to/bugsense-ai/packages/mcp-server" \
  --env BUGSENSE_BASE_URL=http://localhost:3000 \
  --env BUGSENSE_API_KEY=your-api-key
```

Or edit `.mcp.json` in your project directly with the same shape as the
Claude Desktop config.

### Windsurf

Windsurf's `~/.codeium/windsurf/mcp_config.json` uses the same shape as
Claude Desktop's config. Drop the `bugsense` entry in there.

## Tools

All tool inputs are validated with [zod](https://zod.dev). Outputs are
JSON, returned both as text content and as `structuredContent` for clients
that support typed results.

### `list_bugs`

List bug reports, optionally filtered.

| Input | Type | Notes |
|---|---|---|
| `project_id` | string? | Filter to one project. |
| `severity` | `CRITICAL\|HIGH\|MEDIUM\|LOW\|INFO`? | |
| `status` | `OPEN\|IN_PROGRESS\|RESOLVED\|CLOSED\|DUPLICATE`? | |
| `search` | string? | Substring match in title/description. |
| `limit` | int? (1-200) | Truncate after server returns. |

Output: `{ bugs: Bug[], total: number }` — each `Bug` includes `id`, `title`,
`severity`, `priority`, `status`, `stepsToReproduce`, `qualityScore`,
`testCases`, and timestamps.

Example agent prompt: *"List the open critical bugs for project `abc123`."*

### `get_bug`

Fetch a single bug by id.

| Input | Type | Notes |
|---|---|---|
| `bug_id` | string | Required. |

Output: a `Bug` object (same shape as inside `list_bugs`).

Example agent prompt: *"Pull bug `bug-xyz` and write a regression test for it."*

### `list_test_cases`

List test cases for a project.

| Input | Type | Notes |
|---|---|---|
| `project_id` | string | Required. |
| `limit` | int? (1-500, default 50) | |

Output: `{ testCases: TestCase[], total: number }`. Each `TestCase` has
`title`, `steps[]`, `expectedResult`, `priority`, `framework`, `codeSnippet`.

### `get_release_readiness`

Compute the 0-100 release readiness score for a project.

| Input | Type | Notes |
|---|---|---|
| `project_id` | string | Required. |

Output:

```json
{
  "score": 87,
  "verdict": "GO",
  "breakdown": [
    { "key": "bugs", "label": "Open bugs", "weight": 0.5, "raw": 94, "weightedContribution": 47, "maxContribution": 50 },
    { "key": "tests", "label": "Test pass rate", "weight": 0.3, "raw": 80, "weightedContribution": 24, "maxContribution": 30, "note": "No test run data yet — using neutral default" },
    { "key": "quality", "label": "AI quality score", "weight": 0.2, "raw": 78, "weightedContribution": 16, "maxContribution": 20 }
  ],
  "blockers": []
}
```

Example agent prompt: *"Is project `abc123` safe to release? Show the
breakdown."*

### `analyze_bug_text`

Run BugSense's full AI bug analysis pipeline on a raw description.

| Input | Type | Notes |
|---|---|---|
| `raw_input` | string (1-20000) | Required. |
| `log_content` | string? (≤50000) | Optional log dump. |
| `project_id` | string? | If set, the analysed bug is persisted to the project. |

Output: `{ bugReport, qualityScore, duplicates, testCases, reproductionChecklist }`.

Example agent prompt: *"Analyze this stack trace and propose a fix."*

## Manual sanity check

```bash
# from packages/mcp-server, after `npm install`:
node dist/index.js --transport=stdio --base-url=http://localhost:3000
# the server reads MCP JSON-RPC messages on stdin; ^C to exit
```

Or with HTTP:

```bash
node dist/index.js --transport=http --port=8765 --base-url=http://localhost:3000
curl -sS -X POST http://localhost:8765 \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## License

MIT
