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
 *                 Create pre-links the parent via
 *                 `initialValues[relationshipField] = parentId`; the overlay
 *                 sizes to the CHILD object (heavy child → full-screen modal).
 *                 On save the parent stays put and only the child's related
 *                 lists refetch (`notifyRelatedChanged`).
 *   - 删        → `dataSource.delete(child, id)` (RelatedList shows the confirm
 *                 dialog and refreshes afterwards)
 *   - 子对象 action → the child object's `list_item` actions, executed against
 *                 the clicked row through the page's shared ActionRunner
 *
 * Each affordance is gated by {@link resolveCrudAffordances} so system /
 * append-only children never show New / Edit / Delete. When this bridge is
 * absent (e.g. the Studio designer) the related list stays read-only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RelatedRecordActionsProvider,
  useAction,
  type RelatedRecordActionsValue,
  type RelatedRecordHandlers,
  type RelatedRowActionDef,
} from '@object-ui/react';
import type { ActionDef } from '@object-ui/core';
import { ModalForm } from '@object-ui/plugin-form';
import { deriveRecordFlowSurface } from '@object-ui/plugin-view';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import { resolveCrudAffordances } from '../utils/crudAffordances';
import { resolveFormViewLayout } from '../utils/recordFormNavigation';

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

/** A child create/edit task opened as an overlay over the parent detail. */
interface ChildFormTask {
  objectName: string;
  mode: 'create' | 'edit';
  recordId?: string;
  /** Create-mode parent pre-link: `{ [relationshipField]: parentId }`. */
  initialValues?: Record<string, unknown>;
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
  const { t } = useObjectTranslation();
  const { objectLabel } = useObjectLabel();
  const [searchParams, setSearchParams] = useSearchParams();
  const base = appName ? `/apps/${appName}` : '';

  // #2604 D3 — the child form overlay. The task PAYLOAD (mode/recordId/parent
  // pre-link) lives in component state: it is not URL-recoverable (a refreshed
  // `?childForm=1` could not rebuild the parent link and would silently create
  // an UNLINKED child). The URL only carries a marker param so browser Back
  // closes the overlay instead of leaving the parent detail.
  const [childTask, setChildTask] = useState<ChildFormTask | null>(null);
  const childFormMarker = searchParams.get('childForm') === '1';

  const openChildTask = useCallback((task: ChildFormTask) => {
    setChildTask(task);
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('childForm') !== '1') {
      sp.set('childForm', '1');
      setSearchParams(sp); // push → one history entry; Back = close
    }
  }, [setSearchParams]);

  const closeChildTask = useCallback(() => {
    setChildTask(null);
    const sp = new URLSearchParams(window.location.search);
    if (sp.has('childForm')) {
      sp.delete('childForm');
      setSearchParams(sp, { replace: true });
    }
  }, [setSearchParams]);

  // Marker↔state sync: Back removed the marker → drop the task; marker present
  // without a task (refresh / hand-built deep link — payload unrecoverable) →
  // strip the stale marker.
  useEffect(() => {
    if (!childFormMarker && childTask) {
      setChildTask(null);
    } else if (childFormMarker && !childTask) {
      const sp = new URLSearchParams(window.location.search);
      sp.delete('childForm');
      setSearchParams(sp, { replace: true });
    }
  }, [childFormMarker, childTask, setSearchParams]);

  // Save invariant (#2604): the parent detail never navigates — only the
  // child's open related lists refetch.
  const handleChildSuccess = useCallback(async () => {
    if (childTask) notifyRelatedChanged(childTask.objectName);
    closeChildTask();
  }, [childTask, closeChildTask]);

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
            openChildTask({
              objectName,
              mode: 'create',
              initialValues: canLink
                ? { [relationshipField as string]: parentId }
                : undefined,
            });
          };
        }
        if (aff.edit) {
          handlers.onEdit = (id) =>
            openChildTask({ objectName, mode: 'edit', recordId: String(id) });
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
    [objects, base, navigate, dataSource, actionLabel, runRowAction, openChildTask],
  );

  const childDef = childTask
    ? objects.find((o: any) => o?.name === childTask.objectName)
    : null;

  return (
    <RelatedRecordActionsProvider value={value}>
      {children}
      {childTask && childDef && (
        <ModalForm
          key={childTask.recordId ?? 'new'}
          schema={{
            type: 'object-form',
            formType: 'modal',
            objectName: childTask.objectName,
            mode: childTask.mode,
            recordId: childTask.recordId,
            initialValues: childTask.initialValues,
            // #2604 D1/D3: overlay size follows the CHILD object's own derived
            // flow surface — a fat child gets the full-screen modal, a thin
            // one keeps the auto-sized modal. Form-view layout (spread after)
            // stays authoritative for sections/subforms.
            ...(deriveRecordFlowSurface(childDef, childTask.mode === 'create' ? 'child-create' : 'child-edit').size === 'full'
              ? { modalSize: 'full' as const }
              : {}),
            ...resolveFormViewLayout(childDef),
            title: childTask.mode === 'edit'
              ? t('form.editTitle', { object: objectLabel(childDef), defaultValue: `Edit ${objectLabel(childDef)}` })
              : t('form.createTitle', { object: objectLabel(childDef), defaultValue: `New ${objectLabel(childDef)}` }),
            open: true,
            onOpenChange: (open: boolean) => { if (!open) closeChildTask(); },
            layout: 'vertical',
            onSuccess: handleChildSuccess,
            onCancel: closeChildTask,
            showSubmit: true,
            showCancel: true,
            submitText: childTask.mode === 'edit'
              ? t('form.update', { defaultValue: t('common.save', { defaultValue: 'Save' }) })
              : t('form.create', { defaultValue: t('common.create', { defaultValue: 'Create' }) }),
            cancelText: t('common.cancel', { defaultValue: 'Cancel' }),
          }}
          dataSource={dataSource}
        />
      )}
    </RelatedRecordActionsProvider>
  );
}
