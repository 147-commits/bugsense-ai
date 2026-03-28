'use client';

import { BookOpen } from 'lucide-react';
import TopBar from '@/components/layout/TopBar';
import GeneratorPage from '@/components/GeneratorPage';
import CodeBlock from '@/components/ui/CodeBlock';
import { cn } from '@/lib/utils';

export default function QADocsPage() {
  return (
    <div className="min-h-screen">
      <TopBar title="QA Documentation" subtitle="Generate professional QA documents instantly" />
      <GeneratorPage
        title="Generate QA Document"
        subtitle="Describe your project and choose a document type"
        icon={<BookOpen className="w-5 h-5 text-accent-amber" />}
        placeholder="Project: E-commerce Platform v3.0
Modules: User Auth, Product Catalog, Shopping Cart, Checkout, Payment, Order Management, Admin Panel
Team: 4 developers, 2 QA engineers, 1 QA lead
Timeline: 3 months (6 sprints)
Tech Stack: React, Node.js, PostgreSQL, Stripe API, Redis
Key risks: Payment integration with new provider, migration from v2 user data
Testing tools: Playwright for E2E, Jest for unit, Postman for API
Environments: Dev, Staging, UAT, Production"
        apiEndpoint="/api/qadocs"
        buildPayload={(input, options) => ({ input, docType: options.docType || 'test_strategy' })}
        generatorOptions={[
          { id: 'docType', label: 'Document Type', type: 'select', defaultValue: 'test_strategy', options: [
            { value: 'test_strategy', label: 'Test Strategy Document' },
            { value: 'test_summary', label: 'Test Summary Report' },
            { value: 'traceability_matrix', label: 'Traceability Matrix (RTM)' },
            { value: 'test_closure', label: 'Test Closure Report' },
            { value: 'defect_report', label: 'Defect Analysis Report' },
            { value: 'test_environment', label: 'Test Environment Setup' },
            { value: 'qa_checklist', label: 'QA Process Checklist' },
            { value: 'test_execution_report', label: 'Test Execution Report' },
            { value: 'uat_signoff', label: 'UAT Sign-off Document' },
            { value: 'risk_assessment', label: 'Risk Assessment Matrix' },
          ]},
        ]}
        exampleInputs={[
          { label: 'E-commerce Platform', value: 'Project: E-commerce Platform v3.0\nModules: Auth, Catalog, Cart, Checkout, Payment, Orders, Admin\nTeam: 4 devs, 2 QA, 1 lead\nTimeline: 3 months\nStack: React, Node.js, PostgreSQL, Stripe\nRisks: New payment provider, v2 data migration' },
          { label: 'Mobile Banking App', value: 'Project: Mobile Banking App v2.0\nModules: Login/Biometrics, Accounts, Transfers, Bill Pay, Notifications, Settings\nCompliance: PCI-DSS, SOX\nTeam: 6 devs, 3 QA\nStack: React Native, Java microservices, Oracle DB\nRisks: Regulatory compliance, biometric auth on older devices' },
          { label: 'Sprint Summary', value: 'Sprint 24 completed. 12 user stories tested. 8 passed, 3 passed with minor issues, 1 failed. 14 bugs found (2 critical, 4 high, 5 medium, 3 low). 2 critical bugs fixed and retested. Test environment: staging.app.com. Blockers: Payment gateway sandbox was down for 2 days.' },
        ]}
        renderResult={(result) => {
          const doc = result.document as Record<string, string>;
          const sections = (result.sections || []) as Array<Record<string, unknown>>;
          const tables = (result.tables || []) as Array<Record<string, unknown>>;
          const markdown = result.markdownOutput as string;

          return (
            <div className="space-y-4">
              {/* Doc Header */}
              {doc && (
                <div className="glass-panel p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-bold text-text-primary">{doc.title}</h3>
                      <p className="text-xs text-text-secondary mt-0.5">{result.summary as string}</p>
                    </div>
                    <span className="badge bg-accent-amber/15 text-accent-amber border-accent-amber/20">{doc.status}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-text-muted">
                    <span>v{doc.version}</span>
                    <span>{doc.date}</span>
                    <span>{doc.author}</span>
                    <span className="capitalize">{doc.type?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              )}

              {/* Sections */}
              {sections.map((section, i) => (
                <div key={i} className="glass-panel p-5">
                  <h4 className="text-sm font-semibold text-text-primary mb-2">{section.heading as string}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{section.content as string}</p>
                  {(section.subsections as Array<Record<string, string>>)?.map((sub, j) => (
                    <div key={j} className="mt-3 ml-4 pl-3 border-l-2 border-border">
                      <h5 className="text-xs font-semibold text-text-primary mb-1">{sub.heading}</h5>
                      <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{sub.content}</p>
                    </div>
                  ))}
                </div>
              ))}

              {/* Tables */}
              {tables.map((table, i) => (
                <div key={i} className="glass-panel p-5 overflow-x-auto">
                  <h4 className="text-sm font-semibold text-text-primary mb-3">{table.title as string}</h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {(table.headers as string[])?.map((h, j) => (
                          <th key={j} className="text-left py-2 px-3 text-text-muted font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(table.rows as string[][])?.map((row, j) => (
                        <tr key={j} className="border-b border-border/50 hover:bg-bg-tertiary/50">
                          {row.map((cell, k) => (
                            <td key={k} className="py-2 px-3 text-text-secondary">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Full Markdown */}
              {markdown && <CodeBlock code={markdown} filename="QA_DOCUMENT.md" language="markdown" />}
            </div>
          );
        }}
      />
    </div>
  );
}
