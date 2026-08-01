/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * DeclaredActionsBar — render + execute an object's SERVER-DECLARED actions for
 * a single record at a given location, with ZERO per-action host code.
 *
 * A bespoke page (e.g. the approvals inbox) that already has a record in hand
 * can drop this bar in to surface the actions the backend declares on that
 * object (`objectDef.actions[]`) — filtered to a `location`
 * (`record_section`, `record_header`, …) and each action's `visible` CEL —
 * and have them execute through the *same* console action runtime ObjectView /
 * RecordDetailView use: confirm dialogs, param-collection dialogs, result
 * dialogs, the authenticated api/flow/server handlers, and refresh-after.
 *
 * It is fully self-contained: it fetches the object definition through the
 * metadata provider (unless `actions` is passed explicitly), resolves the
 * `dataSource` from the adapter, and mounts its own `ActionProvider` +
 * runtime dialogs. Each button dispatches the declared action with the record
 * stashed under `params._rowRecord`, exactly the shape ObjectGrid row actions
 * and RelatedRecordActionsBridge use — so a `type:'api'` action whose target is
 * `/api/v1/approvals/requests/{id}/approve` resolves `{id}` from the record and
 * POSTs with any collected params (comment, to, …).
 *
 * Degrades gracefully: no matching declared actions → renders nothing.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Button, Separator, cn } from '@object-ui/components';
import {
  ActionProvider,
  useAction,
  useCondition,
  toPredicateInput,
} from '@object-ui/react';
import type { ActionDef } from '@object-ui/core';
import { useObjectLabel, useObjectTranslation } from '@object-ui/i18n';
import { Loader2 } from 'lucide-react';
import { useConsoleActionRuntime } from '../hooks/useConsoleActionRuntime';
import { useAdapter } from '../providers/AdapterProvider';
import { useMetadataItem } from '../providers/MetadataProvider';
import { buildDeclaredActionDispatch } from '../utils/declaredActionDispatch';
import { getIcon } from '../utils/getIcon';

export interface DeclaredActionsBarProps {
  /** Object whose declared actions to render (e.g. `sys_approval_request`). */
  objectName: string;
  /**
   * The record the actions run against. Stashed under `params._rowRecord`, so
   * `{token}` URL interpolation and `defaultFromRow` params resolve from it —
   * on the approvals inbox this is the `sys_approval_request` row itself, so
   * `{id}` resolves to the request id.
   */
  record: any;
  /** Action location to filter by (e.g. `record_section`). */
  location: string;
  /** Called after a successful action so the host can refresh. */
  onDone?: () => void;
  /**
   * Declared actions to render. When omitted, they are fetched from the
   * object's metadata definition. Passing them explicitly avoids the metadata
   * round-trip (and lets a host that already holds the object def reuse it).
   */
  actions?: ActionDef[];
  /**
   * Action names to drop from the rendered set. Use when the host renders a few
   * of the object's declared actions itself (e.g. the approvals inbox keeps
   * approve/reject in a richer composer with an attachment field) but wants the
   * bar to cover the rest — so the two never render duplicate buttons.
   */
  exclude?: string[];
  /** Extra classes for the toolbar wrapper. */
  className?: string;
  /**
   * Optional section label. When set, a divider + label is rendered above the
   * buttons — but ONLY when there are actions to show (the whole component
   * returns null when empty), so the host never gets an orphan divider.
   */
  label?: string;
}

/**
 * One declared-action button. Extracted so the `visible` CEL predicate can be
 * evaluated with a hook (rules-of-hooks) and so the dispatch can carry the
 * record. Mirrors `action:button` (fail-closed `visible`) but injects the
 * record under `params._rowRecord` — which `action:button` does NOT do, and
 * which the api handler needs to resolve `{id}` and inject the record id.
 */
const DeclaredActionButton: React.FC<{
  action: ActionDef;
  objectName: string;
  record: any;
}> = ({ action, objectName, record }) => {
  const { execute } = useAction();
  const [loading, setLoading] = useState(false);
  // Localize the SERVER-DECLARED strings through the `_actions.<name>.*`
  // translation convention (objectui#2762 P0-3) — the metadata's literal
  // label/confirmText/successMessage are the fallback, exactly like
  // ObjectView/RecordDetailView do for their toolbars. The param dialog's
  // labels localize downstream in useConsoleActionRuntime.
  const { actionLabel, actionConfirm, actionSuccess } = useObjectLabel();
  // Chrome strings the bar itself authors — as opposed to the declared metadata
  // above — go through the normal locale bundle, and `t` is threaded into the
  // dispatch builder for the same reason: the decision-output params are
  // SYNTHESIZED from `decision_output_defs`, so their key path is dynamic and no
  // `_actions.<action>.params.*` entry can ever exist for them; the literal IS
  // what renders, which is how English help text survived in a zh-CN workspace
  // (objectui#2762 P0-3).
  const { t } = useObjectTranslation();

  const recordData = record != null && typeof record === 'object' ? (record as Record<string, any>) : {};
  // `visible` fails CLOSED on a throwing predicate — mirrors action:button and
  // ActionEngine.getActionsForLocation: a guard that can't be evaluated hides
  // the action rather than exposing one whose precondition is broken.
  const isVisible = useCondition(toPredicateInput((action as any).visible), recordData, {
    throwOnError: true,
    label: `declared action "${action.name ?? action.label ?? 'action'}" (visible)`,
  });
  // Spec `disabled` (boolean | CEL — disabled when TRUE), evaluated against the
  // same record context as `visible`. #1885 wired it in action-button only;
  // this bar ignored it, so a spec-authored `disabled` guard on a declared
  // action did nothing here. (No legacy `enabled` fallback: server-declared
  // actions are spec-shaped and never carried the non-spec key.)
  const isDisabledPred = useCondition(toPredicateInput((action as any).disabled), recordData);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Same dispatch shape as ObjectGrid.onActionDef / RelatedRecordActionsBridge
      // and as the record page's mirrored approval header — one implementation,
      // in `buildDeclaredActionDispatch` (objectui#3055).
      const dispatch = buildDeclaredActionDispatch(action, {
        objectName,
        record,
        i18n: { actionLabel, actionConfirm, actionSuccess, t },
      });
      await execute(dispatch);
    } finally {
      setLoading(false);
    }
  }, [action, execute, loading, objectName, record, actionLabel, actionConfirm, actionSuccess, t]);

  if ((action as any).visible && !isVisible) return null;

  const iconName = typeof (action as any).icon === 'string' ? (action as any).icon as string : undefined;
  // Map the spec's action `variant` enum (primary|secondary|danger|ghost|link)
  // onto the Button's variants. `primary` → the filled default, `danger` →
  // `destructive` (the two names the enum and the Button component spell
  // differently); the rest pass through, and an undeclared variant stays
  // `outline` so a plain declared action still reads as a secondary button.
  const declaredVariant = (action as any).variant;
  const variant = declaredVariant === 'primary'
    ? 'default'
    : declaredVariant === 'danger'
      ? 'destructive'
      : (declaredVariant || 'outline');
  const fallbackLabel = action.label || action.name || '';
  const label = action.name ? actionLabel(objectName, action.name, fallbackLabel) : fallbackLabel;

  return (
    <Button
      type="button"
      size="sm"
      variant={variant as any}
      disabled={((action as any).disabled != null ? isDisabledPred : false) || loading}
      onClick={handleClick}
      data-testid={`declared-action-${action.name}`}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {/* `getIcon` returns a (memoised) component — instantiate it via
          createElement so it is not a component "created during render" in JSX
          position (react-hooks/static-components), mirroring ObjectDataPage. */}
      {!loading && iconName
        ? React.createElement(getIcon(iconName), { className: cn('h-4 w-4', label && 'mr-2') })
        : null}
      {label}
    </Button>
  );
};

export function DeclaredActionsBar({
  objectName,
  record,
  location,
  onDone,
  actions: actionsProp,
  exclude,
  className,
  label,
}: DeclaredActionsBarProps) {
  const dataSource = useAdapter();
  const { t } = useObjectTranslation();
  // Fetch the object def (and its declared actions) unless the host passed
  // them in. `useMetadataItem` no-ops when `name` is undefined.
  const { item: objectDef } = useMetadataItem('object', actionsProp ? undefined : objectName);

  const allActions: ActionDef[] = useMemo(
    () => (actionsProp ?? (objectDef as any)?.actions ?? []) as ActionDef[],
    [actionsProp, objectDef],
  );

  const located = useMemo(
    () => {
      const drop = exclude && exclude.length ? new Set(exclude) : null;
      return allActions.filter(
        (a: any) =>
          Array.isArray(a?.locations) &&
          a.locations.includes(location) &&
          !(drop && drop.has(a?.name)),
      );
    },
    [allActions, location, exclude],
  );

  // Mount the shared console action runtime — confirm/param/result dialogs, the
  // authenticated api/flow/server handlers, SPA nav, paused-flow runner. Its
  // `onRefresh` fires on any refresh-requesting success (the default), which is
  // exactly the host's `onDone`. The object def is threaded through `objects`
  // so field-backed params resolve their labels/defaults.
  const runtime = useConsoleActionRuntime({
    dataSource,
    objects: objectDef ? [objectDef] : [],
    objectName,
    onRefresh: onDone,
  });

  // Degrade gracefully — nothing declared at this location renders nothing (no
  // toolbar chrome, no provider churn).
  if (located.length === 0) return null;

  return (
    <ActionProvider {...runtime.actionProviderProps}>
      <div className={cn('space-y-2', className)}>
        {label && (
          <>
            <Separator />
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
          </>
        )}
        <div role="toolbar" aria-label={label || t('common.actions')} className="flex flex-row flex-wrap items-center gap-2">
          {located.map((action) => (
            <DeclaredActionButton
              key={action.name}
              action={action}
              objectName={objectName}
              record={record}
            />
          ))}
        </div>
      </div>
      {runtime.dialogs}
    </ActionProvider>
  );
}

export default DeclaredActionsBar;
