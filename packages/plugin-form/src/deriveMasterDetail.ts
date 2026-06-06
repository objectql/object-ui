/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Derive a master-detail child collection's grid columns + relationship FK from
 * object metadata, so a master-detail form can be configured with just the
 * child object name instead of a hand-authored columns block. Pure (no React /
 * no I/O) so it is unit-testable; the async schema fetch lives in the component.
 */

import type { GridColumn } from '@object-ui/fields';

/** Minimal shape of an object schema as returned by `DataSource.getObjectSchema`. */
export interface ObjectSchemaLike {
  name?: string;
  fields?: Record<string, any>;
}

/** Fields never shown as editable line-item columns. */
const SYSTEM_FIELDS = new Set([
  'id', '_id', 'recordId',
  'created_at', 'updated_at', 'created_by', 'updated_by',
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
  'organization_id', 'tenant_id', 'space', 'owner',
]);

/** Field types that are not directly editable in a line-item grid. */
const NON_EDITABLE_TYPES = new Set([
  'formula', 'summary', 'rollup', 'autonumber', 'auto_number',
  'file', 'image', 'avatar', 'json', 'object', 'grid', 'table',
  'location', 'vector', 'html', 'markdown', 'richtext',
]);

/** Map an ObjectQL field type to a LineItems grid column type. */
export function fieldTypeToColumnType(type: string | undefined): GridColumn['type'] {
  switch (type) {
    case 'number':
    case 'percent':
    case 'rating':
    case 'slider':
      return 'number';
    case 'currency':
      return 'currency';
    case 'date':
    case 'datetime':
    case 'time':
      return 'date';
    case 'select':
    case 'picklist':
    case 'radio':
    case 'boolean':
    case 'toggle':
      return 'select';
    case 'lookup':
    case 'master_detail':
      return 'lookup';
    default:
      return 'text';
  }
}

function optionsFor(def: any): GridColumn['options'] | undefined {
  if (def?.type === 'boolean' || def?.type === 'toggle') {
    return [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ];
  }
  const raw = def?.options;
  if (!Array.isArray(raw)) return undefined;
  return raw.map((o: any) =>
    typeof o === 'object' && o !== null
      ? { label: String(o.label ?? o.value), value: String(o.value) }
      : { label: String(o), value: String(o) },
  );
}

/**
 * Find the field on the child object that points back to the parent — the
 * master_detail/lookup field whose `reference` is the parent object. Prefer
 * `master_detail` over `lookup` when both exist.
 */
export function findRelationshipField(
  childSchema: ObjectSchemaLike | undefined,
  parentObjectName: string,
): string | undefined {
  const fields = childSchema?.fields;
  if (!fields || typeof fields !== 'object') return undefined;
  let lookupMatch: string | undefined;
  for (const [name, def] of Object.entries(fields)) {
    const d = def as any;
    if (d?.reference !== parentObjectName) continue;
    if (d?.type === 'master_detail') return name; // strongest match
    if (d?.type === 'lookup' && !lookupMatch) lookupMatch = name;
  }
  return lookupMatch;
}

/**
 * Derive editable grid columns from a child object's fields, skipping system /
 * audit fields, non-editable types, and the back-reference FK to the parent.
 */
export function deriveColumns(
  childSchema: ObjectSchemaLike | undefined,
  opts: { relationshipField?: string; exclude?: string[] } = {},
): GridColumn[] {
  const fields = childSchema?.fields;
  if (!fields || typeof fields !== 'object') return [];
  const exclude = new Set([...(opts.exclude ?? []), ...(opts.relationshipField ? [opts.relationshipField] : [])]);
  const cols: GridColumn[] = [];
  for (const [name, def] of Object.entries(fields)) {
    const d = def as any;
    if (SYSTEM_FIELDS.has(name) || exclude.has(name)) continue;
    if (d?.system || d?.readonly || d?.hidden) continue;
    if (NON_EDITABLE_TYPES.has(d?.type)) continue;
    const col: GridColumn = {
      field: name,
      label: d?.label || name,
      type: fieldTypeToColumnType(d?.type),
      required: !!d?.required,
    };
    const options = optionsFor(d);
    if (col.type === 'select' && options) col.options = options;
    if (col.type === 'lookup') {
      col.reference = d?.reference;
      col.displayField = d?.display_field || d?.reference_field;
    }
    cols.push(col);
  }
  return cols;
}

export interface DerivedDetail {
  childObject: string;
  relationshipField: string;
  columns: GridColumn[];
  /** First numeric column, used as the running-total source when none is set. */
  amountField?: string;
}

/**
 * Resolve a child collection's full config (FK + columns) from its object
 * schema. Throws when no relationship to the parent can be found. The caller
 * supplies any explicit overrides (relationshipField / columns / amountField),
 * which win over the derived values.
 */
export function deriveDetail(
  childObject: string,
  childSchema: ObjectSchemaLike | undefined,
  parentObjectName: string,
  override: { relationshipField?: string; columns?: GridColumn[]; amountField?: string } = {},
): DerivedDetail {
  const relationshipField = override.relationshipField || findRelationshipField(childSchema, parentObjectName);
  if (!relationshipField) {
    throw new Error(
      `MasterDetailForm: could not find a lookup/master_detail field on "${childObject}" referencing "${parentObjectName}". ` +
      `Set relationshipField explicitly.`,
    );
  }
  const columns = override.columns?.length ? override.columns : deriveColumns(childSchema, { relationshipField });
  const amountField = override.amountField || columns.find((c) => c.type === 'number' || c.type === 'currency')?.field;
  return { childObject, relationshipField, columns, amountField };
}
