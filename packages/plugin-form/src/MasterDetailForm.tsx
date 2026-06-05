/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * MasterDetailForm — enter a parent record together with its child "line
 * items" in a single screen, and persist them as one client-orchestrated
 * transaction (see ADR-0001).
 *
 * The parent fields are rendered by the existing <ObjectForm>; the child
 * collection(s) by <LineItemsField>. On submit we:
 *   1. create/update the parent (ObjectForm owns this, via its `onSuccess`),
 *   2. set the relationship FK on each line and bulk-create them,
 *   3. (optional) roll the line total up onto a parent field,
 *   4. on child failure, best-effort delete the just-created parent and rethrow
 *      so the form surfaces the error with the user's input intact.
 *
 * No `@objectstack/spec` change: the relationship is a `master_detail` (or
 * `lookup`) FK on the child object; there is no server batch endpoint, so the
 * multi-object write is orchestrated here.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DataSource } from '@object-ui/types';
import { LineItemsField, type GridColumn } from '@object-ui/fields';
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from '@object-ui/components';
import { ObjectForm } from './ObjectForm';
import { applyDetail, idOf } from './masterDetailTx';

export interface MasterDetailDetailConfig {
  /** Child object name, e.g. 'expense_line'. */
  childObject: string;
  /** FK field on the child pointing back to the parent, e.g. 'expense_claim'. */
  relationshipField: string;
  /** Editable columns for the child grid. */
  columns: GridColumn[];
  /** Numeric child column to sum, e.g. 'amount'. */
  amountField?: string;
  /** Parent field to receive the rolled-up sum, e.g. 'total_amount'. */
  totalField?: string;
  /** Section title. */
  title?: string;
  minRows?: number;
  maxRows?: number;
  addLabel?: string;
}

export interface MasterDetailFormSchema {
  type?: 'object-master-detail-form';
  /** Parent object name, e.g. 'expense_claim'. */
  objectName: string;
  mode?: 'create' | 'edit';
  recordId?: string;
  /** Parent form sections/fields — passed straight through to ObjectForm. */
  sections?: any[];
  fields?: any[];
  formType?: 'simple' | 'tabbed';
  title?: string;
  submitText?: string;
  /** One or more child collections. */
  details: MasterDetailDetailConfig[];
  onSuccess?: (parent: any) => void | Promise<void>;
  onError?: (err: Error) => void;
  onCancel?: () => void;
  className?: string;
}

/** Rows keyed by their persisted id (when known), for edit-mode diffing. */
interface RowState {
  rows: Record<string, any>[];
  /** Snapshot of the persisted rows (edit mode) for diffing on submit. */
  original: Record<string, any>[];
}

export interface MasterDetailFormProps {
  schema: MasterDetailFormSchema;
  dataSource?: DataSource;
  className?: string;
}

export const MasterDetailForm: React.FC<MasterDetailFormProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const details = schema.details || [];
  const isEdit = schema.mode === 'edit' && !!schema.recordId;

  // One row-state per detail collection.
  const [state, setState] = useState<RowState[]>(() =>
    details.map(() => ({ rows: [], original: [] })),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  // Edit mode: load existing children for each detail collection.
  useEffect(() => {
    let cancelled = false;
    if (!isEdit || !dataSource) return;
    (async () => {
      const loaded = await Promise.all(
        details.map(async (d) => {
          try {
            const res = await dataSource.find(d.childObject, {
              $filter: { [d.relationshipField]: schema.recordId },
              $top: 500,
            });
            const rows = (res?.data ?? []) as Record<string, any>[];
            return { rows: rows.map((r) => ({ ...r })), original: rows.map((r) => ({ ...r })) };
          } catch {
            return { rows: [], original: [] };
          }
        }),
      );
      if (!cancelled) setState(loaded);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, dataSource, schema.recordId]);

  const setRows = useCallback((detailIdx: number, rows: Record<string, any>[]) => {
    setState((prev) => prev.map((s, i) => (i === detailIdx ? { ...s, rows } : s)));
  }, []);

  /** Persist all child collections for a known parent id. Returns created ids
   *  (create mode) so the caller can clean up on a later failure. */
  const persistDetails = useCallback(
    async (parentId: string) => {
      const createdIds: Array<{ object: string; id: string }> = [];
      for (let i = 0; i < details.length; i++) {
        const d = details[i];
        const { rows, original } = stateRef.current[i];
        const { created } = await applyDetail(dataSource!, schema.objectName, parentId, {
          childObject: d.childObject,
          relationshipField: d.relationshipField,
          rows,
          // edit mode diffs against the loaded snapshot; create mode creates all.
          original: isEdit ? original : undefined,
          amountField: d.amountField,
          totalField: d.totalField,
        });
        createdIds.push(...created);
      }
      return createdIds;
    },
    [details, isEdit, dataSource, schema.objectName],
  );

  /** Chained after the parent ObjectForm create/update succeeds. */
  const handleParentSaved = useCallback(
    async (parent: any) => {
      const parentId = idOf(parent) ?? schema.recordId;
      if (!parentId) throw new Error('MasterDetailForm: parent record has no id after save');
      if (!dataSource) throw new Error('MasterDetailForm: dataSource is required');

      let created: Array<{ object: string; id: string }> = [];
      try {
        created = await persistDetails(parentId);
      } catch (err) {
        // Best-effort cleanup so we don't leave an orphan parent on create.
        if (!isEdit) {
          await Promise.allSettled([
            ...created.map((c) => dataSource.delete(c.object, c.id)),
            dataSource.delete(schema.objectName, parentId),
          ]);
        }
        throw err;
      }
      await schema.onSuccess?.(parent);
    },
    [dataSource, isEdit, persistDetails, schema],
  );

  // The parent form renders WITHOUT its own submit button — the master-detail
  // form owns a single action bar at the bottom (header → lines → Save), the
  // layout every mainstream enterprise platform uses for header+line entry.
  const parentSchema = useMemo(
    () => ({
      type: 'object-form',
      objectName: schema.objectName,
      mode: schema.mode ?? 'create',
      recordId: schema.recordId,
      formType: schema.formType,
      sections: schema.sections,
      fields: schema.fields,
      title: schema.title,
      showSubmit: false,
      showCancel: false,
      onSuccess: handleParentSaved,
      onError: schema.onError,
    }),
    [schema, handleParentSaved],
  );

  const formHostRef = useRef<HTMLDivElement>(null);
  const submitText = schema.submitText ?? (isEdit ? 'Save' : 'Create');

  const handleSave = useCallback(() => {
    // Drive the (button-less) parent form's submit so its validation + RHF
    // onSubmit fire; success chains into child persistence via onSuccess.
    const form = formHostRef.current?.querySelector('form') as HTMLFormElement | null;
    if (form) form.requestSubmit();
  }, []);

  return (
    <div className={cn('space-y-6', className, schema.className)}>
      {/* 1) Header fields on top */}
      <div ref={formHostRef}>
        <ObjectForm schema={parentSchema as any} dataSource={dataSource} />
      </div>

      {/* 2) Line items below the header */}
      {details.map((d, i) => (
        <Card key={`${d.childObject}-${i}`} className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{d.title || 'Line Items'}</CardTitle>
          </CardHeader>
          <CardContent>
            <LineItemsField
              value={state[i]?.rows ?? []}
              onChange={(rows) => setRows(i, rows)}
              field={
                {
                  columns: d.columns,
                  // Show the running total whenever an amount column is set,
                  // independent of whether it also rolls up onto the parent.
                  total_field: d.amountField || (d.totalField ? 'amount' : undefined),
                  min_rows: d.minRows,
                  max_rows: d.maxRows,
                  add_label: d.addLabel,
                } as any
              }
            />
          </CardContent>
        </Card>
      ))}

      {/* 3) Single action bar at the bottom */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {schema.onCancel && (
          <Button type="button" variant="outline" onClick={schema.onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={handleSave}>
          {submitText}
        </Button>
      </div>
    </div>
  );
};
