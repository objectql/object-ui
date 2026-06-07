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
import { Button, Card, CardContent, CardHeader, CardTitle, cn, toast } from '@object-ui/components';
import { ObjectForm } from './ObjectForm';
import { applyDetail, idOf, buildMasterDetailBatch, buildMasterDetailEditBatch, sumRows } from './masterDetailTx';
import { deriveDetail, type InlineMode } from './deriveMasterDetail';

export interface MasterDetailDetailConfig {
  /** Child object name, e.g. 'expense_line'. */
  childObject: string;
  /** FK field on the child pointing back to the parent, e.g. 'expense_claim'.
   *  Optional — auto-detected from the child's master_detail/lookup field that
   *  references the parent object when omitted. */
  relationshipField?: string;
  /** Editable columns for the child grid. Optional — derived from the child
   *  object's fields (via DataSource.getObjectSchema) when omitted. */
  columns?: GridColumn[];
  /** Field names for the per-row expand form. Optional — derived from the child
   *  object's fields (broader than `columns`: includes rich types) when omitted. */
  formFields?: string[];
  /** Inline-edit form factor: 'grid' = editable cells; 'form' = read-only list +
   *  per-row full form. Optional — resolved from the relationship's `inlineEdit`
   *  (incl. the smart default) when omitted. */
  inlineMode?: InlineMode;
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
  /** Parent header field holding a tax rate (percent). When the parent form has
   *  this field, a live Subtotal / Tax / Total stack renders under the lines.
   *  Defaults to `tax_rate`; the stack only appears if the field is present. */
  taxRateField?: string;
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
  const rawDetails = schema.details || [];
  const isEdit = schema.mode === 'edit' && !!schema.recordId;

  // A detail can be configured with just `{ childObject }` — the relationship
  // FK and grid columns are then derived from the child object's metadata
  // (DataSource.getObjectSchema). Resolve those before rendering the grid.
  const needsDerive = rawDetails.some((d) => !d.relationshipField || !d.columns?.length);
  const [resolvedDetails, setResolvedDetails] = useState<MasterDetailDetailConfig[] | null>(
    needsDerive ? null : rawDetails,
  );
  const details = resolvedDetails ?? rawDetails; // length always matches rawDetails

  useEffect(() => {
    if (!needsDerive) { setResolvedDetails(rawDetails); return; }
    if (!dataSource || typeof (dataSource as any).getObjectSchema !== 'function') return;
    let cancelled = false;
    (async () => {
      const out = await Promise.all(
        rawDetails.map(async (d) => {
          if (d.relationshipField && d.columns?.length) return d;
          try {
            const childSchema = await dataSource.getObjectSchema(d.childObject);
            const derived = deriveDetail(d.childObject, childSchema, schema.objectName, {
              relationshipField: d.relationshipField,
              columns: d.columns,
              amountField: d.amountField,
            });
            return {
              ...d,
              relationshipField: derived.relationshipField,
              columns: derived.columns,
              formFields: d.formFields ?? derived.formFields,
              inlineMode: d.inlineMode ?? derived.mode,
              amountField: d.amountField ?? derived.amountField,
            };
          } catch {
            return d; // leave as-is; the grid card will show a config hint
          }
        }),
      );
      if (!cancelled) setResolvedDetails(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, schema.objectName, schema.details]);

  // One row-state per detail collection (length is known up-front from rawDetails).
  const [state, setState] = useState<RowState[]>(() =>
    rawDetails.map(() => ({ rows: [], original: [] })),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  // Bumped after a successful CREATE to remount the parent <ObjectForm> (which
  // owns react-hook-form state) so its fields clear for the next entry.
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const saveGuardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseSave = useCallback(() => {
    savingRef.current = false;
    setSaving(false);
    if (saveGuardTimer.current) {
      clearTimeout(saveGuardTimer.current);
      saveGuardTimer.current = null;
    }
  }, []);

  // Edit mode: load existing children for each detail collection.
  useEffect(() => {
    let cancelled = false;
    if (!isEdit || !dataSource) return;
    (async () => {
      const loaded = await Promise.all(
        details.map(async (d) => {
          if (!d.relationshipField) return { rows: [], original: [] }; // not resolved yet
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
  }, [isEdit, dataSource, schema.recordId, resolvedDetails]);

  const setRows = useCallback((detailIdx: number, rows: Record<string, any>[]) => {
    setState((prev) => prev.map((s, i) => (i === detailIdx ? { ...s, rows } : s)));
  }, []);

  // Live header tax rate, read from the parent form's `tax_rate` input via
  // scoped event delegation on the form host (no coupling into ObjectForm's
  // internals). Drives the Subtotal / Tax / Total stack under the lines.
  const taxRateField = schema.taxRateField || 'tax_rate';
  const [taxRate, setTaxRate] = useState<number | null>(null);
  useEffect(() => {
    const host = formHostRef.current;
    if (!host) return;
    const read = () => {
      const el = host.querySelector(`[name="${taxRateField}"]`) as HTMLInputElement | null;
      if (!el) { setTaxRate(null); return; }
      const n = Number(el.value);
      setTaxRate(Number.isFinite(n) ? n : 0);
    };
    read();
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t && t.name === taxRateField) read();
    };
    host.addEventListener('input', onInput);
    host.addEventListener('change', onInput);
    const t = setTimeout(read, 300); // re-read once the form has mounted its fields
    return () => {
      host.removeEventListener('input', onInput);
      host.removeEventListener('change', onInput);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxRateField, formKey, details.length]);

  // Per-row "expand to full form": opens the child's complete form (all business
  // fields, incl. rich types the grid omits) in a drawer, pre-filled with the
  // row. Saving writes back into the in-memory row — the atomic batch still
  // persists everything on the parent Save (no separate backend write here).
  // `isNew` marks a row created by "Add" in list/form mode — cancelling the
  // editor without applying discards that empty row.
  const [expanded, setExpanded] = useState<{ detailIdx: number; rowIdx: number; isNew?: boolean } | null>(null);
  const expandedRow =
    expanded ? state[expanded.detailIdx]?.rows?.[expanded.rowIdx] : undefined;
  const expandedDetail = expanded ? details[expanded.detailIdx] : undefined;

  const applyRowEdit = useCallback(
    (detailIdx: number, rowIdx: number, values: Record<string, any>) => {
      setState((prev) =>
        prev.map((s, i) =>
          i === detailIdx
            ? { ...s, rows: s.rows.map((r, j) => (j === rowIdx ? { ...r, ...values } : r)) }
            : s,
        ),
      );
    },
    [],
  );

  /** List/form mode "Add": append a blank row and open it in the full form. */
  const addRowViaForm = useCallback((detailIdx: number) => {
    setState((prev) => {
      const next = prev.map((s, i) => (i === detailIdx ? { ...s, rows: [...s.rows, {}] } : s));
      const rowIdx = next[detailIdx].rows.length - 1;
      setExpanded({ detailIdx, rowIdx, isNew: true });
      return next;
    });
  }, []);

  /** Editor cancelled: drop the row if it was a freshly-added (empty) one. */
  const cancelRowEdit = useCallback(() => {
    setExpanded((cur) => {
      if (cur?.isNew) {
        setState((prev) =>
          prev.map((s, i) => (i === cur.detailIdx ? { ...s, rows: s.rows.filter((_, j) => j !== cur.rowIdx) } : s)),
        );
      }
      return null;
    });
  }, []);

  /**
   * Built-in feedback so a save is NEVER silent (a silent success looks broken
   * and invites duplicate submits). Shows a toast, and on CREATE clears the
   * form for the next entry by resetting the line items + remounting the parent
   * form. A page-supplied `onSuccess` still runs afterwards (e.g. to navigate).
   */
  const handleSaved = useCallback(
    async (parent: any) => {
      releaseSave();
      toast.success(isEdit ? (schema.title ? `${schema.title} saved` : 'Saved') : 'Created');
      if (!isEdit) {
        setState(details.map(() => ({ rows: [], original: [] })));
        setFormKey((k) => k + 1);
      }
      await schema.onSuccess?.(parent);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEdit, schema.onSuccess, schema.title, details.length, releaseSave],
  );

  /** Surface failures (validation / network / atomic rollback) to the user. */
  const handleError = useCallback(
    (err: Error) => {
      releaseSave();
      toast.error(err?.message || 'Save failed');
      schema.onError?.(err);
    },
    [schema, releaseSave],
  );

  /** Persist all child collections for a known parent id. Returns created ids
   *  (create mode) so the caller can clean up on a later failure. */
  const persistDetails = useCallback(
    async (parentId: string) => {
      const createdIds: Array<{ object: string; id: string }> = [];
      for (let i = 0; i < details.length; i++) {
        const d = details[i];
        const { rows, original } = stateRef.current[i];
        if (!d.relationshipField) continue; // unresolved — skip (save is gated)
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
      await handleSaved(parent);
    },
    [dataSource, isEdit, persistDetails, schema, handleSaved],
  );

  // When the server exposes the transactional batch endpoint, the parent + its
  // children are persisted in ONE atomic transaction (commit all or roll back
  // all) — no client-side best-effort cleanup. This now covers BOTH create
  // (parent + child creates via `$ref`) and edit (parent update + child
  // create/update/delete diffs). Otherwise fall back to the client-orchestrated
  // path (handleParentSaved).
  const canBatch = typeof (dataSource as any)?.batchTransaction === 'function';

  const submitViaBatch = useCallback(
    async (parentValues: Record<string, any>) => {
      const ds: any = dataSource;
      const parentData: Record<string, any> = { ...parentValues };
      // Client-side rollups merged into the parent payload (hooks can't do
      // nested writes — see ADR-0001).
      details.forEach((d, i) => {
        if (d.totalField) parentData[d.totalField] = sumRows(stateRef.current[i]?.rows ?? [], d.amountField || 'amount');
      });
      const ops = isEdit
        ? buildMasterDetailEditBatch(
            schema.objectName,
            schema.recordId!,
            parentData,
            details.filter((d) => d.relationshipField).map((d, i) => ({
              childObject: d.childObject,
              relationshipField: d.relationshipField!,
              rows: stateRef.current[i]?.rows ?? [],
              original: stateRef.current[i]?.original ?? [],
            })),
          )
        : buildMasterDetailBatch(
            schema.objectName,
            parentData,
            details.filter((d) => d.relationshipField).map((d, i) => ({
              childObject: d.childObject,
              relationshipField: d.relationshipField!,
              rows: stateRef.current[i]?.rows ?? [],
            })),
          );
      const res = await ds.batchTransaction(ops);
      // create → parent is op 0; edit → echo the parent values back.
      return res?.results?.[0] ?? { ...parentData, id: schema.recordId };
    },
    [dataSource, details, schema.objectName, schema.recordId, isEdit],
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
      // Atomic path: ObjectForm validates + hands values to submitViaBatch
      // (which persists parent+children in one transaction), then handleSaved
      // (toast + reset + page onSuccess). The non-atomic path persists children
      // in handleParentSaved, which also ends in handleSaved.
      ...(canBatch ? { submitHandler: submitViaBatch, onSuccess: handleSaved } : { onSuccess: handleParentSaved }),
      onError: handleError,
    }),
    [schema, handleParentSaved, canBatch, submitViaBatch, handleSaved, handleError],
  );

  const formHostRef = useRef<HTMLDivElement>(null);
  const submitText = schema.submitText ?? (isEdit ? 'Save' : 'Create');

  const handleSave = useCallback(() => {
    // Drive the (button-less) parent form's submit so its validation + RHF
    // onSubmit fire; success chains into child persistence via onSuccess.
    if (savingRef.current) return; // guard against duplicate submits
    const form = formHostRef.current?.querySelector('form') as HTMLFormElement | null;
    if (!form) return;
    savingRef.current = true;
    setSaving(true);
    // IMPORTANT: defer the submit out of this click's React dispatch AND
    // re-query the <form> inside the timer. Calling requestSubmit()
    // synchronously inside the onClick (or on a form reference captured before
    // the setSaving() re-render) intermittently fails to invoke react-hook-form's
    // onSubmit — the nested submit event is dropped — which made "Create" feel
    // unresponsive (only the occasional lucky click submitted). A fresh query in
    // a macrotask reliably triggers RHF validation + submit.
    setTimeout(() => {
      const liveForm = formHostRef.current?.querySelector('form') as HTMLFormElement | null;
      liveForm?.requestSubmit();
    }, 0);
    // Safety net: react-hook-form blocks invalid submits without firing
    // onSuccess/onError, which would otherwise leave the button stuck. Release
    // the guard after a beat so the user can correct fields and retry.
    saveGuardTimer.current = setTimeout(() => releaseSave(), 1500);
  }, [releaseSave]);

  useEffect(() => () => { if (saveGuardTimer.current) clearTimeout(saveGuardTimer.current); }, []);

  // Document totals: Subtotal (Σ line amounts) → Tax (header rate %) → Total.
  // Shown only when the parent has the tax-rate field AND a detail has an
  // amount column; otherwise each grid keeps its own footer total.
  const subtotal = details.reduce((acc, d, i) => acc + sumRows(state[i]?.rows ?? [], d.amountField || 'amount'), 0);
  const showTaxStack = taxRate !== null && details.some((d) => !!d.amountField);
  const taxPct = taxRate ?? 0;
  const taxAmount = subtotal * (taxPct / 100);
  const grandTotal = subtotal + taxAmount;
  const money = (n: number) => `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className={cn('space-y-6', className, schema.className)}>
      {/* 1) Header fields on top */}
      <div ref={formHostRef}>
        <ObjectForm key={formKey} schema={parentSchema as any} dataSource={dataSource} />
      </div>

      {/* 2) Line items below the header */}
      {details.map((d, i) => (
        <Card key={`${d.childObject}-${i}`} className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{d.title || 'Line Items'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!d.columns?.length ? (
              <p className="py-4 text-sm text-muted-foreground">Loading columns…</p>
            ) : (
            <LineItemsField
              value={state[i]?.rows ?? []}
              onChange={(rows) => setRows(i, rows)}
              // Per-row "expand to full form" is offered when it adds something:
              // always in form mode (it IS the editor), and in grid mode only
              // when the full form has fields the grid omits. A thin grid whose
              // columns already cover every field (e.g. invoice lines) shows no
              // redundant expand button.
              {...((d.inlineMode === 'form' || (d.formFields?.length ?? 0) > (d.columns?.length ?? 0))
                ? { onRowExpand: (rowIdx: number) => setExpanded({ detailIdx: i, rowIdx }) }
                : {})}
              displayMode={d.inlineMode === 'form' ? 'list' : 'grid'}
              {...(d.inlineMode === 'form' ? { onAdd: () => addRowViaForm(i) } : {})}
              field={
                {
                  columns: d.columns,
                  // Show the per-grid running total whenever an amount column is
                  // set — unless the document totals stack below subsumes it.
                  total_field: showTaxStack ? undefined : (d.amountField || (d.totalField ? 'amount' : undefined)),
                  min_rows: d.minRows,
                  max_rows: d.maxRows,
                  add_label: d.inlineMode === 'form' ? (d.addLabel || 'Add') : d.addLabel,
                } as any
              }
            />
            )}
          </CardContent>
        </Card>
      ))}

      {/* Document totals stack (Subtotal / Tax / Total) — the right-aligned block
          every invoicing tool shows. Live as lines and the header tax rate change. */}
      {showTaxStack && (
        <div className="flex justify-end">
          <dl className="w-64 space-y-1.5 text-sm" data-testid="md-totals">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums" data-testid="md-subtotal">{money(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Tax ({taxPct}%)</dt>
              <dd className="tabular-nums" data-testid="md-tax">{money(taxAmount)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums" data-testid="md-grand-total">{money(grandTotal)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Per-row "expand to full form": an inline editor panel for the selected
          row. Rendered INLINE (not a portaled drawer) so it behaves identically
          whether this form is itself inside a modal (New-from-list) or a full
          page — nested portaled overlays inherit the host modal's
          pointer-events / aria-hidden lock and become unclickable. Edits the
          row in the child's COMPLETE form (rich types the grid omits) and writes
          the values back into the in-memory row; the atomic batch persists
          everything on the parent Save. */}
      {expanded && expandedDetail && (
        <Card className="border-primary/40 shadow-none ring-1 ring-primary/10" data-testid="md-row-form">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              {(expandedDetail.title || 'Line item')} — row {expanded.rowIdx + 1}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={cancelRowEdit}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <ObjectForm
              key={`row-${expanded.detailIdx}-${expanded.rowIdx}`}
              schema={{
                type: 'object-form',
                objectName: expandedDetail.childObject,
                mode: 'edit',
                // No recordId → ObjectForm uses initialData (no backend fetch).
                initialData: expandedRow ?? {},
                ...(expandedDetail.formFields?.length ? { fields: expandedDetail.formFields } : {}),
                submitText: 'Apply',
                // Non-persisting: return the values; the atomic batch on the
                // parent Save does the real write.
                submitHandler: async (values: any) => values,
                onSuccess: (values: any) => {
                  applyRowEdit(expanded.detailIdx, expanded.rowIdx, values);
                  setExpanded(null);
                },
                onCancel: cancelRowEdit,
              } as any}
              dataSource={dataSource}
            />
          </CardContent>
        </Card>
      )}

      {/* Single action bar at the bottom */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        {schema.onCancel && (
          <Button type="button" variant="outline" onClick={schema.onCancel} disabled={saving} data-testid="md-form-cancel">
            Cancel
          </Button>
        )}
        <Button type="button" onClick={handleSave} disabled={saving || (needsDerive && !resolvedDetails)} data-testid="md-form-submit">
          {saving ? 'Saving…' : submitText}
        </Button>
      </div>
    </div>
  );
};
