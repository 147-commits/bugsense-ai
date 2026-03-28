'use client';

import { useState } from 'react';
import { Globe, Download, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

const CAT_META: Record<string, { label: string; color: string; bgColor: string }> = {
  happy_path:   { label: 'Happy Path',    color: 'text-accent-emerald', bgColor: 'bg-accent-emerald/10 border-accent-emerald/20' },
  auth:         { label: 'Auth',          color: 'text-accent-violet',  bgColor: 'bg-accent-violet/10 border-accent-violet/20' },
  authorization:{ label: 'Authorization', color: 'text-accent-violet',  bgColor: 'bg-accent-violet/10 border-accent-violet/20' },
  validation:   { label: 'Validation',    color: 'text-accent-amber',   bgColor: 'bg-accent-amber/10 border-accent-amber/20' },
  not_found:    { label: 'Not Found',     color: 'text-accent-coral',   bgColor: 'bg-accent-coral/10 border-accent-coral/20' },
  error:        { label: 'Error',         color: 'text-accent-coral',   bgColor: 'bg-accent-coral/10 border-accent-coral/20' },
  edge_case:    { label: 'Edge Case',     color: 'text-accent-cyan',    bgColor: 'bg-accent-cyan/10 border-accent-cyan/20' },
  idempotency:  { label: 'Idempotency',   color: 'text-accent-blue',    bgColor: 'bg-accent-blue/10 border-accent-blue/20' },
  rate_limit:   { label: 'Rate Limit',    color: 'text-accent-amber',   bgColor: 'bg-accent-amber/10 border-accent-amber/20' },
};

export default function APITestsPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="API Test Generator" subtitle="Enterprise-grade API test suites" />
      <GeneratorPage
        title="Generate API Tests"
        subtitle="Describe your API endpoint"
        icon={<Globe className="w-5 h-5 text-accent-emerald" />}
        placeholder="POST /api/auth/login

Request body: { email: string, password: string }
Response 200: { token: string, user: { id, name, email } }
Response 401: { error: 'Invalid credentials' }
Response 400: { error: 'Email and password required' }

Authentication: None (this is the login endpoint)
Rate limit: 5 attempts per minute per IP"
        apiEndpoint="/api/apitests"
        buildPayload={(input, options) => ({ apiDescription: input, format: options.format || 'playwright' })}
        generatorOptions={[
          { id: 'format', label: 'Output Format', type: 'select', defaultValue: 'playwright', options: [
            { value: 'playwright', label: 'Playwright (TypeScript)' },
            { value: 'cypress', label: 'Cypress' },
            { value: 'jest', label: 'Jest + Supertest' },
            { value: 'curl', label: 'cURL Commands' },
            { value: 'postman', label: 'Postman Collection' },
          ]},
        ]}
        exampleInputs={[
          { label: 'Login Endpoint', value: 'POST /api/auth/login\n\nRequest: { email: string, password: string }\nResponse 200: { token: string, user: { id, name, email } }\nResponse 401: { error: "Invalid credentials" }\nResponse 400: { error: "Email and password required" }\n\nAuthentication: None (this is the login endpoint)\nRate limit: 5 requests/min per IP' },
          { label: 'CRUD Users', value: 'GET /api/users - List all users (paginated: ?page=1&limit=20&search=)\nGET /api/users/:id - Get user by ID\nPOST /api/users - Create user { name: string, email: string, role: "admin"|"member" }\nPUT /api/users/:id - Update user (partial)\nDELETE /api/users/:id - Delete user (soft delete)\n\nAuth: Bearer token required for all endpoints\nRoles: admin can CRUD all, member can only read\nResponse format: { data, meta: { page, limit, total } }' },
          { label: 'File Upload', value: 'POST /api/upload\nContent-Type: multipart/form-data\nField: file (max 10MB, accepts: jpg, png, pdf)\nField: folder (optional, string)\n\nResponse 200: { url: string, filename: string, size: number, mimeType: string }\nResponse 413: { error: "File too large", maxSize: "10MB" }\nResponse 415: { error: "Unsupported file type", allowed: ["jpg","png","pdf"] }\nAuth: Bearer token required' },
        ]}
        renderResult={(result) => <APITestResult result={result} />}
      />
    </div>
  );
}

// ── Result Renderer ──────────────────────────────────────────────────────────

function APITestResult({ result }: { result: Record<string, unknown> }) {
  const endpoint = result.endpoint as Record<string, string> | undefined;
  const scripts = (result.testScripts || []) as Array<Record<string, unknown>>;
  const setup = result.setupCode as string | undefined;
  const teardown = result.teardownCode as string | undefined;
  const envVars = result.envVariables as Record<string, string> | undefined;
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Group by category
  const categories = Array.from(new Set(scripts.map((s) => s.category as string)));
  const filtered = filter === 'all' ? scripts : scripts.filter((s) => s.category === filter);

  function downloadTS() {
    const allCode = scripts.map(s => `// ── ${s.name} ──\n// ${s.description}\n${s.code}`).join('\n\n');
    const full = (setup ? `${setup}\n\n` : '') + allCode + (teardown ? `\n\n${teardown}` : '');
    const blob = new Blob([full], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `api-tests-${Date.now()}.ts`; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPostman() {
    const collection = {
      info: { name: `API Tests - ${endpoint?.path ?? 'endpoint'}`, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: categories.map((cat) => ({
        name: CAT_META[cat]?.label ?? cat,
        item: scripts.filter((s) => s.category === cat).map((s) => ({
          name: s.name as string,
          request: { method: endpoint?.method ?? 'GET', url: `{{BASE_URL}}${endpoint?.path ?? ''}`, header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Authorization', value: 'Bearer {{AUTH_TOKEN}}' }] },
          event: [{ listen: 'test', script: { exec: [(s.code as string).split('\n')] } }],
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `postman-collection-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Endpoint header */}
      {endpoint && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge bg-accent-emerald/15 text-accent-emerald border-accent-emerald/20 font-mono font-bold">{endpoint.method}</span>
            <span className="text-sm font-mono text-text-primary">{endpoint.path}</span>
          </div>
          <p className="text-xs text-text-secondary mb-1">{endpoint.description}</p>
          <div className="flex gap-4 text-[10px] text-text-muted">
            {endpoint.authentication && <span>Auth: {endpoint.authentication}</span>}
            {endpoint.rateLimit && <span>Rate limit: {endpoint.rateLimit}</span>}
            <span>{result.totalTests as number} tests generated</span>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={downloadTS} className="btn-secondary text-xs flex-1">
              <Download className="w-3.5 h-3.5" /> Download .ts
            </button>
            <button onClick={downloadPostman} className="btn-secondary text-xs flex-1">
              <Download className="w-3.5 h-3.5" /> Postman Collection
            </button>
          </div>
        </div>
      )}

      {/* Environment variables */}
      {envVars && Object.keys(envVars).length > 0 && (
        <div className="glass-panel p-4">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Environment Variables</span>
          <div className="mt-2 space-y-1">
            {Object.entries(envVars).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-accent-amber">{k}</span>
                <span className="text-text-muted">=</span>
                <span className="text-text-secondary truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup code */}
      {setup && setup.length > 10 && <CodeBlock code={setup} filename="setup.ts" language="typescript" />}

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            filter === 'all' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-bg-tertiary text-text-muted hover:text-text-secondary'
          )}
        >
          All ({scripts.length})
        </button>
        {categories.map((cat) => {
          const meta = CAT_META[cat] ?? { label: cat, color: 'text-text-muted', bgColor: 'bg-bg-tertiary border-border' };
          const count = scripts.filter((s) => s.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === cat ? `${meta.bgColor} ${meta.color}` : 'bg-bg-tertiary text-text-muted hover:text-text-secondary'
              )}
            >
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Test scripts */}
      {filtered.map((script, i) => {
        const globalIdx = scripts.indexOf(script);
        const isExpanded = expandedId === globalIdx;
        const meta = CAT_META[script.category as string] ?? { label: script.category as string, color: 'text-text-muted', bgColor: 'bg-bg-tertiary border-border' };
        const assertions = script.assertions as string[] | undefined;

        return (
          <div key={globalIdx} className="glass-panel overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : globalIdx)}
              className="w-full p-4 text-left hover:bg-bg-hover/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />}
                <span className={cn('text-[10px] px-2 py-0.5 rounded-md border font-medium', meta.bgColor, meta.color)}>
                  {meta.label}
                </span>
                <span className="text-sm font-medium text-text-primary truncate">{script.name as string}</span>
              </div>
              <p className="text-xs text-text-muted ml-8 line-clamp-1">{script.description as string}</p>

              {/* Assertion badges (compact) */}
              {assertions && !isExpanded && (
                <div className="flex flex-wrap gap-1 mt-2 ml-8">
                  {assertions.slice(0, 4).map((a, j) => (
                    <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border truncate max-w-[200px]">
                      {a}
                    </span>
                  ))}
                  {assertions.length > 4 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border">
                      +{assertions.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </button>

            {/* Expanded */}
            {isExpanded && (
              <div className="border-t border-border">
                {/* Description & Assertions */}
                <div className="px-5 py-3 bg-bg-tertiary/20 space-y-3">
                  <p className="text-xs text-text-secondary">{script.description as string}</p>

                  {assertions && assertions.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Assertion Layers</span>
                      <div className="mt-1.5 space-y-1">
                        {assertions.map((a, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-accent-emerald flex-shrink-0" />
                            <span className="text-xs text-text-secondary">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Code */}
                <div className="px-1">
                  <CodeBlock code={script.code as string} filename={`test-${globalIdx + 1}.ts`} language="typescript" />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Teardown */}
      {teardown && teardown.length > 10 && <CodeBlock code={teardown} filename="teardown.ts" language="typescript" />}
    </div>
  );
}
