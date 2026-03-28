'use client';

import { Code2, Terminal } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';

export default function AutomationPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Automation Scripts" subtitle="Generate ready-to-run test automation code" />
      <GeneratorPage
        title="Generate Automation Script"
        subtitle="Describe the test scenario to automate"
        icon={<Code2 className="w-5 h-5 text-accent-coral" />}
        placeholder="E-commerce checkout flow:
1. User logs in with email/password
2. Searches for a product by name
3. Adds the product to cart
4. Goes to cart and verifies item is there
5. Proceeds to checkout
6. Fills in shipping address
7. Selects payment method (credit card)
8. Enters card details
9. Places order
10. Verifies order confirmation page with order number
11. Checks that confirmation email is received"
        apiEndpoint="/api/automation"
        buildPayload={(input, options) => ({ scenario: input, framework: options.framework || 'playwright', options })}
        generatorOptions={[
          { id: 'framework', label: 'Framework', type: 'select', defaultValue: 'playwright', options: [
            { value: 'playwright', label: 'Playwright' },
            { value: 'cypress', label: 'Cypress' },
            { value: 'selenium-js', label: 'Selenium (JS)' },
            { value: 'puppeteer', label: 'Puppeteer' },
            { value: 'webdriverio', label: 'WebdriverIO' },
          ]},
          { id: 'language', label: 'Language', type: 'select', defaultValue: 'typescript', options: [
            { value: 'typescript', label: 'TypeScript' },
            { value: 'javascript', label: 'JavaScript' },
          ]},
          { id: 'includePageObject', label: 'Page Object Model', type: 'toggle', defaultValue: true },
          { id: 'includeHelpers', label: 'Helper utilities', type: 'toggle', defaultValue: true },
          { id: 'includeCIConfig', label: 'CI/CD config (GitHub Actions)', type: 'toggle', defaultValue: false },
        ]}
        exampleInputs={[
          { label: 'Login Flow', value: 'User login flow: Navigate to login page, enter valid email and password, click submit, verify redirect to dashboard, check user name displayed in header, verify auth token in cookies' },
          { label: 'Search & Filter', value: 'Product search and filtering: Go to products page, type search query, verify results update, apply price range filter, apply category filter, sort by price, verify correct ordering, clear all filters, verify reset' },
          { label: 'Form Validation', value: 'Registration form validation: Try submitting empty form (verify all required field errors), enter invalid email format (verify error), enter short password (verify strength error), enter mismatched passwords (verify error), fill all fields correctly (verify success)' },
        ]}
        renderResult={(result) => {
          const files = (result.files || []) as Array<Record<string, string>>;
          const pkg = result.packageJson as Record<string, Record<string, string>>;
          const instructions = (result.setupInstructions || []) as string[];
          const runCmd = result.runCommand as string;

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="glass-panel p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="badge bg-accent-coral/15 text-accent-coral border-accent-coral/20 font-mono">{result.framework as string}</span>
                  <span className="badge bg-bg-tertiary text-text-muted border-border font-mono">{result.language as string}</span>
                </div>
                <p className="text-xs text-text-muted">{files.length} files generated</p>

                {/* Download all files button */}
                <button
                  onClick={() => {
                    files.forEach((file: Record<string, string>) => {
                      const blob = new Blob([file.code], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = file.filename.split('/').pop() || 'test.ts';
                      a.click();
                      URL.revokeObjectURL(url);
                    });
                  }}
                  className="btn-primary text-xs mt-3 w-full"
                >
                  📁 Download All Files
                </button>
              </div>

              {/* Setup Instructions */}
              {instructions.length > 0 && (
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-4 h-4 text-accent-emerald" />
                    <span className="text-xs font-semibold text-text-secondary">Setup Instructions</span>
                  </div>
                  {instructions.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1">
                      <span className="text-xs font-mono text-accent-blue">{i + 1}.</span>
                      <code className="text-xs text-text-secondary font-mono">{step}</code>
                    </div>
                  ))}
                  {runCmd && (
                    <div className="mt-3 p-2 rounded-lg bg-bg-tertiary">
                      <span className="text-[10px] text-text-muted">Run tests:</span>
                      <code className="text-xs text-accent-emerald font-mono ml-2">{runCmd}</code>
                    </div>
                  )}
                </div>
              )}

              {/* Package.json */}
              {pkg && (
                <CodeBlock
                  code={JSON.stringify({ scripts: pkg.scripts, devDependencies: pkg.devDependencies }, null, 2)}
                  filename="package.json (add to yours)"
                  language="json"
                />
              )}

              {/* Generated Files */}
              {files.map((file, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs text-text-muted">{file.description}</p>
                  <CodeBlock code={file.code} filename={file.filename} language={result.language as string || 'typescript'} />
                </div>
              ))}
            </div>
          );
        }}
      />
    </div>
  );
}
