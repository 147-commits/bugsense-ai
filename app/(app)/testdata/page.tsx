'use client';

import { Database } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';

export default function TestDataPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Test Data Generator" subtitle="Generate realistic test data for any scenario" />
      <GeneratorPage
        title="Generate Test Data"
        subtitle="Describe what data you need"
        icon={<Database className="w-5 h-5 text-accent-violet" />}
        placeholder="User registration form with:
- Full name (2-50 characters)
- Email address (unique, valid format)
- Password (8+ chars, 1 uppercase, 1 number, 1 special)
- Phone number (US format)
- Date of birth (must be 18+)
- Address (street, city, state, zip)
- Role: admin, editor, or viewer"
        apiEndpoint="/api/testdata"
        buildPayload={(input, options) => ({ scenario: input, options })}
        generatorOptions={[
          { id: 'count', label: 'Number of records', type: 'number', defaultValue: 10 },
          { id: 'format', label: 'Output Format', type: 'select', defaultValue: 'json', options: [
            { value: 'json', label: 'JSON' },
            { value: 'csv', label: 'CSV' },
            { value: 'sql', label: 'SQL INSERT' },
            { value: 'typescript', label: 'TypeScript Array' },
          ]},
          { id: 'includeEdgeCases', label: 'Include edge cases', type: 'toggle', defaultValue: true },
          { id: 'locale', label: 'Locale', type: 'select', defaultValue: 'en-US', options: [
            { value: 'en-US', label: 'English (US)' },
            { value: 'en-GB', label: 'English (UK)' },
            { value: 'fr-FR', label: 'French' },
            { value: 'de-DE', label: 'German' },
            { value: 'ja-JP', label: 'Japanese' },
            { value: 'zh-CN', label: 'Chinese' },
          ]},
        ]}
        exampleInputs={[
          { label: 'User Registration', value: 'User registration: name (2-50 chars), email (unique), password (8+ chars, complexity), phone (US), DOB (18+), address, role (admin/editor/viewer)' },
          { label: 'E-commerce Orders', value: 'E-commerce orders: order_id, customer_name, email, items array [{product_name, quantity (1-99), price ($0.01-$9999.99)}], shipping_address, payment_method (credit/debit/paypal), order_status (pending/shipped/delivered/cancelled), created_at' },
          { label: 'API Payloads', value: 'REST API payloads for a blog system: POST /posts with title (5-200 chars), body (markdown, 100-5000 chars), author_id (UUID), tags (1-5 strings), published (boolean), scheduled_at (optional ISO date)' },
        ]}
        renderResult={(result) => {
          const schema = result.schema as Record<string, unknown>;
          const validData = result.validData as Array<Record<string, unknown>>;
          const edgeCaseData = result.edgeCaseData as Array<Record<string, unknown>>;
          const invalidData = result.invalidData as Array<Record<string, unknown>>;
          const formatted = result.formattedOutput as string;

          return (
            <div className="space-y-4">
              <div className="glass-panel p-4">
                <h4 className="text-sm font-semibold text-text-primary mb-1">{result.scenario as string}</h4>
                <p className="text-xs text-text-muted">{result.totalRecords as number} records generated</p>
              </div>

              {/* Schema */}
              {Array.isArray(schema?.fields) && (
                <div className="glass-panel p-4">
                  <span className="text-xs font-semibold text-text-secondary mb-2 block">Schema</span>
                  <div className="space-y-1">
                    {(schema.fields as Array<Record<string, string>>).map((f, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="font-mono text-accent-blue w-24">{f.name}</span>
                        <span className="text-accent-violet bg-accent-violet/10 px-1.5 py-0.5 rounded">{f.type}</span>
                        <span className="text-text-muted">{f.constraints}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid Data */}
              {validData?.length > 0 && (
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-accent-emerald" />
                    <span className="text-xs font-semibold text-text-secondary">Valid Data ({validData.length} records)</span>
                  </div>
                  <CodeBlock code={JSON.stringify(validData.slice(0, 5), null, 2)} filename="valid-data.json" language="json" />
                </div>
              )}

              {/* Edge Cases */}
              {edgeCaseData?.length > 0 && (
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-accent-amber" />
                    <span className="text-xs font-semibold text-text-secondary">Edge Cases ({edgeCaseData.length} records)</span>
                  </div>
                  <CodeBlock code={JSON.stringify(edgeCaseData, null, 2)} filename="edge-cases.json" language="json" />
                </div>
              )}

              {/* Invalid Data */}
              {invalidData?.length > 0 && (
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-accent-coral" />
                    <span className="text-xs font-semibold text-text-secondary">Invalid Data ({invalidData.length} records)</span>
                  </div>
                  <CodeBlock code={JSON.stringify(invalidData, null, 2)} filename="invalid-data.json" language="json" />
                </div>
              )}

              {/* Formatted Output */}
              {formatted && formatted.length > 5 && (
                <CodeBlock code={formatted} filename={`output.${(result as Record<string, unknown>).format || 'json'}`} language={(result as Record<string, unknown>).format as string || 'json'} />
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
