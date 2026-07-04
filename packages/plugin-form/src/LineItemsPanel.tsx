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
import { applyDetail } from './masterDetailTx';

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
}

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
    let cancelled = false;
    ds.getObjectSchema(schema.childObject)
      .then((s: any) => { if (!cancelled) setChildSchema(s ?? null); })
      .catch(() => { if (!cancelled) setChildSchema(null); });
    return () => { cancelled = true; };
  }, [dataSource, schema.childObject]);

  const load = useCallback(async () => {
    if (!dataSource || !parentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await dataSource.find(schema.childObject, {
        $filter: { [schema.relationshipField]: parentId },
        $top: 500,
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
  }, [dataSource, parentId, schema.childObject, schema.relationshipField]);

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
      await applyDetail(dataSource, parentObject || schema.childObject, parentId, {
        childObject: schema.childObject,
        relationshipField: schema.relationshipField,
        rows,
        original,
        amountField: schema.amountField,
        // only roll up when we know the parent object to write the total onto
        totalField: parentObject ? schema.totalField : undefined,
        // Strip computed / read-only columns from each child row payload.
        childSchema,
      });
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
