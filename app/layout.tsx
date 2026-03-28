import type { Metadata } from 'next';
import '@/styles/globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'BugSense AI — Intelligent Defect Analysis Platform',
  description: 'AI-powered bug report analysis, duplicate detection, and QA intelligence for modern engineering teams.',
  keywords: ['bug tracking', 'QA', 'AI', 'defect analysis', 'testing'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary text-text-primary overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
