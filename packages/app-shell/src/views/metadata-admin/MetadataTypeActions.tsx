// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `MetadataTypeActions` — renders the declarative, **type-level** actions a
 * metadata type carries (GAP-1) using the same button affordance business
 * objects use for their `actions`.
 *
 * The framework's `/meta/types` endpoint emits these on each rich entry as
 * spec `ActionSchema` objects (see `MetadataTypeAction` in `useMetadata`).
 * The canonical first consumer is the `datasource` type, which declares a
 * "Test connection" action (`type:'api'`, `POST
 * /api/v1/datasources/${ctx.recordId}/test`). Rendering happens in two
 * chrome slots:
 *
 *   • ResourceEditPage  → `location='record_header'`, `recordId` = item name.
 *   • ResourceListPage  → `location='list_toolbar'` (no recordId).
 *
 * Execution path mirrors ObjectView's auth-aware `apiHandler` rather than the
 * core ActionRunner's bare `fetch`: the metadata API endpoints require the
 * better-auth session cookie + bearer token, which only ride along through
 * `createAuthenticatedFetch` (and matter in split-origin dev where the SPA is
 * on :5180 and the backend on :3000). `${ctx.recordId}` / `${param.X}` tokens
 * in `target` are resolved here, exactly as the spec mandates renderers do.
 *
 * Dialogs: actions that declare an array of `params` collect them from the
 * user in the shared {@link ActionParamDialog} before running (same UX as
 * business-object actions); actions that declare a `resultDialog` render the
 * API response in {@link ActionResultDialog}. `confirmText` still gates the run.
 *
 * Only `type:'api'` is wired today; other types surface a toast so a
 * misconfigured action fails loud instead of silent.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@object-ui/components';
import { createAuthenticatedFetch } from '@object-ui/auth';
import type { ActionParamDef } from '@object-ui/core';
import { getIcon } from '../../utils/getIcon';
import { ActionParamDialog, type ParamDialogState } from '../ActionParamDialog';
import { ActionResultDialog, type ResultDialogState } from '../ActionResultDialog';
import type { MetadataTypeAction, RichMetadataTypeEntry } from './useMetadata';

/** Map the spec's action variants onto the Shadcn Button variants. */
const VARIANT_MAP: Record<NonNullable<MetadataTypeAction['variant']>, React.ComponentProps<typeof Button>['variant']> = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  ghost: 'ghost',
  link: 'link',
};

/**
 * Substitute `${ctx.X}` / `${param.X}` tokens in an action target. Values are
 * `encodeURIComponent`'d — opaque ids in a path segment (datasource name) are
 * the only use today, and encoding is the correct behaviour for those.
 */
function interpolateTarget(
  target: string,
  ctx: Record<string, unknown>,
  params: Record<string, unknown>,
): string {
  if (target.indexOf('${') === -1) return target;
  return target.replace(/\$\{(param|ctx)\.([\w.]+)\}/g, (_m, scope: string, path: string) => {
    const root = scope === 'param' ? params : ctx;
    const value = path
      .split('.')
      .reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), root);
    return value == null ? '' : encodeURIComponent(String(value));
  });
}

export interface MetadataTypeActionsProps {
  /** The rich type entry whose `actions` to render. */
  entry?: Pick<RichMetadataTypeEntry, 'actions'> | undefined;
  /** Which chrome slot is asking — actions are filtered by their `locations`. */
  location: string;
  /** Current item name, exposed to actions as `${ctx.recordId}`. */
  recordId?: string;
  /** Called after a successful action when `refreshAfter` is set. */
  onAfter?: () => void;
}

/**
 * Render the location-filtered type-level actions. Returns `null` when the
 * type declares none for this slot, so callers can drop it straight into an
 * existing toolbar `<>…</>` without conditionals.
 */
export function MetadataTypeActions({ entry, location, recordId, onAfter }: MetadataTypeActionsProps): React.ReactElement | null {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [paramState, setParamState] = React.useState<ParamDialogState>({ open: false, params: [] });
  const [resultState, setResultState] = React.useState<ResultDialogState>({ open: false });
  const authFetch = React.useMemo(() => createAuthenticatedFetch(), []);

  const actions = React.useMemo(
    () =>
      (entry?.actions ?? []).filter(
        (a) => !a.locations || a.locations.length === 0 || a.locations.includes(location),
      ),
    [entry?.actions, location],
  );

  if (actions.length === 0) return null;

  /** Open the param dialog and resolve with the collected values (or null on cancel). */
  const collectParams = (params: ActionParamDef[], title?: string) =>
    new Promise<Record<string, unknown> | null>((resolve) => {
      setParamState({ open: true, params, title, resolve });
    });

  const run = async (action: MetadataTypeAction) => {
    const title = action.label ?? action.name;

    // Only `type:'api'` is wired today. Default (`undefined`) is treated as
    // `script` by the spec, which the engine cannot execute — fail loud.
    if (action.type !== 'api') {
      toast.error(`Action “${title}”: type "${action.type ?? 'script'}" is not supported here yet.`);
      return;
    }

    if (action.confirmText && !window.confirm(action.confirmText)) return;

    // Inputs: an array of param descriptors → collect in a dialog; a static
    // object → forward as-is.
    let params: Record<string, unknown>;
    if (Array.isArray(action.params) && action.params.length > 0) {
      const collected = await collectParams(action.params as ActionParamDef[], title);
      if (collected == null) return; // user cancelled
      params = collected;
    } else {
      params = (action.params as Record<string, unknown> | undefined) ?? {};
    }

    const ctx = { recordId, origin: window.location.origin };
    const resolved = interpolateTarget(action.target ?? '', ctx, params);
    if (!resolved) {
      toast.error(`Action “${title}” has no target.`);
      return;
    }

    // Split SPA + backend dev: promote same-origin `/api/...` paths to the
    // backend origin so the request (and its auth cookie) reaches :3000.
    const apiBase = ((import.meta as { env?: Record<string, string> }).env?.VITE_SERVER_URL || '').replace(/\/+$/, '');
    const url = /^https?:\/\//i.test(resolved) ? resolved : `${apiBase}${resolved}`;
    const method = (action.method || 'POST').toUpperCase();

    setBusy(action.name);
    try {
      const init: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      };
      if (method !== 'GET' && method !== 'DELETE') init.body = JSON.stringify(params);

      const res = await authFetch(url, init);
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        /* non-JSON / empty body — fall back to status text */
      }

      if (!res.ok || (data && data.success === false)) {
        const detail =
          (data?.error as string) || (data?.message as string) || `HTTP ${res.status} ${res.statusText}`.trim();
        toast.error(`${action.errorMessage ? `${action.errorMessage}: ` : ''}${title}: ${detail}`);
        return;
      }

      // Rich result reveal when declared, else a success toast.
      if (action.resultDialog) {
        setResultState({ open: true, spec: action.resultDialog as ResultDialogState['spec'], data: data ?? {} });
      } else {
        const msg = action.successMessage || (typeof data?.message === 'string' ? (data.message as string) : `${title} ✓`);
        toast.success(msg);
      }
      if (action.refreshAfter) onAfter?.();
    } catch (err) {
      toast.error(`${title}: ${(err as Error)?.message ?? String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {actions.map((action) => {
        const Icon = action.icon ? getIcon(action.icon) : null;
        const isBusy = busy === action.name;
        return (
          <Button
            key={action.name}
            size="sm"
            variant={VARIANT_MAP[action.variant ?? 'secondary'] ?? 'secondary'}
            disabled={isBusy}
            onClick={() => run(action)}
            title={action.label ?? action.name}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : Icon ? (
              <Icon className="h-4 w-4 mr-1" />
            ) : null}
            {action.label ?? action.name}
          </Button>
        );
      })}

      <ActionParamDialog
        state={paramState}
        onOpenChange={(open) => {
          if (!open) {
            paramState.resolve?.(null);
            setParamState({ open: false, params: [] });
          }
        }}
      />
      <ActionResultDialog
        state={resultState}
        onAcknowledge={() => setResultState({ open: false })}
      />
    </>
  );
}
