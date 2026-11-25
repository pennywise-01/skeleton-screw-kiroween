'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { generate as generateApi, checkProviders, type AgentRequest, type AgentResult } from '../lib/agent';

interface AgentContextValue {
  provider: 'kiro';
  generate: (req: AgentRequest) => Promise<AgentResult>;
  available: { kiro: boolean; demo: boolean; preferred: 'kiro' | null };
  ready: boolean;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState({ kiro: false, demo: false, preferred: null as 'kiro' | null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    checkProviders()
      .then((status) => {
        setAvailable(status);
        setReady(true);
      })
      .catch((err) => {
        console.error('Failed to check providers:', err);
        setReady(true);
      });
  }, []);

  const generate = async (req: AgentRequest) => {
    if (!available.kiro && !available.demo) {
      throw new Error('kiro-cli is not available on this machine. Install it, or enable DEMO_MODE.');
    }
    return generateApi('kiro', req);
  };

  return (
    <AgentContext.Provider value={{ provider: 'kiro', generate, available, ready }}>
      {children}
    </AgentContext.Provider>
  );
}

export const useAgent = () => {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
};
