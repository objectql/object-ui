/**
 * AdapterProvider
 *
 * Creates and provides an ObjectStackAdapter instance to the component tree.
 * Also exposes a `useAdapter` hook for consuming the adapter in child components.
 *
 * @module
 */

import { useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ObjectStackAdapter, type WriteWarningEvent } from '@object-ui/data-objectstack';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { AdapterCtx } from '@object-ui/react';
import { installSettleSignalGlobal, withSettleSignal } from '../observability/settleSignal';

export { useAdapter } from '@object-ui/react';

/**
 * Turn a write-warning (framework #3431/#3455) into a human toast. The write
 * SUCCEEDED — some caller-supplied fields were legally stripped (read-only /
 * locked by state), so we tell the user rather than let it pass silently.
 */
function toastWriteWarning(ev: WriteWarningEvent): void {
  const fields = Array.from(new Set(ev.droppedFields.flatMap((d) => d.fields)));
  if (fields.length === 0) return;
  const list = fields.join(', ');
  const description =
    fields.length === 1
      ? `The read-only field “${list}” could not be changed and was not saved.`
      : `${fields.length} read-only fields could not be changed and were not saved: ${list}.`;
  toast.warning('Some fields were not saved', { description });
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
    let unsubscribeWriteWarning: (() => void) | undefined;

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

        // Surface silently-stripped write fields (#3431/#3455) as a toast so a
        // read-only value the user typed doesn't just vanish on save.
        unsubscribeWriteWarning = a.onWriteWarning(toastWriteWarning);

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
    return () => {
      cancelled = true;
      unsubscribeWriteWarning?.();
    };
  }, [externalAdapter]);

  return (
    <AdapterCtx.Provider value={adapter}>
      {children}
    </AdapterCtx.Provider>
  );
}
