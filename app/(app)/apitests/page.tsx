'use client';

import { Globe } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

export default function APITestsPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="API Test Generator" subtitle="Generate API test scripts from endpoint descriptions" />
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
          { label: 'Login Endpoint', value: 'POST /api/auth/login\nRequest: { email: string, password: string }\nResponse 200: { token, user: { id, name, email } }\nResponse 401: { error: "Invalid credentials" }\nRate limit: 5/min per IP' },
          { label: 'CRUD Users', value: 'GET /api/users - List all users (paginated, query params: page, limit, search)\nGET /api/users/:id - Get user by ID\nPOST /api/users - Create user { name, email, role }\nPUT /api/users/:id - Update user\nDELETE /api/users/:id - Delete user\nAuth: Bearer token required' },
          { label: 'File Upload', value: 'POST /api/upload\nContent-Type: multipart/form-data\nField: file (max 10MB, accepts: jpg, png, pdf)\nResponse 200: { url, filename, size }\nResponse 413: File too large\nResponse 415: Unsupported file type' },
        ]}
        renderResult={(result) => {
          const endpoint = result.endpoint as Record<string, string>;
          const scripts = (result.testScripts || []) as Array<Record<string, string>>;
          const setup = result.setupCode as string;
          const envVars = result.envVariables as Record<string, string>;

          return (
            <div className="space-y-4">
              {endpoint && (
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-accent-emerald/15 text-accent-emerald border-accent-emerald/20 font-mono">{endpoint.method}</span>
                    <span className="text-sm font-mono text-text-primary">{endpoint.path}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{endpoint.description}</p>
                  <p className="text-xs text-text-muted mt-1">{result.totalTests as number} test scripts generated</p>

                  {/* Download buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        const allCode = scripts.map(s => `// ${s.name}\n// ${s.description}\n${s.code}`).join('\n\n// ─────────────────────────────\n\n');
                        const blob = new Blob([allCode], { type: 'text/typescript' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `api-tests-${Date.now()}.ts`; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="btn-secondary text-xs flex-1"
                    >
                      📁 Download as .ts file
                    </button>
                    <button
                      onClick={() => {
                        // Create Postman collection format
                        const collection = {
                          info: { name: `API Tests - ${endpoint.path}`, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
                          item: scripts.map(s => ({
                            name: s.name,
                            request: { method: endpoint.method, url: `{{BASE_URL}}${endpoint.path}`, header: [{ key: "Content-Type", value: "application/json" }] },
                            event: [{ listen: "test", script: { exec: [s.code] } }]
                          }))
                        };
                        const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `postman-collection-${Date.now()}.json`; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="btn-secondary text-xs flex-1"
                    >
                      📮 Download Postman Collection
                    </button>
                  </div>
                </div>
              )}
              {envVars && Object.keys(envVars).length > 0 && (
                <div className="glass-panel p-4">
                  <span className="text-xs font-semibold text-text-secondary">Environment Variables</span>
                  <div className="mt-2 space-y-1">
                    {Object.entries(envVars).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-accent-amber">{k}</span><span className="text-text-muted">=</span><span className="text-text-secondary">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {setup && <CodeBlock code={setup} filename="setup.ts" language="typescript" />}
              {scripts.map((script, i) => {
                const catColors: Record<string, string> = {
                  happy_path: 'text-accent-emerald', auth: 'text-accent-violet', validation: 'text-accent-amber', error: 'text-accent-coral', edge_case: 'text-accent-cyan',
                };
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium', catColors[script.category] || 'text-text-muted')}>{script.category?.replace('_', ' ')}</span>
                      <span className="text-xs text-text-muted">—</span>
                      <span className="text-xs text-text-primary font-medium">{script.name}</span>
                    </div>
                    <CodeBlock code={script.code} filename={`test-${i + 1}.ts`} language="typescript" />
                  </div>
                );
              })}
            </div>
          );
        }}
      />
    </div>
  );
}
