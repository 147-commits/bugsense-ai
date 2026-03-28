'use client';

import Sidebar from './Sidebar';
import { useAppStore } from '@/lib/hooks/useStore';
import { cn } from '@/lib/utils';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main
        className={cn(
          'flex-1 overflow-y-auto transition-all duration-300',
          sidebarOpen ? 'ml-[240px]' : 'ml-[72px]'
        )}
      >
        {children}
      </main>
    </div>
  );
}
