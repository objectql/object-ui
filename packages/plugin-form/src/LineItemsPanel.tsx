/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * LineItemsPanel — the `record:line_items` component. Renders a child "line
 * items" grid bound to an EXISTING parent record (on a record/detail page or
 * a slotted page slot). Loads children by FK, lets the user add/edit/delete
 * rows, and persists the diff on Save. See ADR-0001.
 *
 * Parent id is taken from the component props (`recordId`/`parentId`) or from
 * the surrounding <RecordContextProvider>. dataSource comes from the
 * SchemaRenderer context.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from '@object-ui/components';
import { LineItemsField, type GridColumn } from '@object-ui/fields';
import { useSchemaContext, useRecordContext } from '@object-ui/react';
import { buildMasterDetailEditBatch, sumRows } from './masterDetailTx';
import {
  runBatchTransaction,
  mergeFilterNodes,
  toFilterNode,
  convertSortToQueryParams,
} from '@object-ui/core';

export interface LineItemsPanelSchema {
  type?: 'record:line_items';
  childObject: string;
  relationshipField: string;
  columns: GridColumn[];
  parentObject?: string;
  parentId?: string;
  recordId?: string;
  amountField?: string;
  totalField?: string;
  title?: string;
  readonly?: boolean;
  minRows?: number;
  maxRows?: number;
  /**
   * *Additional* criteria for the child rows, in any shape `toFilterNode`
   * accepts (spec `ViewFilterRule[]`, ObjectQL AST nodes, or a MongoDB-style
   * object).
   *
   * AND-combined with the parent relationship condition, never substituted for
   * it (objectstack#7137, exactly as `record:related_list` does since
   * objectstack#7118): a line-items panel is always scoped to the record it sits
   * on, so an additional criterion can only narrow this parent's children — it
   * can never surface another parent's rows. When a `dataSource` binding is
   * present, `ElementDataSourceGate` has already AND-combined this key with the
   * view's filter and the binding's own before the schema arrives here.
   */
  filter?: any[] | Record<string, any>;
  /**
   * Load order for the child rows — the legacy `"line_no desc"` clause or the
   * spec's `SortConfig[]`. Without one the rows arrive in storage order.
   */
  sort?: string | Array<{ field?: string; order?: 'asc' | 'desc' }>;
  /**
   * Row cap for the child fetch; defaults to {@link DEFAULT_LINE_ITEMS_LIMIT}.
   * A line-items grid has no pagination control — every loaded row is editable
   * and saved as one batch — so this is the author's window, not a page size.
   */
  limit?: number;
}

/**
 * Child rows fetched when the author declared no `limit` — the window this panel
 * has always used, now authorable (objectstack#7137).
 */
export const DEFAULT_LINE_ITEMS_LIMIT = 500;

export const LineItemsPanel: React.FC<{ schema: LineItemsPanelSchema }> = ({ schema }) => {
  const ctx = useSchemaContext() as any;
  const dataSource = ctx?.dataSource;
  // useRecordContext returns null outside a <RecordContextProvider> (e.g. in the
  // Studio designer/palette), so it never throws — call it unconditionally to
  // keep hook order stable across renders. A null record just means "no parent
  // record bound", which the optional chaining below already handles.
  const record = useRecordContext() as any;

  const parentObject = schema.parentObject || record?.objectName;
  const parentId =
    schema.parentId || schema.recordId || (record?.recordId as string | undefined);

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [original, setOriginal] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Child object schema — used to strip computed / read-only columns from each
  // row before persisting (parity with the parent form's sanitize). Rows are
  // loaded from a full read, so an edit would otherwise round-trip formula /
  // summary columns the server rejects as unknown fields.
  const [childSchema, setChildSchema] = useState<{ fields?: Record<string, any> } | null>(null);
  useEffect(() => {
    const ds: any = dataSource;
    if (!ds || typeof ds.getObjectSchema !== 'function') return;
    // Decline to fetch when the child object never resolved (objectui#6188).
    // `childObject` is declared `required: true` on this block's registry entry
    // and typed `string` above, but nothing enforces either — `inputs[].required`
    // is designer metadata, and the block has no spec schema — so a node reaches
    // this renderer straight off an authored schema with the key `undefined`, and
    // the fetch below then asked the data layer for an object literally named
    // `undefined`. `RelatedList` already takes the other choice for the same class
    // of missing key ("has no referenceField/parentId — refusing to fetch all
    // rows", RelatedList.tsx), and `MasterDetailForm` declines on this exact key
    // (objectui#5940) with its child-schema cache spelling it `.filter(Boolean)`.
    //
    // Clearing the cache rather than just returning: an unresolvable panel HAS no
    // child schema, and leaving a previous object's schema in place would sanitize
    // the next save against the wrong object's fields. `null` is what the `.catch`
    // below already produces, so the sanitize path needs no new case.
    if (!schema.childObject) {
      setChildSchema(null);
      console.warn(
        `[LineItemsPanel] a line-items panel has no childObject — refusing to fetch its child schema. Set childObject to the child object the panel lists.`,
      );
      return;
    }
    let cancelled = false;
    ds.getObjectSchema(schema.childObject)
      .then((s: any) => { if (!cancelled) setChildSchema(s ?? null); })
      .catch(() => { if (!cancelled) setChildSchema(null); });
    return () => { cancelled = true; };
  }, [dataSource, schema.childObject]);

  // Content keys, not identities: an inline `filter` / `sort` on a schema node is
  // a new object every render and both are inputs to `load` (which an effect
  // below depends on) — keying on identity would refetch the children on every
  // render. Same reason `RelatedList` keys its own scope filter on content.
  const filterKey = JSON.stringify(schema.filter ?? null);
  const sortKey = JSON.stringify(schema.sort ?? null);
  const listFilterNode = useMemo(
    () => toFilterNode(schema.filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on CONTENT, see above
    [filterKey],
  );
  const orderBy = useMemo(
    () => convertSortToQueryParams(schema.sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on CONTENT, see above
    [sortKey],
  );

  const load = useCallback(async () => {
    if (!dataSource || !parentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Parent relationship AND the panel's own criteria (objectstack#7137).
      // The parent condition is not negotiable — an "additional" criterion may
      // only narrow THIS parent's children — and with nothing authored the query
      // is the untouched MongoDB-style object it has always been rather than a
      // freshly lowered AST meaning the same thing (invisible on screen, visible
      // to every caller pinning the wire). Composed through the repo's single
      // filter sink, the same way `record:related_list` composes its own.
      const parentScope = { [schema.relationshipField]: parentId } as Record<string, any>;
      const res = await dataSource.find(schema.childObject, {
        $filter:
          listFilterNode === undefined
            ? parentScope
            : mergeFilterNodes(parentScope, listFilterNode),
        ...(orderBy ? { $orderby: orderBy } : {}),
        $top: schema.limit ?? DEFAULT_LINE_ITEMS_LIMIT,
      });
      const data = (res?.data ?? []) as Record<string, any>[];
      setRows(data.map((r) => ({ ...r })));
      setOriginal(data.map((r) => ({ ...r })));
      setDirty(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to load line items');
    } finally {
      setLoading(false);
    }
  }, [
    dataSource,
    parentId,
    schema.childObject,
    schema.relationshipField,
    schema.limit,
    listFilterNode,
    orderBy,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = useCallback((next: Record<string, any>[]) => {
    setRows(next);
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!dataSource || !parentId) return;
    setSaving(true);
    setError(null);
    try {
      // Only roll the line total up onto the parent when we know the parent
      // object AND a target field — same gate as before. When we do, the parent
      // update rides in the SAME batch as the child writes, so the rollup is now
      // atomic with them (on an adapter that supports it) instead of a separate
      // trailing update.
      const canRollup = !!(parentObject && schema.totalField);
      const parentPatch = canRollup
        ? { [schema.totalField!]: sumRows(rows, schema.amountField || 'amount') }
        : {};
      let ops = buildMasterDetailEditBatch(parentObject ?? '', parentId, parentPatch, [
        {
          childObject: schema.childObject,
          relationshipField: schema.relationshipField,
          rows,
          original,
          // Strip computed / read-only columns from each child row payload.
          childSchema,
        },
      ]);
      // With no parent object / rollup to write, there is nothing to update on
      // the parent — drop op 0. Safe: edit-batch children carry the parentId
      // directly (no $ref), so slicing off the parent op shifts no references.
      if (!canRollup) ops = ops.slice(1);
      if (ops.length) await runBatchTransaction(dataSource, ops);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save line items');
    } finally {
      setSaving(false);
    }
  }, [dataSource, parentId, rows, original, schema, parentObject, load, childSchema]);

  const gridField = useMemo(
    () =>
      ({
        columns: schema.columns,
        total_field: schema.totalField ? schema.amountField || 'amount' : undefined,
        min_rows: schema.minRows,
        max_rows: schema.maxRows,
        allow_add: !schema.readonly,
        allow_delete: !schema.readonly,
      }) as any,
    [schema],
  );

  return (
    <Card className={cn('shadow-none')}>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium">{schema.title || 'Line Items'}</CardTitle>
        {!schema.readonly && (
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={saving || loading || !dirty || !parentId}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : !parentId ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Save the record first to add line items.
          </p>
        ) : (
          <LineItemsField value={rows} onChange={onChange} field={gridField} readonly={schema.readonly} />
        )}
      </CardContent>
    </Card>
  );
};
