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
 *
 * ## The related-list toolbar's create predicates (objectui#4646)
 *
 * `@objectstack/spec@17.0.0` widened `userActions.create` from a bare boolean
 * to `z.union([z.boolean(), RowCrudActionOverrideSchema])`, so
 * `resolveCrudAffordances` now emits `createPredicates` beside the
 * `editPredicates` / `deletePredicates` the row surfaces have consumed since
 * objectui#2614. Nothing read them: the spec's CHANGELOG named "the
 * related-list toolbar honouring `create.visibleWhen`" as objectui's downstream
 * card, and this is that card. A parent record entering a frozen state greyed
 * its children's row Edit/Delete correctly while "+ New" stayed live, so the
 * user filled in the whole child form to earn a 409.
 *
 * The binding is the spec docblock's, not an invention here: unlike the ROW
 * predicates, `createPredicates` evaluates **once per toolbar, against the
 * record of the scope the toolbar sits in** — on a record page's related list
 * that is the HOST PARENT record, which is why `parentRecord` had to be
 * threaded in beside the `parentRecordId` this bridge already carried. (An id
 * cannot answer `record.status != 'frozen'`.) A standalone object list has no
 * record in scope and evaluates nothing — it never reaches this bridge at all.
 *
 * Evaluated WITHOUT a hook, deliberately: `resolve` answers for a VARIABLE
 * number of related lists inside one `useMemo`, so a `useRowPredicate` per
 * child object would tie the hook count to the page's related-list count. This
 * is the same constraint — and the same resolution — as `plugin-grid`'s
 * `evalRowActionVisibility`, whose row loop faces it per action. The evaluator
 * underneath is the canonical one either way (`evalRowPredicate`), and the fail
 * directions below are the record header's verbatim.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RelatedRecordActionsProvider,
  notifyDataChanged,
  useAction,
  useActionTextLocalizer,
  usePredicateScope,
  type ActionTextLocalizer,
  type RelatedRecordActionsValue,
  type RelatedRecordHandlers,
  type RelatedRowActionDef,
} from '@object-ui/react';
import { evalRowPredicate, type ActionDef, type RowCrudPredicates } from '@object-ui/core';
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

/**
 * [#4646] Evaluate one toolbar-scope create predicate the way the record
 * header's edit/delete predicates are evaluated — on the canonical CEL engine,
 * failing CLOSED with a diagnosable warning — but WITHOUT a hook.
 *
 * Mirrors `useRowPredicate(pred, record, { fallback: false, warnOnError: true,
 * label, fields })` exactly, boolean short-circuit included. The short-circuit
 * is not an optimisation: a boolean handed to the engine faults ("AST-only
 * evaluation not yet supported") and would fail closed, which is how
 * `visible: true` once hid a bulk button from everyone (objectui#3492).
 *
 * Hook-free for the reason `plugin-grid`'s `evalRowActionVisibility` is: the
 * caller answers for a VARIABLE number of related lists inside one `useMemo`.
 *
 * Whether a gate was DECLARED is not decided here — each caller below answers
 * that first, by its own rule (`?? true` for `visibleWhen`, `!= null` for
 * `disabledWhen`). An empty predicate that reaches an evaluator is unevaluable
 * and fails closed like any other.
 */
function evalCreatePredicate(
  pred: unknown,
  record: Record<string, any> | null | undefined,
  scope: Record<string, unknown>,
  label: string,
  fields: unknown,
): boolean {
  if (typeof pred === 'boolean') return pred;
  if (pred == null || pred === '') return false;
  return evalRowPredicate(pred as never, record ?? {}, {
    fallback: false,
    scope,
    warnOnError: true,
    label,
    fields: fields as never,
  });
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
  /**
   * [#4646] The parent record ITSELF — the subject the child objects'
   * `userActions.create` predicates are evaluated against, per the spec
   * docblock ("the record in scope where the toolbar renders"). `parentRecordId`
   * above cannot stand in for it: `record.status != 'frozen'` needs the fields,
   * not the key.
   *
   * Omitting it leaves every create predicate unevaluable, which fails CLOSED
   * for `visibleWhen` exactly as it does on the record header — so a host that
   * gates creation on the parent must pass the record, and a host with no
   * parent record in hand should not be declaring create predicates on its
   * children. Hosts that declare none are untouched either way: with no
   * `createPredicates` there is nothing to evaluate.
   */
  parentRecord?: Record<string, any> | null;
  /**
   * [#4646] The PARENT object's field definitions, handed to the predicate for
   * the same reason the row kebab and the record header pass theirs: a relation
   * field must bind as the stored FOREIGN KEY rather than whatever `$expand`
   * substituted for it on this surface, or `record.owner == os.user.id` answers
   * a different question here than it does on the list.
   *
   * The parent's, not the child's — the record being bound is the parent.
   */
  parentObjectFields?: unknown;
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
  parentRecord,
  parentObjectFields,
  children,
}: RelatedRecordActionsBridgeProps) {
  const navigate = useNavigate();
  const { execute } = useAction();
  const [, setSearchParams] = useSearchParams();
  const { getObjectApiOperations, can } = usePermissions();
  // [#4646] The host predicate scope (`features.*` / `os.user.*` / …), read
  // ONCE here rather than per resolved child list — `resolve` is hook-free by
  // construction (see the module note). This is the same scope
  // `useRowPredicate` reads for the record header's edit/delete predicates, so
  // a `create` predicate and an `edit` predicate on the same page see the same
  // globals.
  const predicateScope = usePredicateScope();
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
        const objectCanCreate = rawAff.create && can(objectName, 'create');
        // [#4646] The per-scope layer, on top of the object-level verdict above.
        // Surfaced only when that verdict passed — the same posture
        // `resolveRowCrudAffordances` takes for the row predicates
        // (`editPredicates: canEdit ? aff.editPredicates : undefined`): a
        // predicate cannot re-open an affordance the bucket, the effective API
        // operations or the principal's grant already closed.
        const createPredicates: RowCrudPredicates | undefined = objectCanCreate
          ? rawAff.createPredicates
          : undefined;
        /**
         * `visibleWhen` — fails CLOSED, and counts as DECLARED by `!= null`
         * rather than by truthiness, so `visibleWhen: false` hides "+ New"
         * instead of reading as "ungated" (the objectui#3492 invariant).
         * `?? true` expresses the ungated default as a boolean, which the
         * evaluator short-circuits without touching the engine — so a child
         * object with no `userActions.create` predicates takes no evaluation at
         * all and this gate is a literal `true`.
         */
        const createVisible = evalCreatePredicate(
          createPredicates?.visibleWhen ?? true,
          parentRecord,
          predicateScope,
          'builtin:create:visibleWhen',
          parentObjectFields,
        );
        /**
         * `disabledWhen` — fails SOFT (an unevaluable predicate must not grey a
         * button forever), and the `!= null` gate lives OUTSIDE the evaluation,
         * so `disabledWhen: ''` reads as "no condition" rather than as
         * "disable". Verbatim the posture of the record header (PR #4515) and
         * of `DataTableBuiltinRowActionItem`.
         */
        const createDisabled =
          createPredicates?.disabledWhen != null &&
          evalCreatePredicate(
            createPredicates.disabledWhen,
            parentRecord,
            predicateScope,
            'builtin:create:disabledWhen',
            parentObjectFields,
          );
        const aff = {
          ...rawAff,
          create: objectCanCreate && createVisible,
          edit: rawAff.edit && can(objectName, 'update'),
          delete: rawAff.delete && can(objectName, 'delete'),
        };
        const handlers: RelatedRecordHandlers = {
          // Viewing a child record is always allowed when the list is visible.
          // Same builder the lookup links use — `recordHref` above.
          onView: (id) => openRecord(objectName, id),
        };

        if (aff.create) {
          // [#4646] Greyed, not gone: `onCreate` is still supplied so the list
          // keeps offering "+ New" as a visible-but-inert affordance. The
          // hidden case is `aff.create` being false above.
          if (createDisabled) handlers.createDisabled = true;
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
    // `parentRecord` / `parentObjectFields` / `predicateScope` join the deps for
    // the #4646 create predicates: a parent record that changes (a save, a
    // status transition) must re-resolve "+ New" for every related list under
    // it, or the toolbar keeps answering for the record's previous state.
    [objects, base, dataSource, localizeActionTexts, runRowAction, openChildForm, recordHref, openRecord, getObjectApiOperations, can, parentRecord, parentObjectFields, predicateScope],
  );

  return (
    <RelatedRecordActionsProvider value={value}>{children}</RelatedRecordActionsProvider>
  );
}
