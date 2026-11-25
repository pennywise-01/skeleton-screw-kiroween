'use client';
import { AgentProvider } from 'skeleton';
import { AppHeader } from '../components/AppHeader';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AgentProvider>
      <AppHeader />
      {children}
    </AgentProvider>
  );
}
