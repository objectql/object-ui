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
import { useRecordContext, useSafeFieldLabel } from '@object-ui/react';
import { useFieldPermissions, usePermissions } from '@object-ui/permissions';
import { humanizeLabel } from '@object-ui/fields';
import type { RecordRelatedListComponentProps } from '@object-ui/types';
import { RelatedList } from '../RelatedList';

/** Normalize a column entry (string | {field} | {name} | {key}) to its name. */
const colName = (entry: any): string | null => {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') return entry.field || entry.name || entry.key || null;
  return null;
};

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

  const objectName = schema.objectName;

  // Resolve a human-friendly title:
  //   1. authored `schema.title` wins
  //   2. translated object label via i18n (key `objects.{name}.label`)
  //   3. humanized objectName (e.g. `opportunity_quote` → "Opportunity Quote")
  //   4. literal `'Related'` as final fallback
  const resolvedObjectLabel = objectName && (i18n as any).objectLabel
    ? (i18n as any).objectLabel({ name: objectName, label: humanizeLabel(objectName) })
    : objectName
      ? humanizeLabel(objectName)
      : '';
  const title = schema.title || resolvedObjectLabel || 'Related';

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
        parentId={ctx?.recordId as any}
        columns={filteredColumns as any}
        pageSize={schema.limit}
        dataSource={ctx?.dataSource as any}
        add={(schema as any).add}
        onRowDelete={
          // Generic remove for link/junction rows: delete the related row itself.
          // RelatedList refreshes after this resolves. Only wired when an `add`
          // config is present (i.e. this is a managed assignment list), so plain
          // read-only related lists keep their existing behavior.
          (schema as any).add && ctx?.dataSource
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
