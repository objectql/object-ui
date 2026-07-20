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
import { useRecordContext, useSafeFieldLabel, useRelatedRecordActions } from '@object-ui/react';
import { useFieldPermissions, usePermissions } from '@object-ui/permissions';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import { humanizeLabel } from '@object-ui/fields';
import type { RecordRelatedListComponentProps } from '@object-ui/types';
import { RelatedList } from '../RelatedList';

/** Normalize a column entry (string | {field} | {name} | {key}) to its name. */
const colName = (entry: any): string | null => {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') return entry.field || entry.name || entry.key || null;
  return null;
};

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

export const RecordRelatedListRenderer: React.FC<RecordRelatedListRendererProps> = ({
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

  if (!objectName) {
    return (
      <div className={className} {...designer}>
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:related_list — missing objectName
        </div>
      </div>
    );
  }

  const perms = usePermissions();
  const { readableFields } = useFieldPermissions(objectName);

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

export default RecordRelatedListRenderer;
