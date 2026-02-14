/**
 * AdapterProvider
 *
 * Creates and provides an ObjectStackAdapter instance to the component tree.
 * Also exposes a `useAdapter` hook for consuming the adapter in child components.
 *
 * @module
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { ObjectStackAdapter } from '../dataSource';

const AdapterCtx = createContext<ObjectStackAdapter | null>(null);

/**
 * Hook to access the ObjectStackAdapter from context.
 */
export function useAdapter(): ObjectStackAdapter | null {
  return useContext(AdapterCtx);
}

interface AdapterProviderProps {
  children: ReactNode;
  /** Optional pre-created adapter (useful for testing). */
  adapter?: ObjectStackAdapter | null;
}

/**
 * Creates an ObjectStackAdapter, connects to the API, then provides it to children.
 * Shows nothing (returns null) until the adapter is ready.
 */
export function AdapterProvider({ children, adapter: externalAdapter }: AdapterProviderProps) {
  const [adapter, setAdapter] = useState<ObjectStackAdapter | null>(externalAdapter ?? null);

  useEffect(() => {
    if (externalAdapter) {
      setAdapter(externalAdapter);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const a = new ObjectStackAdapter({
          baseUrl: '',
          autoReconnect: true,
          maxReconnectAttempts: 5,
          reconnectDelay: 1000,
          cache: { maxSize: 50, ttl: 300_000 },
        });

        await a.connect();

        if (!cancelled) {
          setAdapter(a);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Console] Failed to initialize:', err);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [externalAdapter]);

  return (
    <AdapterCtx.Provider value={adapter}>
      {children}
    </AdapterCtx.Provider>
  );
}
