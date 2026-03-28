'use client';

import { Database, Download, ShieldCheck } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, { label: string; color: string }> = {
  unicode:          { label: 'Unicode',    color: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20' },
  injection:        { label: 'Injection',  color: 'bg-accent-coral/10 text-accent-coral border-accent-coral/20' },
  boundary:         { label: 'Boundary',   color: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20' },
  state:            { label: 'State',      color: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20' },
  missing_required: { label: 'Missing',    color: 'bg-accent-coral/10 text-accent-coral border-accent-coral/20' },
  wrong_type:       { label: 'Type Error', color: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20' },
  out_of_range:     { label: 'Range',      color: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20' },
  format:           { label: 'Format',     color: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20' },
};

export default function TestDataPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="Test Data Generator" subtitle="Enterprise TDM — BVA, equivalence partitions, data masking" />
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
            { value: 'typescript', label: 'TypeScript Constants' },
          ]},
          { id: 'includeEdgeCases', label: 'Include edge cases', type: 'toggle', defaultValue: true },
          { id: 'locale', label: 'Locale', type: 'select', defaultValue: 'en-US', options: [
            { value: 'en-US', label: 'English (US)' },
            { value: 'en-GB', label: 'English (UK)' },
            { value: 'fr-FR', label: 'French' },
            { value: 'de-DE', label: 'German' },
            { value: 'ja-JP', label: 'Japanese' },
            { value: 'zh-CN', label: 'Chinese' },
            { value: 'pt-BR', label: 'Portuguese (BR)' },
            { value: 'ar-SA', label: 'Arabic' },
          ]},
        ]}
        exampleInputs={[
          { label: 'User Registration', value: 'User registration: name (2-50 chars), email (unique, RFC 5322), password (8+ chars, 1 uppercase, 1 number, 1 special), age (18-120), phone (US format), role (admin/editor/viewer)' },
          { label: 'E-commerce Orders', value: 'E-commerce orders: order_id (UUID), customer_id (FK → users), items array [{product_id, quantity (1-99), unit_price ($0.01-$9999.99)}], shipping_address, payment_method (credit/debit/paypal), order_total (sum of items), order_status (pending/shipped/delivered/cancelled), created_at, updated_at' },
          { label: 'API Payloads', value: 'REST API payloads for a blog system: POST /posts with title (5-200 chars), body (markdown, 100-5000 chars), author_id (UUID), tags (1-5 strings, each 2-30 chars), published (boolean), scheduled_at (optional ISO 8601 date, must be future)' },
        ]}
        renderResult={(result) => <TestDataResult result={result} />}
      />
    </div>
  );
}

function TestDataResult({ result }: { result: Record<string, unknown> }) {
  const schema = result.schema as Record<string, unknown> | undefined;
  const validData = result.validData as Array<Record<string, unknown>> | undefined;
  const bvaTable = result.bvaTable as Array<Record<string, unknown>> | undefined;
  const eqPartitions = result.equivalencePartitions as Array<Record<string, unknown>> | undefined;
  const edgeCaseData = result.edgeCaseData as Array<Record<string, unknown>> | undefined;
  const invalidData = result.invalidData as Array<Record<string, unknown>> | undefined;
  const dataMasking = result.dataMasking as Array<Record<string, string>> | undefined;
  const formatted = result.formattedOutput as string | undefined;

  const formatExt: Record<string, string> = { json: 'json', csv: 'csv', sql: 'sql', typescript: 'ts' };
  const fmt = (result.format as string) || 'json';

  function downloadFormatted() {
    if (!formatted) return;
    const blob = new Blob([formatted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `test-data.${formatExt[fmt] || 'json'}`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-panel p-5">
        <h4 className="text-sm font-semibold text-text-primary mb-1">{result.scenario as string}</h4>
        <p className="text-xs text-text-muted">{result.totalRecords as number} total records generated</p>
        {formatted && formatted.length > 5 && (
          <button onClick={downloadFormatted} className="btn-secondary text-xs mt-3">
            <Download className="w-3.5 h-3.5" /> Download {fmt.toUpperCase()}
          </button>
        )}
      </div>

      {/* Schema */}
      {Array.isArray(schema?.fields) && (
        <div className="glass-panel p-5">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-2">Schema</span>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Field</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Type</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Constraints</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">PII</th>
                </tr>
              </thead>
              <tbody>
                {(schema.fields as Array<Record<string, string>>).map((f, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-mono text-accent-blue">{f.name}</td>
                    <td className="py-1.5 px-2"><span className="px-1.5 py-0.5 rounded bg-accent-violet/10 text-accent-violet">{f.type}</span></td>
                    <td className="py-1.5 px-2 text-text-secondary">{f.constraints}</td>
                    <td className="py-1.5 px-2">
                      {f.piiClassification ? (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                          f.piiClassification === 'PII' ? 'bg-accent-coral/10 text-accent-coral' :
                          f.piiClassification === 'Sensitive' ? 'bg-accent-amber/10 text-accent-amber' :
                          'bg-bg-tertiary text-text-muted'
                        )}>{f.piiClassification}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Valid Data */}
      {validData && validData.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-accent-emerald" />
            <span className="text-xs font-semibold text-text-secondary">Valid Data ({validData.length} records)</span>
          </div>
          <CodeBlock code={JSON.stringify(validData.slice(0, 5), null, 2)} filename="valid-data.json" language="json" />
          {validData.length > 5 && <p className="text-[10px] text-text-muted mt-1">Showing first 5 of {validData.length} records</p>}
        </div>
      )}

      {/* BVA Table */}
      {bvaTable && bvaTable.length > 0 && (
        <div className="glass-panel p-5">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-3">Boundary Value Analysis</span>
          {bvaTable.map((row, i) => (
            <div key={i} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-accent-blue font-medium">{row.field as string}</span>
                <span className="text-[10px] text-text-muted">({row.constraint as string})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-2 text-text-muted font-medium">Boundary</th>
                      <th className="text-left py-1.5 px-2 text-text-muted font-medium">Value</th>
                      <th className="text-left py-1.5 px-2 text-text-muted font-medium">Expected</th>
                      <th className="text-left py-1.5 px-2 text-text-muted font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['min_minus_1', 'min', 'min_plus_1', 'nominal', 'max_minus_1', 'max', 'max_plus_1'].map((boundary) => {
                      const cell = row[boundary] as Record<string, string> | undefined;
                      if (!cell) return null;
                      const isFail = cell.expected === 'FAIL';
                      return (
                        <tr key={boundary} className="border-b border-border/50">
                          <td className="py-1.5 px-2 text-text-secondary font-mono">{boundary.replace(/_/g, ' ')}</td>
                          <td className="py-1.5 px-2 text-text-primary font-mono max-w-[200px] truncate">{String(cell.value).length > 30 ? String(cell.value).slice(0, 30) + '…' : String(cell.value)}</td>
                          <td className="py-1.5 px-2">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold',
                              isFail ? 'bg-accent-coral/15 text-accent-coral' : 'bg-accent-emerald/15 text-accent-emerald'
                            )}>{cell.expected}</span>
                          </td>
                          <td className="py-1.5 px-2 text-text-muted">{cell.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Equivalence Partitions */}
      {eqPartitions && eqPartitions.length > 0 && (
        <div className="glass-panel p-5">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-3">Equivalence Partitions</span>
          {eqPartitions.map((ep, i) => (
            <div key={i} className="mb-4 last:mb-0">
              <span className="text-xs font-mono text-accent-blue font-medium block mb-2">{ep.field as string}</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-medium text-accent-emerald block mb-1">Valid Classes</span>
                  {(ep.validClasses as Array<Record<string, string>>)?.map((vc, j) => (
                    <div key={j} className="flex items-start gap-2 p-1.5 rounded bg-accent-emerald/5 mb-1">
                      <span className="text-[10px] text-text-secondary">{vc.class}:</span>
                      <span className="text-[10px] font-mono text-text-primary">{vc.representative}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <span className="text-[10px] font-medium text-accent-coral block mb-1">Invalid Classes</span>
                  {(ep.invalidClasses as Array<Record<string, string>>)?.map((ic, j) => (
                    <div key={j} className="p-1.5 rounded bg-accent-coral/5 mb-1">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-text-secondary">{ic.class}:</span>
                        <span className="text-[10px] font-mono text-text-primary">{ic.representative}</span>
                      </div>
                      <span className="text-[10px] text-accent-coral">→ {ic.expectedError}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edge Cases */}
      {edgeCaseData && edgeCaseData.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-accent-amber" />
            <span className="text-xs font-semibold text-text-secondary">Edge Cases ({edgeCaseData.length} records)</span>
          </div>
          <div className="space-y-2">
            {edgeCaseData.map((ec, i) => {
              const cat = CATEGORY_COLORS[ec._category as string] ?? { label: ec._category as string || 'Edge', color: 'bg-bg-tertiary text-text-muted border-border' };
              return (
                <div key={i} className="p-3 rounded-lg bg-bg-tertiary border border-border">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border font-medium', cat.color)}>{cat.label}</span>
                    <span className="text-xs text-text-muted">{ec._note as string}</span>
                  </div>
                  <pre className="text-[10px] text-text-secondary font-mono whitespace-pre-wrap">
                    {JSON.stringify(Object.fromEntries(Object.entries(ec).filter(([k]) => !k.startsWith('_'))), null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invalid Data */}
      {invalidData && invalidData.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-accent-coral" />
            <span className="text-xs font-semibold text-text-secondary">Invalid Data ({invalidData.length} records)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Category</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Issue</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Expected Error</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {invalidData.map((inv, i) => {
                  const cat = CATEGORY_COLORS[inv._category as string] ?? { label: 'Invalid', color: 'bg-bg-tertiary text-text-muted border-border' };
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 px-2">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border font-medium', cat.color)}>{cat.label}</span>
                      </td>
                      <td className="py-1.5 px-2 text-text-secondary">{inv._note as string}</td>
                      <td className="py-1.5 px-2 text-accent-coral font-mono">{inv._expectedError as string}</td>
                      <td className="py-1.5 px-2 text-text-muted font-mono max-w-[200px] truncate">
                        {JSON.stringify(Object.fromEntries(Object.entries(inv).filter(([k]) => !k.startsWith('_'))))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Masking Guidance */}
      {dataMasking && dataMasking.length > 0 && (
        <div className="glass-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-accent-emerald" />
            <span className="text-xs font-semibold text-text-secondary">Data Masking Guidance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Field</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">PII Type</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Technique</th>
                  <th className="text-left py-1.5 px-2 text-text-muted font-medium">Example</th>
                </tr>
              </thead>
              <tbody>
                {dataMasking.map((dm, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-mono text-accent-blue">{dm.field}</td>
                    <td className="py-1.5 px-2 text-text-secondary">{dm.piiType}</td>
                    <td className="py-1.5 px-2"><span className="px-1.5 py-0.5 rounded bg-accent-emerald/10 text-accent-emerald text-[10px] font-medium">{dm.technique}</span></td>
                    <td className="py-1.5 px-2 text-text-muted">{dm.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formatted Output */}
      {formatted && formatted.length > 5 && (
        <CodeBlock code={formatted} filename={`test-data.${formatExt[fmt] || 'json'}`} language={fmt === 'typescript' ? 'typescript' : fmt === 'sql' ? 'sql' : 'json'} />
      )}
    </div>
  );
}
