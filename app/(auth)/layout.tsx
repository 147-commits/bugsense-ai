import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in — BugSense AI',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-sm px-4 py-12">
        {children}
      </div>
    </div>
  );
}
