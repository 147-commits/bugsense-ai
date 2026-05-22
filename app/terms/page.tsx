import Link from 'next/link';

// TODO(legal): replace with real terms of service copy from counsel before launch.
// The copy below is placeholder structure only and must NOT ship to production
// without legal review.
export default function TermsPage() {
  return (
    <article className="min-h-screen bg-bg-primary text-text-primary px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs text-text-muted mb-2">
          <Link href="/" className="hover:text-text-secondary">← Home</Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Terms of service</h1>
        <p className="text-xs text-text-muted mb-10">
          Last updated: placeholder. Replace before launch.
        </p>

        <Section title="What this is">
          Placeholder. This page exists so the marketing footer can link
          somewhere legitimate; the actual terms must be drafted by counsel
          before we onboard paying customers.
        </Section>

        <Section title="Use of the service">
          Placeholder. Will describe acceptable use, account responsibilities,
          and prohibited content.
        </Section>

        <Section title="Subscriptions and billing">
          Placeholder. Will describe per-seat pricing, monthly billing via
          Stripe, refund policy, and cancellation.
        </Section>

        <Section title="Service availability">
          Placeholder. Best-effort uptime; no contractual SLA on non-Enterprise
          plans during early access.
        </Section>

        <Section title="Disclaimer of warranties and liability">
          Placeholder. Standard language to be drafted by counsel.
        </Section>

        <p className="text-xs text-text-muted mt-10">
          Questions? Contact <a className="underline" href="mailto:legal@bugsense.local">legal@bugsense.local</a>.
        </p>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-medium mb-2">{title}</h2>
      <p className="text-sm text-text-secondary leading-relaxed">{children}</p>
    </section>
  );
}
