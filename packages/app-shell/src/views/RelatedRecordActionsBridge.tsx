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
 * Each affordance is gated by {@link resolveEffectiveCrudAffordances} so system /
 * append-only children never show New / Edit / Delete. When this bridge is
 * absent (e.g. the Studio designer) the related list stays read-only.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RelatedRecordActionsProvider,
  notifyDataChanged,
  useAction,
  useActionTextLocalizer,
  type ActionTextLocalizer,
  type RelatedRecordActionsValue,
  type RelatedRecordHandlers,
  type RelatedRowActionDef,
} from '@object-ui/react';
import type { ActionDef } from '@object-ui/core';
import { usePermissions } from '@object-ui/permissions';
import { resolveEffectiveCrudAffordances } from '../utils/crudAffordances';
import { RECORD_FORM_PARAM, RECORD_FORM_OBJECT_PARAM, RECORD_FORM_LINK_PARAM, RECORD_TRAIL_PARAM, appendRecordTrail } from '../urlParams';

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

export interface RelatedRecordActionsBridgeProps {
  /** Current app segment used to build `/apps/:appName/...` routes. */
  appName?: string;
  /** All object definitions (to resolve the child object + its actions). */
  objects: any[];
  /** Data source for delete + action dispatch. */
  dataSource: any;
  /**
   * The record this bridge is mounted under — the PARENT of any related row a
   * user drills into. Threaded into the child record's `?from=` trail so the
   * breadcrumb can offer a path back (`Account → #parent → Invoice → #child`).
   * Omit when there is no parent context (e.g. a standalone list).
   */
  parentObjectName?: string;
  parentRecordId?: string;
  parentTitle?: string;
  children: React.ReactNode;
}

/**
 * Derive the child object's actions for a related-list location
 * (`list_item` → row menu, `list_toolbar` → header buttons), localized and
 * shaped for the related-list bridge.
 */
function deriveActions(
  childDef: any,
  localizeActionTexts: ActionTextLocalizer,
  location: 'list_item' | 'list_toolbar',
): RelatedRowActionDef[] {
  const actions = Array.isArray(childDef?.actions) ? childDef.actions : [];
  return actions
    .filter((a: any) => Array.isArray(a?.locations) && a.locations.includes(location))
    // One bundle entry, one fate (objectui#4265): the row menu's label used to
    // be the ONLY string resolved here, so `runRowAction` below dispatched the
    // child action's `confirmText` / `successMessage` in the authored language
    // next to a translated menu item.
    .map((a: any) => localizeActionTexts(childDef.name, a) as RelatedRowActionDef);
}

export function RelatedRecordActionsBridge({
  appName,
  objects,
  dataSource,
  parentObjectName,
  parentRecordId,
  parentTitle,
  children,
}: RelatedRecordActionsBridgeProps) {
  const navigate = useNavigate();
  const { execute } = useAction();
  const [, setSearchParams] = useSearchParams();
  const { getObjectApiOperations, can } = usePermissions();
  // The child action's authored strings go through the ONE shared resolver
  // (objectui#4265). This used to arrive as an `actionLabel` prop injected by
  // RecordDetailView — an injection point that could only ever carry the LABEL,
  // which is precisely how the row menu ended up translated while its confirm
  // dialog stayed in the authored language.
  const localizeActionTexts = useActionTextLocalizer();
  const base = appName ? `/apps/${appName}` : '';

  /** Objects this host can route to — the record route exists per object def. */
  const routableObjects = useMemo(
    () => new Set((objects ?? []).map((o: any) => o?.name).filter(Boolean)),
    [objects],
  );

  /**
   * THE record-detail URL builder for this page — one route shape, one place.
   *
   * Serves both the related list's row navigation (`onView`, below) and, since
   * objectui#4336, the lookup values rendered anywhere under this bridge: a
   * lookup points at a record of another object, and `LookupCellRenderer` has
   * no router, so it asks for the href instead of re-deriving `/apps/:app/
   * :object/record/:id` a second time (the #4472 lesson — one resolver).
   *
   * `null` when the host cannot route there (no app segment, or an object that
   * is not in this console's metadata), which renders as the plain value.
   */
  const recordHref = useCallback(
    (objectName: string, recordId: string | number): string | null => {
      if (!base || !objectName || !routableObjects.has(objectName)) return null;
      const url = `${base}/${objectName}/record/${encodeURIComponent(String(recordId))}`;
      // Carry the parent record into the target's `?from=` trail so the
      // breadcrumb (and the record body's back link) can path back up.
      // Read the current trail off the live URL — this bridge outlives a
      // single search-params snapshot, so a fresh read avoids a stale
      // closure and keeps nested drill-ins accumulating correctly.
      if (parentObjectName && parentRecordId) {
        const rawFrom = new URLSearchParams(window.location.search).get(RECORD_TRAIL_PARAM);
        const trail = appendRecordTrail(rawFrom, {
          o: parentObjectName,
          i: parentRecordId,
          ...(parentTitle ? { t: parentTitle } : {}),
        });
        const sp = new URLSearchParams();
        sp.set(RECORD_TRAIL_PARAM, trail);
        return `${url}?${sp.toString()}`;
      }
      return url;
    },
    [base, routableObjects, parentObjectName, parentRecordId, parentTitle],
  );

  /** SPA-navigate to the destination {@link recordHref} addresses. */
  const openRecord = useCallback(
    (objectName: string, recordId: string | number) => {
      const href = recordHref(objectName, recordId);
      if (href) navigate(href);
    },
    [recordHref, navigate],
  );

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
      // Same dispatch shape as ObjectGrid.onActionDef: a metadata action's
      // `params` is the ActionParam[] COLLECTION DEFINITION — surface it as
      // `actionParams` (the runner's param-dialog input) and reserve `params`
      // for the `_rowRecord` stash (apiHandler row-id injection +
      // `defaultFromRow` prefill). Spreading the array into `params` used to
      // produce `{0: {...}}`, which downstream consumers sent to the data API
      // as a fields map → INVALID_FIELD: Unknown field '0'.
      const { params: rawParams, ...rest } = action as unknown as ActionDef & { params?: unknown };
      const def: any = {
        ...rest,
        objectName: childObject,
        ...(id != null ? { recordId: String(id) } : {}),
        params: { _rowRecord: record },
      };
      if (Array.isArray(rawParams) && rawParams.length > 0) {
        def.actionParams = rawParams;
      }
      const res = await execute(def as ActionDef);
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
        // [#3546] Intersect the child object's bucket affordances with the
        // server-resolved effective API operation set for THAT child
        // (`/me/permissions` `apiOperations`), so a related list never offers
        // Create/Edit/Delete on the child the server would 405. `undefined`
        // (unrestricted / old backend) leaves the affordances untouched.
        //
        // [#4096] …then with the CURRENT PRINCIPAL's permission on the child
        // (`allowCreate` / `allowEdit` / `allowDelete`). `apiOperations` is the
        // child object's exposure surface and is identical for every account,
        // so on its own it fails open: a related list used to offer Edit and
        // Delete to a principal with no write grant on the child. `can()`
        // answers `true` with no `PermissionProvider`, which keeps standalone
        // embeds exactly where they were.
        const rawAff = resolveEffectiveCrudAffordances(childDef, getObjectApiOperations(objectName));
        const aff = {
          ...rawAff,
          create: rawAff.create && can(objectName, 'create'),
          edit: rawAff.edit && can(objectName, 'update'),
          delete: rawAff.delete && can(objectName, 'delete'),
        };
        const handlers: RelatedRecordHandlers = {
          // Viewing a child record is always allowed when the list is visible.
          // Same builder the lookup links use — `recordHref` above.
          onView: (id) => openRecord(objectName, id),
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

        const rowActions = deriveActions(childDef, localizeActionTexts, 'list_item');
        if (rowActions.length > 0) {
          handlers.rowActions = rowActions;
          handlers.onRowAction = (action, record) =>
            runRowAction(objectName, record, action);
        }

        // List-level actions (e.g. sys_invitation's `invite_user`) render as
        // header buttons — the related-list equivalent of the object list's
        // toolbar. Executed through the same dispatch as row actions, just
        // without a row record.
        const toolbarActions = deriveActions(childDef, localizeActionTexts, 'list_toolbar');
        if (toolbarActions.length > 0) {
          handlers.toolbarActions = toolbarActions;
          handlers.onToolbarAction = (action) =>
            runRowAction(objectName, undefined, action);
        }

        return handlers;
      },
      recordHref,
      openRecord,
    }),
    [objects, base, dataSource, localizeActionTexts, runRowAction, openChildForm, recordHref, openRecord, getObjectApiOperations, can],
  );

  return (
    <RelatedRecordActionsProvider value={value}>{children}</RelatedRecordActionsProvider>
  );
}
