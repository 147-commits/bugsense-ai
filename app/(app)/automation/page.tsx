'use client';

import { Code2, Terminal, Download, FolderTree } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

const FILE_TYPE_META: Record<string, { label: string; color: string }> = {
  page_object: { label: 'Page Object', color: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20' },
  spec:        { label: 'Test Spec',   color: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20' },
  fixture:     { label: 'Fixture',     color: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20' },
  helper:      { label: 'Helper',      color: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20' },
  config:      { label: 'Config',      color: 'bg-bg-tertiary text-text-muted border-border' },
  ci:          { label: 'CI/CD',       color: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20' },
};

export default function AutomationPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Automation Scripts" subtitle="Enterprise Page Object Model projects" />
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
          { label: 'Login Flow', value: 'User login flow:\n1. Navigate to login page\n2. Enter valid email (qa.tester@company.com) and password\n3. Click submit\n4. Verify redirect to dashboard\n5. Check user name displayed in header\n6. Verify auth cookie is set\n\nAlso test:\n- Invalid credentials show error\n- Empty fields show validation\n- SQL injection in email is safe' },
          { label: 'Search & Filter', value: 'Product search and filtering:\n1. Go to /products page\n2. Type "laptop" in search field\n3. Verify results update (show only laptops)\n4. Apply price range filter ($500-$1500)\n5. Apply category filter "Electronics"\n6. Sort by price ascending\n7. Verify correct ordering\n8. Clear all filters\n9. Verify full product list restored' },
          { label: 'Form Validation', value: 'Registration form validation:\n1. Submit empty form → verify all required field errors\n2. Enter invalid email format → verify email error\n3. Enter password < 8 chars → verify strength error\n4. Enter mismatched passwords → verify match error\n5. Fill all fields correctly → verify success redirect\n6. Try registering with existing email → verify duplicate error' },
        ]}
        renderResult={(result) => {
          const files = (result.files || []) as Array<Record<string, string>>;
          const pkg = result.packageJson as Record<string, Record<string, string>> | undefined;
          const instructions = (result.setupInstructions || []) as string[];
          const runCmd = result.runCommand as string;
          const debugCmd = result.debugCommand as string | undefined;
          const structure = result.projectStructure as string | undefined;

          function downloadAll() {
            files.forEach((file) => {
              const blob = new Blob([file.code], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = file.filename.split('/').pop() || 'file.ts';
              a.click();
              URL.revokeObjectURL(url);
            });
          }

          // Group files by type
          const filesByType: Record<string, typeof files> = {};
          files.forEach((f) => {
            const type = f.fileType || 'spec';
            if (!filesByType[type]) filesByType[type] = [];
            filesByType[type].push(f);
          });

          return (
            <div className="space-y-4">
              {/* Header */}
              <div className="glass-panel p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="badge bg-accent-coral/15 text-accent-coral border-accent-coral/20 font-mono font-bold">{result.framework as string}</span>
                  <span className="badge bg-bg-tertiary text-text-muted border-border font-mono">{result.language as string}</span>
                  <span className="text-xs text-text-muted">{files.length} files generated</span>
                </div>

                {/* File type summary */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(filesByType).map(([type, typeFiles]) => {
                    const meta = FILE_TYPE_META[type] ?? { label: type, color: 'bg-bg-tertiary text-text-muted border-border' };
                    return (
                      <span key={type} className={cn('text-[10px] px-2 py-0.5 rounded-md border font-medium', meta.color)}>
                        {meta.label} ({typeFiles.length})
                      </span>
                    );
                  })}
                </div>

                <button onClick={downloadAll} className="btn-primary text-xs w-full">
                  <Download className="w-3.5 h-3.5" /> Download All Files
                </button>
              </div>

              {/* Project Structure */}
              {structure && (
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderTree className="w-4 h-4 text-accent-blue" />
                    <span className="text-xs font-semibold text-text-secondary">Project Structure</span>
                  </div>
                  <pre className="text-xs text-text-muted font-mono whitespace-pre leading-relaxed">{structure}</pre>
                </div>
              )}

              {/* Setup Instructions */}
              {instructions.length > 0 && (
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-4 h-4 text-accent-emerald" />
                    <span className="text-xs font-semibold text-text-secondary">Setup & Run</span>
                  </div>
                  {instructions.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 mb-1">
                      <span className="text-xs font-mono text-accent-blue flex-shrink-0">{i + 1}.</span>
                      <code className="text-xs text-text-secondary font-mono">{step}</code>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-3">
                    {runCmd && (
                      <div className="flex-1 p-2 rounded-lg bg-bg-tertiary">
                        <span className="text-[10px] text-text-muted">Run tests:</span>
                        <code className="text-xs text-accent-emerald font-mono ml-2">{runCmd}</code>
                      </div>
                    )}
                    {debugCmd && (
                      <div className="flex-1 p-2 rounded-lg bg-bg-tertiary">
                        <span className="text-[10px] text-text-muted">Debug:</span>
                        <code className="text-xs text-accent-amber font-mono ml-2">{debugCmd}</code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Package.json */}
              {pkg && (
                <CodeBlock
                  code={JSON.stringify({ scripts: pkg.scripts, devDependencies: pkg.devDependencies }, null, 2)}
                  filename="package.json (merge into yours)"
                  language="json"
                />
              )}

              {/* Generated Files — grouped by type */}
              {Object.entries(filesByType).map(([type, typeFiles]) => {
                const meta = FILE_TYPE_META[type] ?? { label: type, color: 'bg-bg-tertiary text-text-muted border-border' };
                return (
                  <div key={type} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-md border font-medium', meta.color)}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-text-muted">{typeFiles.length} file{typeFiles.length > 1 ? 's' : ''}</span>
                    </div>
                    {typeFiles.map((file, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs text-text-muted">{file.description}</p>
                        <CodeBlock code={file.code} filename={file.filename} language={result.language as string || 'typescript'} />
                      </div>
                    ))}
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
