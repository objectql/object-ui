/**
 * AdapterProvider
 *
 * Creates and provides an ObjectStackAdapter instance to the component tree.
 * Also exposes a `useAdapter` hook for consuming the adapter in child components.
 *
 * @module
 */

import { useState, useEffect, type ReactNode } from 'react';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { AdapterCtx } from '@object-ui/react';
import { installSettleSignalGlobal, withSettleSignal } from '../observability/settleSignal';

export { useAdapter } from '@object-ui/react';

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

    // Expose window.__objectui.{pendingRequests,idle,whenIdle} so an automated
    // (AI) browser driver has one "is the app settled?" predicate (ADR-0054 C5).
    installSettleSignalGlobal();

    async function init() {
      try {
        const a = new ObjectStackAdapter({
          baseUrl: import.meta.env.VITE_SERVER_URL || '',
          // Count every outbound request in the global in-flight signal (C5).
          fetch: withSettleSignal(createAuthenticatedFetch()),
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
