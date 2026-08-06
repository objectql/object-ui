/**
 * AdapterProvider
 *
 * Creates and provides an ObjectStackAdapter instance to the component tree.
 * Also exposes a `useAdapter` hook for consuming the adapter in child components.
 *
 * @module
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ObjectStackAdapter, type WriteWarningEvent } from '@object-ui/data-objectstack';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { AdapterCtx } from '@object-ui/react';
import { useObjectTranslation, useSafeFieldLabel } from '@object-ui/i18n';
import { installSettleSignalGlobal, withSettleSignal } from '../observability/settleSignal';

export { useAdapter } from '@object-ui/react';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type FieldLabelFn = (objectName: string, fieldName: string, fallback: string) => string;

/**
 * Resolve `field api name → human label` for one object, best-effort.
 *
 * The write-warning event carries machine names only — the server never sends
 * labels with `droppedFields`. Rather than print `type, source_method` at a
 * user who only ever saw "安灯类型 / 来源方式" (objectui#3484 point C), read the
 * object's schema (the adapter caches it, so this is normally free) and put its
 * labels through the same convention-based i18n every other surface uses. A
 * field the schema does not name falls back to its api name — an exact key
 * beats a guess.
 */
async function resolveFieldLabels(
  adapter: Pick<ObjectStackAdapter, 'getObjectSchema'>,
  objectName: string,
  fieldLabel: FieldLabelFn,
): Promise<(fieldName: string) => string> {
  let fields: Record<string, { label?: string }> | undefined;
  try {
    const schema = (await adapter.getObjectSchema(objectName)) as
      | { fields?: Record<string, { label?: string }> }
      | undefined;
    fields = schema?.fields;
  } catch {
    // Metadata unreachable — the api names below are still a truthful answer.
  }
  return (fieldName: string) =>
    fieldLabel(objectName, fieldName, fields?.[fieldName]?.label || fieldName);
}

/**
 * Turn a write-warning (framework #3431/#3455) into a human toast. The write
 * SUCCEEDED — some caller-supplied fields were legally stripped, so we tell the
 * user rather than let it pass silently.
 *
 * The REASON decides the wording (#3794). `readonly_when` is not "this field is
 * read-only" — the field is editable in other states and the form rendered it
 * as an ordinary input; what happened is that THIS record's current state locks
 * it. Saying "read-only" there sends the user looking for a permission problem
 * that doesn't exist.
 *
 * The wording ACKNOWLEDGES the save (objectui#3484 point B). This toast lands
 * next to the save surface's own "Updated" toast, and the pair used to read as
 * a contradiction — "some fields were not saved" beside "updated successfully",
 * with nothing telling the user which one to believe. It is one outcome, not
 * two: the record was saved, and N of the fields sent did not take effect.
 *
 * Exported for its unit test only — the provider mounts the real adapter, so
 * there is no other seam to drive this from. Not part of the package API.
 */
export async function toastWriteWarning(
  ev: WriteWarningEvent,
  t: TranslateFn,
  adapter: Pick<ObjectStackAdapter, 'getObjectSchema'> | null,
  fieldLabel: FieldLabelFn,
): Promise<void> {
  const byReason = new Map<string, string[]>();
  for (const d of ev.droppedFields) {
    const seen = byReason.get(d.reason) ?? [];
    for (const f of d.fields) if (!seen.includes(f)) seen.push(f);
    byReason.set(d.reason, seen);
  }
  if (byReason.size === 0) return;

  const labelOf = adapter && ev.resource
    ? await resolveFieldLabels(adapter, ev.resource, fieldLabel)
    : (fieldName: string) => fieldName;

  const lines: string[] = [];
  for (const [reason, fields] of byReason) {
    if (fields.length === 0) continue;
    const list = fields.map(labelOf).join(', ');
    lines.push(
      reason === 'readonly_when'
        ? t('detail.writeStrippedByState', {
            fields: list,
            defaultValue:
              "Not editable in this record's current state, so it did not take effect: {{fields}}",
          })
        : t('detail.writeStrippedReadonly', {
            fields: list,
            defaultValue: 'Read-only, so it did not take effect: {{fields}}',
          }),
    );
  }
  if (lines.length === 0) return;
  toast.warning(
    t('detail.writeStrippedTitle', {
      defaultValue: 'Saved — but some fields did not take effect',
    }),
    { description: lines.join('\n') },
  );
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
  // The warning listener is registered ONCE (the adapter outlives a language
  // switch), so read `t` through a ref instead of capturing it — otherwise a
  // user who switches language mid-session keeps getting the old locale, and
  // adding `t` to the effect deps would tear down and rebuild the adapter.
  const { t } = useObjectTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  // Same one-time-registration reasoning as `t` above: read the label resolver
  // through a ref so a language switch relabels the next toast without
  // rebuilding the adapter.
  const { fieldLabel } = useSafeFieldLabel();
  const fieldLabelRef = useRef(fieldLabel);
  fieldLabelRef.current = fieldLabel;

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
        unsubscribeWriteWarning = a.onWriteWarning((ev) => {
          void toastWriteWarning(ev, tRef.current as TranslateFn, a, fieldLabelRef.current);
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
