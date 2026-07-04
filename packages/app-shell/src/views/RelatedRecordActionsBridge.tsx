/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * RelatedRecordActionsBridge — supplies the console's object-aware CRUD +
 * action handlers to the `record:related_list` renderers on a detail page.
 *
 * The renderer (in `@object-ui/plugin-detail`) knows the child object, the FK
 * back to the parent, and the parent id — but not the SPA routes, the
 * create/edit form pages, or the per-object lifecycle affordances. This bridge
 * (mounted inside the page's `ActionProvider`) closes that gap:
 *
 *   - 查看详情 → navigate to the child record's detail route
 *   - 增        → navigate to the child's `/new` page, pre-linking the parent
 *                 via `?<relationshipField>=<parentId>` (the convention
 *                 RecordFormPage already reads as create-mode initial values)
 *   - 改        → navigate to the child record's `/edit` page
 *   - 删        → `dataSource.delete(child, id)` (RelatedList shows the confirm
 *                 dialog and refreshes afterwards)
 *   - 子对象 action → the child object's `list_item` actions, executed against
 *                 the clicked row through the page's shared ActionRunner
 *
 * Each affordance is gated by {@link resolveCrudAffordances} so system /
 * append-only children never show New / Edit / Delete. When this bridge is
 * absent (e.g. the Studio designer) the related list stays read-only.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RelatedRecordActionsProvider,
  useAction,
  type RelatedRecordActionsValue,
  type RelatedRecordHandlers,
  type RelatedRowActionDef,
} from '@object-ui/react';
import type { ActionDef } from '@object-ui/core';
import { resolveCrudAffordances } from '../utils/crudAffordances';

/** Notify open related lists for `objectName` to refetch (see RelatedList). */
export function notifyRelatedChanged(objectName: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('objectui:related-changed', { detail: { objectName } }),
  );
}

/** i18n label resolver signature (matches `useObjectLabel().actionLabel`). */
type ActionLabelFn = (objectName: string | undefined, actionName: string, fallback: string) => string;

export interface RelatedRecordActionsBridgeProps {
  /** Current app segment used to build `/apps/:appName/...` routes. */
  appName?: string;
  /** All object definitions (to resolve the child object + its actions). */
  objects: any[];
  /** Data source for delete + action dispatch. */
  dataSource: any;
  /** Localizes a child action's label (falls back to the raw label). */
  actionLabel: ActionLabelFn;
  children: React.ReactNode;
}

/**
 * Derive the child object's row actions (metadata `actions` filtered to the
 * `list_item` location), localized and shaped for the related-list row menu.
 */
function deriveRowActions(childDef: any, actionLabel: ActionLabelFn): RelatedRowActionDef[] {
  const actions = Array.isArray(childDef?.actions) ? childDef.actions : [];
  return actions
    .filter((a: any) => Array.isArray(a?.locations) && a.locations.includes('list_item'))
    .map((a: any) => ({
      ...a,
      label: actionLabel(childDef.name, a.name, a.label || a.name),
    }));
}

export function RelatedRecordActionsBridge({
  appName,
  objects,
  dataSource,
  actionLabel,
  children,
}: RelatedRecordActionsBridgeProps) {
  const navigate = useNavigate();
  const { execute } = useAction();
  const base = appName ? `/apps/${appName}` : '';

  // Execute a child object's row action against the clicked record. Reuses the
  // page's ActionRunner (confirm dialog, toast, param collection are handled by
  // it) but retargets it at the CHILD object + row via the action's
  // `objectName` / `recordId`, which the record-detail action handlers honor.
  const runRowAction = useCallback(
    async (childObject: string, record: any, action: RelatedRowActionDef) => {
      const id = record?.id ?? record?._id;
      const def = {
        ...(action as unknown as ActionDef),
        objectName: childObject,
        ...(id != null ? { recordId: String(id) } : {}),
        params: { ...(action.params as Record<string, unknown> | undefined) },
      } as ActionDef;
      const res = await execute(def);
      // Refresh open related lists for this child object after a successful
      // mutating action (the row menu handler is otherwise fire-and-forget).
      if (res?.success) notifyRelatedChanged(childObject);
    },
    [execute],
  );

  const value = useMemo<RelatedRecordActionsValue>(
    () => ({
      resolve: ({ objectName, relationshipField, parentId }) => {
        const childDef = objects.find((o: any) => o?.name === objectName);
        if (!childDef || !base) return {} as RelatedRecordHandlers;
        const aff = resolveCrudAffordances(childDef);
        const detailUrl = (id: string | number) =>
          `${base}/${objectName}/record/${encodeURIComponent(String(id))}`;

        const handlers: RelatedRecordHandlers = {
          // Viewing a child record is always allowed when the list is visible.
          onView: (id) => navigate(detailUrl(id)),
        };

        if (aff.create) {
          handlers.onCreate = () => {
            const canLink =
              relationshipField && parentId != null && parentId !== '';
            const qs = canLink
              ? `?${encodeURIComponent(relationshipField as string)}=${encodeURIComponent(String(parentId))}`
              : '';
            navigate(`${base}/${objectName}/new${qs}`);
          };
        }
        if (aff.edit) {
          handlers.onEdit = (id) => navigate(`${detailUrl(id)}/edit`);
        }
        if (aff.delete) {
          handlers.onDelete = async (id) => {
            await dataSource?.delete?.(objectName, String(id));
          };
        }

        const rowActions = deriveRowActions(childDef, actionLabel);
        if (rowActions.length > 0) {
          handlers.rowActions = rowActions;
          handlers.onRowAction = (action, record) =>
            runRowAction(objectName, record, action);
        }

        return handlers;
      },
    }),
    [objects, base, navigate, dataSource, actionLabel, runRowAction],
  );

  return (
    <RelatedRecordActionsProvider value={value}>{children}</RelatedRecordActionsProvider>
  );
}
