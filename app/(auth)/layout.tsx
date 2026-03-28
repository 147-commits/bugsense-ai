import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in — BugSense AI',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-bg-primary">
      {/* Dot grid */}
      <div className="absolute inset-0 dot-pattern opacity-60" />

      {/* Ambient glow blobs */}
      <div
        aria-hidden
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full
                   bg-accent-blue/10 blur-[120px] pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full
                   bg-accent-violet/10 blur-[120px] pointer-events-none"
      />

      {/* Card slot */}
      <div className="relative z-10 w-full max-w-md px-4 py-12">
        {children}
      </div>
    </div>
  );
}
