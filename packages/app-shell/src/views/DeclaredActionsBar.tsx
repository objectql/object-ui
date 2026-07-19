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
import { Loader2 } from 'lucide-react';
import { useConsoleActionRuntime } from '../hooks/useConsoleActionRuntime';
import { useAdapter } from '../providers/AdapterProvider';
import { useMetadataItem } from '../providers/MetadataProvider';
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

  const recordData = record != null && typeof record === 'object' ? (record as Record<string, any>) : {};
  // `visible` fails CLOSED on a throwing predicate — mirrors action:button and
  // ActionEngine.getActionsForLocation: a guard that can't be evaluated hides
  // the action rather than exposing one whose precondition is broken.
  const isVisible = useCondition(toPredicateInput((action as any).visible), recordData, {
    throwOnError: true,
    label: `declared action "${action.name ?? action.label ?? 'action'}" (visible)`,
  });

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Same dispatch shape as ObjectGrid.onActionDef / RelatedRecordActionsBridge:
      // forward the full def (type/target/recordIdParam/bodyShape/refreshAfter/…),
      // surface a `params` ARRAY as `actionParams` (the runner's param-dialog
      // input), and reserve `params` for the `_rowRecord` stash the api handler
      // reads for `{id}` interpolation + record-id injection.
      const { params: rawParams, ...rest } = action as ActionDef & { params?: unknown };
      const dispatch: any = {
        ...rest,
        objectName,
        params: { _rowRecord: record },
      };
      if (Array.isArray(rawParams) && rawParams.length > 0) {
        dispatch.actionParams = rawParams;
      }
      await execute(dispatch as ActionDef);
    } finally {
      setLoading(false);
    }
  }, [action, execute, loading, objectName, record]);

  if ((action as any).visible && !isVisible) return null;

  const iconName = typeof (action as any).icon === 'string' ? (action as any).icon as string : undefined;
  const variant = (action as any).variant === 'primary'
    ? 'default'
    : ((action as any).variant || 'outline');
  const label = action.label || action.name;

  return (
    <Button
      type="button"
      size="sm"
      variant={variant as any}
      disabled={loading}
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
        <div role="toolbar" aria-label={label || 'Actions'} className="flex flex-row flex-wrap items-center gap-2">
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
