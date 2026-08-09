/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:related_list` — renders a list of records related to the current
 * record (parent-child / lookup back-reference). Props mirror the spec
 * `RecordRelatedListComponentProps` shape; the existing RelatedList expects
 * the legacy `referenceField` / `pageSize` names, so we adapt here.
 */

import React from 'react';
import {
  ElementDataSourceGate,
  useRecordContext,
  useSafeFieldLabel,
  useRelatedRecordActions,
  type ElementDataSourceMapping,
} from '@object-ui/react';
import { useFieldPermissions, usePermissions } from '@object-ui/permissions';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import { humanizeLabel } from '@object-ui/fields';
import { columnIdentity } from '@object-ui/core';
import type { RecordRelatedListComponentProps } from '@object-ui/types';
import { RelatedList } from '../RelatedList';

/**
 * Normalize a column entry (string | {field} | {name} | {key}) to its name.
 * `key` is kept as a tail fallback rather than folded into `columnIdentity`:
 * it is a generic entry key, not ObjectStack metadata identity (#3104).
 */
const colName = (entry: any): string | null =>
  columnIdentity(entry) || (entry && typeof entry === 'object' ? entry.key : null) || null;

/** Extract a record's primary key, tolerating the `id` / `_id` split. */
const rowId = (row: any): string | number | null => row?.id ?? row?._id ?? null;

/**
 * Spec default for `RecordRelatedListProps.limit` (`.default(5)` — "Number of
 * records to display initially"). Zod materializes defaults only when the
 * metadata passes through a spec parse; the synthesized default record page
 * hands us raw nodes, so the renderer enforces the contract's default itself
 * (issue #2711 — without it related lists rendered ALL child rows unpaged).
 */
const SPEC_DEFAULT_LIMIT = 5;

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordRelatedListRendererProps {
  schema?: RecordRelatedListComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

const RecordRelatedListBody: React.FC<RecordRelatedListRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);
  const i18n = useSafeFieldLabel();
  const { language } = useObjectTranslation();

  const objectName = schema.objectName;

  // Resolve a human-friendly title:
  //   1. authored `schema.title` wins — via pickLocalized so inline-i18n
  //      shapes (`{ en, 'zh-CN' }`) resolve instead of rendering "[object Object]"
  //   2. translated object label via i18n (key `objects.{name}.label`)
  //   3. humanized objectName (e.g. `opportunity_quote` → "Opportunity Quote")
  //   4. literal `'Related'` as final fallback
  const resolvedObjectLabel = objectName && (i18n as any).objectLabel
    ? (i18n as any).objectLabel({ name: objectName, label: humanizeLabel(objectName) })
    : objectName
      ? humanizeLabel(objectName)
      : '';
  const title = pickLocalized(schema.title, language) || resolvedObjectLabel || 'Related';

  const perms = usePermissions();
  const { readableFields } = useFieldPermissions(objectName || '');

  // Host-provided CRUD + action handlers for this child object. Absent when no
  // host wired the provider (Studio designer, standalone embed) — the related
  // list then stays read-only. The host decides, per child object, which of
  // create / edit / delete / view it exposes (lifecycle affordances + FLS), so
  // we simply wire whatever comes back. `resolve` is passed the relationship so
  // a newly-created child is pre-linked to the current parent.
  // [ADR-0090 SDUI panels] Which PARENT field the junction's relationshipField
  // stores (spec `relationshipValueField`, default 'id'). Name-keyed junctions
  // (e.g. sys_user_position.position stores sys_position.name) set 'name' —
  // the resolved value drives the list filter, the Add-picker link value, AND
  // the pre-filled create form, so all three stay consistent. While the parent
  // record is still loading a non-id value resolves to null, which RelatedList
  // treats as "don't fetch yet".
  const relationshipValueField: string = (schema as any).relationshipValueField || 'id';
  const parentLinkValue: string | number | null =
    relationshipValueField === 'id'
      ? ((ctx?.recordId ?? null) as string | number | null)
      : ((ctx?.data as any)?.[relationshipValueField] ?? null);

  const relatedActions = useRelatedRecordActions();
  const handlers = React.useMemo(
    () =>
      relatedActions?.resolve({
        objectName,
        relationshipField: schema.relationshipField,
        parentId: parentLinkValue,
      }) ?? null,
    [relatedActions, objectName, schema.relationshipField, parentLinkValue],
  );

  // Missing objectName renders a designer placeholder — checked AFTER the hooks
  // above so hook order stays stable across renders.
  if (!objectName) {
    return (
      <div className={className} {...designer}>
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:related_list — missing objectName
        </div>
      </div>
    );
  }

  // Automatic object-level read gate (objectui#2359). Related lists surface
  // the CHILD object's records, so they require `read` on that object — the
  // schema author never has to remember an explicit `requiredPermissions`
  // opt-in for this baseline. When the permission system has loaded and
  // denies read, the whole section vanishes (no header, no empty grid, no
  // "New" button that would 403 on save). Gated on `isLoaded` so unmounted /
  // still-loading permission contexts (Studio designer, standalone embeds)
  // keep rendering — the server enforces data access either way.
  if (perms.isLoaded && !perms.can(objectName, 'read')) {
    return null;
  }

  const required: string[] = Array.isArray((schema as any).requiredPermissions)
    ? (schema as any).requiredPermissions
    : [];
  if (required.length > 0) {
    const ok = required.every((p) => perms.can(objectName, p as any));
    if (!ok) {
      return (
        <div className={className} {...designer} role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground italic">
            Insufficient permissions to view related list.
          </p>
        </div>
      );
    }
  }

  const enforceFLS = (schema as any).enforceFieldSecurity === true;
  const redact: string[] = Array.isArray((schema as any).redactFields)
    ? (schema as any).redactFields
    : [];
  const rawColumns: any[] = Array.isArray(schema.columns) ? (schema.columns as any[]) : [];
  let filteredColumns: any[] = rawColumns;
  if (enforceFLS || redact.length > 0) {
    const names = rawColumns.map(colName).filter((n): n is string => !!n);
    const allowed = new Set(
      (enforceFLS ? readableFields(names) : names).filter((n) => !redact.includes(n)),
    );
    filteredColumns = rawColumns.filter((c) => {
      const n = colName(c);
      return n ? allowed.has(n) : true;
    });
  }

  return (
    <div className={className} {...designer}>
      <RelatedList
        title={title}
        type="table"
        api={objectName}
        objectName={objectName}
        referenceField={schema.relationshipField}
        parentId={parentLinkValue as any}
        columns={filteredColumns as any}
        pageSize={
          typeof schema.limit === 'number' && schema.limit > 0
            ? schema.limit
            : SPEC_DEFAULT_LIMIT
        }
        defaultSort={schema.sort}
        dataSource={ctx?.dataSource as any}
        add={
          (schema as any).add
            ? {
                ...(schema as any).add,
                // The Add-button label may carry inline translations too.
                label: pickLocalized((schema as any).add.label, language) || undefined,
              }
            : undefined
        }
        rowActions={handlers?.rowActions}
        onRowAction={handlers?.onRowAction}
        toolbarActions={handlers?.toolbarActions}
        onToolbarAction={handlers?.onToolbarAction}
        // Create a new child, pre-linked to this parent (增). Host omits when
        // create is denied by lifecycle/permissions, hiding the "New" button.
        onNew={handlers?.onCreate}
        // Open the child record's detail page on row click (查看记录详情).
        onRowClick={
          handlers?.onView
            ? (row: any) => {
                const id = rowId(row);
                if (id != null) handlers.onView!(id, row);
              }
            : undefined
        }
        // Open the child record's edit form (改).
        onRowEdit={
          handlers?.onEdit
            ? (row: any) => {
                const id = rowId(row);
                if (id != null) handlers.onEdit!(id, row);
              }
            : undefined
        }
        onRowDelete={
          // Delete the child record (删). Prefer the host handler (gated by
          // lifecycle affordance + permissions); fall back to the generic
          // link/junction remove when an `add` config is present so managed
          // assignment lists keep working without a host provider. RelatedList
          // shows the confirm dialog and refreshes after this resolves.
          handlers?.onDelete
            ? (row: any) => {
                const id = rowId(row);
                if (id != null) return handlers.onDelete!(id, row);
              }
            : (schema as any).add && ctx?.dataSource
              ? async (row: any) => {
                  const id = row?.id ?? row?._id;
                  if (id != null) await (ctx!.dataSource as any).delete?.(objectName, String(id));
                }
              : undefined
        }
      />
    </div>
  );
};

/**
 * What this block reads for its own query: `objectName`, `columns` (a FIELD
 * list), `sort` (`defaultSort`) and `limit` (`pageSize`).
 *
 * `filter` is NOT mapped, and that is a finding rather than a choice: this
 * renderer declares `filter` in its registry `inputs` ("Additional filter
 * criteria") and never reads it — `RelatedList` builds its query from
 * `{ [referenceField]: parentId }` alone and takes no filter prop for the list's
 * own scope. Mapping the composed filter onto `schema.filter` would hand it to a
 * key nothing consumes, which is the defect objectstack#6953 removes rather than
 * spreads. The consequence is recorded honestly: while that gap is open, a saved
 * view named here contributes its columns/sort/limit and its FILTER is dropped,
 * so the list can be wider than the view it names. Filed as objectstack#7118;
 * when the flat `filter` gains a read site, `filter: true` belongs in this
 * mapping and the binding follows it for free.
 */
const RECORD_RELATED_LIST_DATA_SOURCE: ElementDataSourceMapping = {
  columns: true,
  sort: true,
  limit: 'limit',
};

/**
 * Stable stand-in for a missing `schema`. A fresh `{}` per render would give the
 * body a new schema identity every time — the churn `useElementDataSourceSchema`
 * avoids by returning the schema BY REFERENCE when there is no binding.
 */
const NO_SCHEMA = {} as RecordRelatedListRendererProps['schema'];

/**
 * `record:related_list` with the spec's per-element `dataSource` binding mapped
 * onto the keys the body reads (objectstack#6953).
 *
 * The gate wraps the EXPORTED name rather than being added at the registration
 * site, so a host that imports this renderer directly gets the binding too — a
 * block bound under one entry point and unbound under another is the same
 * "declared but not reached" shape in miniature.
 */
export const RecordRelatedListRenderer: React.FC<RecordRelatedListRendererProps> = (props) => {
  // The record context's adapter, not the schema-renderer context's: this list
  // reads its rows through `ctx.dataSource`, and resolving `view` against a
  // different source than the rows come from could report a view as missing on
  // a host that has it.
  const ctx = useRecordContext();
  return (
    <ElementDataSourceGate
      schema={props.schema ?? NO_SCHEMA}
      mapping={RECORD_RELATED_LIST_DATA_SOURCE}
      dataSource={ctx?.dataSource}
      testId="record-related-list"
      errorTitle="This related list’s data source could not be resolved"
    >
      {(bound) => <RecordRelatedListBody {...props} schema={bound as any} />}
    </ElementDataSourceGate>
  );
};

export default RecordRelatedListRenderer;
