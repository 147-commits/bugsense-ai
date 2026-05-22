import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Check,
  Github,
  Gauge,
  Plug,
  Twitter,
} from 'lucide-react';
import { authOptions } from '@/lib/auth/authOptions';
import { PLANS } from '@/lib/billing/plans';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <TopNav />
      <Hero />
      <Features />
      <SocialProof />
      <PricingTeaser />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <header className="border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          BugSense
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/pricing" className="text-text-secondary hover:text-text-primary">Pricing</Link>
          <Link href="/login" className="text-text-secondary hover:text-text-primary">Sign in</Link>
          <Link href="/signup" className="btn-primary text-xs">Get started</Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-6 pt-24 pb-20">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-5">
          The release readiness verdict for every shipping team.
        </h1>
        <p className="text-base md:text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto mb-8">
          Stop arguing about whether you&apos;re ready to ship. BugSense reads
          your open bugs, test results, and report quality, and tells you GO,
          CAUTION, or NO-GO — with the data behind the call.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/signup" className="btn-primary inline-flex items-center gap-2">
            Start free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="mailto:sales@bugsense.local?subject=Demo%20request"
            className="btn-secondary inline-flex items-center gap-2"
          >
            Book a demo
          </Link>
        </div>
        <p className="text-xs text-text-muted mt-6">
          100 free AI calls every month. No credit card required.
        </p>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Gauge,
    title: 'Release Readiness Score',
    body: 'A weighted 0-100 score from open critical bugs, test pass rate, and report quality. One number your stand-up can act on.',
  },
  {
    icon: Bot,
    title: 'AI Bug Triage',
    body: 'Paste any rough description. Get a structured report with severity, priority, repro steps, root-cause hypotheses, and a test plan.',
  },
  {
    icon: Plug,
    title: 'MCP Integration',
    body: 'Expose your bugs, tests, and readiness to any MCP-compatible AI agent — Claude Desktop, IDE plugins, internal tools. One install.',
  },
] as const;

function Features() {
  return (
    <section className="px-6 py-20 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center mb-12">
          Built for QA leads who are tired of guessing.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <article key={f.title} className="glass-panel p-6">
              <div className="w-10 h-10 rounded-lg bg-accent-violet/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-accent-violet" />
              </div>
              <h3 className="text-base font-medium mb-2">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="px-6 py-16 border-t border-border">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-xs uppercase tracking-wider text-text-muted mb-6">
          Trusted by QA teams at
        </p>
        {/* TODO: replace with real customer logos before public launch */}
        <div className="flex items-center justify-center gap-12 flex-wrap opacity-50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-28 rounded bg-bg-tertiary"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingTeaser() {
  const free = PLANS.FREE;
  const pro = PLANS.PRO;
  return (
    <section className="px-6 py-20 border-t border-border">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
          Free to start. Per-seat when you grow.
        </h2>
        <p className="text-sm text-text-secondary mb-8">
          {free.aiCallsPerMonth} AI calls every month on Free.
          {' '}${pro.priceUsd}/seat/month for Pro with all integrations.
          {' '}Annual contracts available on Enterprise.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap mb-8">
          <Link href="/pricing" className="btn-primary inline-flex items-center gap-2">
            See pricing
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/signup" className="btn-secondary">Start free</Link>
        </div>
        <ul className="text-sm text-text-secondary inline-flex flex-col gap-2 text-left">
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent-emerald" /> Jira two-way sync</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent-emerald" /> Slack notifications + daily digests</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent-emerald" /> MCP server for AI coding agents</li>
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 py-12 border-t border-border">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
        <p className="text-xs text-text-muted">
          © {new Date().getUTCFullYear()} BugSense. AI-powered bug triage and release readiness.
        </p>
        <nav className="flex items-center gap-5 text-xs">
          <Link href="/pricing" className="text-text-secondary hover:text-text-primary">Pricing</Link>
          {/* TODO(launch): docs site URL */}
          <Link href="https://docs.bugsense.local" className="text-text-secondary hover:text-text-primary">Docs</Link>
          <Link href="/privacy" className="text-text-secondary hover:text-text-primary">Privacy</Link>
          <Link href="/terms" className="text-text-secondary hover:text-text-primary">Terms</Link>
          <Link
            href="https://twitter.com/bugsenseai"
            className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1"
            aria-label="Twitter"
          >
            <Twitter className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="https://github.com/bugsenseai"
            className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1"
            aria-label="GitHub"
          >
            <Github className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </div>
    </footer>
  );
}
