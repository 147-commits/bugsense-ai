'use client';

import Sidebar from './Sidebar';
import { useAppStore } from '@/lib/hooks/useStore';
import { cn } from '@/lib/utils';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <main
        className={cn(
          'flex-1 overflow-y-auto transition-all duration-200',
          sidebarOpen ? 'ml-[220px]' : 'ml-[60px]'
        )}
      >
        {children}
      </main>
    </div>
  );
}
