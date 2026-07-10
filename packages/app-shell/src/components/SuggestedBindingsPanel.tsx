// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { useCallback, useEffect, useState } from 'react';
import { ShieldQuestion } from 'lucide-react';
import { Button, cn } from '@object-ui/components';
import { toast } from 'sonner';
import {
  listSuggestedBindings,
  confirmSuggestedBinding,
  dismissSuggestedBinding,
  type SuggestedBinding,
} from '../services/suggestedBindingsApi';

/**
 * SuggestedBindingsPanel — pending audience-binding suggestions
 * (ADR-0090 D5/D9) with per-row Confirm / Dismiss.
 *
 * A package permission set shipped with `isDefault: true` asks the admin to
 * bind it to the built-in `everyone` position (default grants for signed-in
 * users). The server NEVER auto-binds; this panel is the "admin confirms"
 * moment. Confirm runs under the server-side anchor gates — a 403 carries
 * the human-readable reason (e.g. the set carries high-privilege bits) and
 * is surfaced verbatim.
 *
 * Renders nothing while loading, when there are no pending suggestions, or
 * when the caller is not a tenant admin (403 on list) — safe to mount
 * unconditionally in the install dialog and the Studio Access pillar.
 */
export interface SuggestedBindingsStrings {
  /** One-line prompt per suggestion, e.g. `CRM suggests granting 'crm_readonly' to everyone`. */
  describe: (s: SuggestedBinding) => string;
  confirm: string;
  dismiss: string;
  confirming: string;
  confirmedToast: (s: SuggestedBinding) => string;
  dismissedToast: (s: SuggestedBinding) => string;
}

export function SuggestedBindingsPanel({
  packageId,
  strings,
  className,
  onResolved,
}: {
  /** Limit to one package's suggestions (install dialog); omit for all (Access pillar). */
  packageId?: string;
  strings: SuggestedBindingsStrings;
  className?: string;
  /** Called after any suggestion is confirmed or dismissed. */
  onResolved?: (s: SuggestedBinding) => void;
}) {
  const [pending, setPending] = useState<SuggestedBinding[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    listSuggestedBindings({ status: 'pending', ...(packageId ? { packageId } : {}) })
      .then((rows) => { if (!cancelled) setPending(rows); })
      .catch(() => { /* non-admin (403) or surface unavailable → render nothing */ });
    return () => { cancelled = true; };
  }, [packageId]);

  useEffect(() => reload(), [reload]);

  const resolve = async (s: SuggestedBinding, action: 'confirm' | 'dismiss') => {
    setBusyId(s.id);
    try {
      const resolved = action === 'confirm'
        ? await confirmSuggestedBinding(s.id)
        : await dismissSuggestedBinding(s.id);
      setPending((rows) => rows.filter((r) => r.id !== s.id));
      toast.success(action === 'confirm' ? strings.confirmedToast(s) : strings.dismissedToast(s));
      onResolved?.(resolved ?? s);
    } catch (err: any) {
      // The gate's message is the explanation ("carries view-all…") — show it.
      toast.error(err?.message ?? String(err));
    } finally {
      setBusyId(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <div
      data-testid="suggested-bindings-panel"
      className={cn(
        'rounded-lg border border-amber-300/60 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 space-y-2',
        className,
      )}
    >
      {pending.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <ShieldQuestion className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 min-w-0 text-sm text-amber-900 dark:text-amber-200">
            {strings.describe(s)}
          </p>
          <Button
            size="sm"
            disabled={busyId === s.id}
            onClick={() => resolve(s, 'confirm')}
            data-testid={`suggested-binding-confirm-${s.permission_set_name}`}
          >
            {busyId === s.id ? strings.confirming : strings.confirm}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === s.id}
            onClick={() => resolve(s, 'dismiss')}
            data-testid={`suggested-binding-dismiss-${s.permission_set_name}`}
          >
            {strings.dismiss}
          </Button>
        </div>
      ))}
    </div>
  );
}
