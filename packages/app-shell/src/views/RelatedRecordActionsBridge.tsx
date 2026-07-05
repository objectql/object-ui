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
 *   - 增 / 改   → open the child form as an OVERLAY on the parent detail
 *                 (#2604 D3: a child task's return target is ALWAYS the parent
 *                 detail with the subtable refreshed — never a route, which
 *                 would drop the parent's scroll/tab context and refetch it).
 *                 Implemented by pushing the console's record-form URL params
 *                 (`?form=…&formObject=…&formLink=…`) — the ONE global record
 *                 form overlay in `AppContent` picks them up, pre-links the
 *                 parent from `formLink`, sizes to the CHILD object, and on
 *                 save stays put + refetches the child's related lists
 *                 (`notifyRelatedChanged`). URL-driven means browser Back
 *                 closes the overlay and a refresh reopens it STILL correctly
 *                 parent-linked.
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
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RelatedRecordActionsProvider,
  notifyDataChanged,
  useAction,
  type RelatedRecordActionsValue,
  type RelatedRecordHandlers,
  type RelatedRowActionDef,
} from '@object-ui/react';
import type { ActionDef } from '@object-ui/core';
import { resolveCrudAffordances } from '../utils/crudAffordances';
import { RECORD_FORM_PARAM, RECORD_FORM_OBJECT_PARAM, RECORD_FORM_LINK_PARAM } from '../urlParams';

/**
 * Notify open related lists for `objectName` to refetch.
 *
 * Since #2269 this is a thin alias over the data-invalidation bus — the bus
 * dispatches the legacy `objectui:related-changed` window event RelatedList
 * listens for, plus every `useDataInvalidation` reader. Kept for callers
 * whose writes BYPASS the dataSource (row actions over the ActionRunner);
 * dataSource writes need no manual call (the MutationEvent bridge covers
 * them).
 */
export function notifyRelatedChanged(objectName: string): void {
  notifyDataChanged({ objectName });
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
  const [, setSearchParams] = useSearchParams();
  const base = appName ? `/apps/${appName}` : '';

  // #2604 D3 — open a child create/edit task as the console's global record
  // form overlay, by URL params. Pushes ONE history entry (Back = close, the
  // parent detail stays mounted underneath). The read side lives in
  // `AppContent` (see its record-form URL contract).
  const openChildForm = useCallback(
    (opts: { objectName: string; recordId?: string; link?: { field: string; parentId: string | number } }) => {
      const sp = new URLSearchParams(window.location.search);
      sp.set(RECORD_FORM_PARAM, opts.recordId ?? 'new');
      sp.set(RECORD_FORM_OBJECT_PARAM, opts.objectName);
      if (opts.link) sp.set(RECORD_FORM_LINK_PARAM, `${opts.link.field}:${opts.link.parentId}`);
      else sp.delete(RECORD_FORM_LINK_PARAM);
      setSearchParams(sp); // push → Back closes the overlay
    },
    [setSearchParams],
  );

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
            openChildForm({
              objectName,
              link: canLink
                ? { field: relationshipField as string, parentId: parentId as string | number }
                : undefined,
            });
          };
        }
        if (aff.edit) {
          handlers.onEdit = (id) =>
            openChildForm({ objectName, recordId: String(id) });
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
    [objects, base, navigate, dataSource, actionLabel, runRowAction, openChildForm],
  );

  return (
    <RelatedRecordActionsProvider value={value}>{children}</RelatedRecordActionsProvider>
  );
}
