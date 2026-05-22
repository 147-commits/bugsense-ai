import Link from 'next/link';

// TODO(legal): replace with real privacy policy copy from counsel before launch.
// The copy below is placeholder structure only and must NOT ship to production
// without legal review.
export default function PrivacyPage() {
  return (
    <article className="min-h-screen bg-bg-primary text-text-primary px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs text-text-muted mb-2">
          <Link href="/" className="hover:text-text-secondary">← Home</Link>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Privacy policy</h1>
        <p className="text-xs text-text-muted mb-10">
          Last updated: placeholder. Replace before launch.
        </p>

        <Section title="What this is">
          Placeholder. This page exists so the marketing footer can link somewhere
          legitimate; the actual privacy policy must be drafted by counsel before
          we collect any production data.
        </Section>

        <Section title="What we collect">
          Placeholder. Will describe: account info (email, name), workspace
          metadata, bug content you submit, OAuth tokens from connected
          integrations (encrypted at rest), AI usage counters, payment metadata
          via Stripe, error telemetry via Sentry.
        </Section>

        <Section title="How we use it">
          Placeholder. Will describe: providing the service, billing, support,
          improving the product, security investigations.
        </Section>

        <Section title="Sub-processors">
          Placeholder. Will list: Vercel, Neon, Anthropic, Stripe, Resend,
          Sentry, Google (OAuth), Atlassian (OAuth).
        </Section>

        <Section title="Your rights">
          Placeholder. Will describe access, export, deletion, and contact
          procedures depending on jurisdiction.
        </Section>

        <p className="text-xs text-text-muted mt-10">
          Questions? Contact <a className="underline" href="mailto:privacy@bugsense.local">privacy@bugsense.local</a>.
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
