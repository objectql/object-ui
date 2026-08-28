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
 * collection(s) by <LineItemsField>. On submit we build ONE ordered
 * cross-object operation list — parent create/update as op 0, each child a
 * create/update/delete linked to it (via `{ $ref: 0 }` on create, or the
 * known parent id on edit) — and hand it to `dataSource.batchTransaction`
 * through {@link runBatchTransaction}. Client-side rollups are folded into the
 * parent payload so they commit in the same batch.
 *
 * The form is deliberately ignorant of atomicity: a server with the
 * transactional `/api/v1/batch` endpoint commits all-or-nothing, while an
 * adapter without one emulates the batch internally (sequential writes with
 * best-effort compensation, see `emulateBatchTransaction` in `@object-ui/core`).
 * Either way there is no master-detail-specific cleanup code here (ObjectStack
 * objectui #2679 / framework ADR-0034 item 4).
 *
 * No `@objectstack/spec` change: the relationship is a `master_detail` (or
 * `lookup`) FK on the child object.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DataSource } from '@object-ui/types';
import { runBatchTransaction } from '@object-ui/core';
import { LineItemsField, type GridColumn } from '@object-ui/fields';
import { Button, Card, CardContent, CardHeader, CardTitle, cn, toast } from '@object-ui/components';
import { ObjectForm } from './ObjectForm';
import { buildMasterDetailBatch, buildMasterDetailEditBatch, sumRows } from './masterDetailTx';
import { deriveDetail, hydrateColumns, type InlineMode } from './deriveMasterDetail';

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
  /** Child field holding the line sort position — stamped on drag-reorder so
   *  order persists. Auto-derived from a `position`/`sort_order`/… field. */
  sortField?: string;
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
  /**
   * `string | number` to match `ObjectFormSchema` and the drawer/modal/split/
   * tabbed/wizard envelopes that hand a record straight through to this form —
   * a numeric primary key is a real backend shape. Narrowed to a string only at
   * the batch-transaction boundary, whose `BatchTransactionOperation.id` is a
   * string by protocol.
   */
  recordId?: string | number;
  /** Prefilled parent header values (create mode) — seeds the parent form's
   *  initial values, e.g. a conversion wizard carrying the lead/account over. */
  initialValues?: Record<string, any>;
  initialData?: Record<string, any>;
  /** Parent form sections/fields — passed straight through to ObjectForm. */
  sections?: any[];
  fields?: any[];
  formType?: 'simple' | 'tabbed';
  title?: string;
  submitText?: string;
  /** Label for the Cancel button in the action bar. i18n is the host's job
   *  (this plugin is locale-agnostic); defaults to English 'Cancel'. */
  cancelText?: string;
  /** Hide the bottom Save/Cancel action bar — e.g. a non-persisting design
   *  preview. Defaults to shown (the form owns the only Save in this layout). */
  showSubmit?: boolean;
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

/**
 * What happened to one detail entry's schema resolution (objectui#6372).
 *
 * A plain `MasterDetailDetailConfig[]` cannot express this. An entry whose
 * fetch FAILED and one that is STILL IN FLIGHT are represented identically —
 * both are simply an entry with no `columns` — so the renderer showed the same
 * "Loading columns…" for both. For the failed one that message never ends: the
 * fetch that would have supplied those columns has already failed and is not
 * retried, so nothing can ever replace it.
 */
type DetailResolution =
  /** The schema fetch has not settled yet — "Loading columns…" is TRUE here. */
  | 'pending'
  /** No `childObject` was authored, so no fetch was made (objectui#5940). */
  | 'declined'
  /** Columns are hydrated, or were fully authored to begin with. */
  | 'ready'
  /** The schema fetch THREW — columns can never arrive (objectui#6372). */
  | 'failed'
  /**
   * The schema LOADED FINE, but `deriveDetail` threw on it (objectui#6394) —
   * almost always "no lookup/master_detail field on the child references the
   * parent". A CONFIGURATION error, not a load error, which is why it is a
   * state of its own rather than a second reading of `failed`: the remedy is a
   * key the author writes (`relationshipField`), not a reload, and the two
   * placeholders must not borrow each other's copy.
   */
  | 'underivable';

/**
 * One authored detail collection, plus the two pieces of per-entry metadata a
 * bare `MasterDetailDetailConfig[]` could not carry: WHICH entry this is, and
 * WHAT happened to it.
 *
 * ⭐ Both defects this record closes came from the same absence. With no
 * per-entry metadata, "what happened to this entry" (objectui#6372) and "which
 * entry is this" (objectui#6371) were BOTH inferred from the entry's position
 * in the array. One record answers both, which is why they land together:
 * either one alone would have reshaped this structure and the second would
 * then have rewritten the first.
 */
interface DetailEntry {
  /**
   * Stable identity, synthesized ONCE from the incoming config — never the map
   * index of the rendered array. See {@link synthesizeDetailIds}.
   */
  id: string;
  /** The authored config, with derived columns / FK folded in once resolved. */
  config: MasterDetailDetailConfig;
  status: DetailResolution;
}

/**
 * Give every authored detail entry an identity that does not change when a
 * SIBLING moves.
 *
 * ## The hazard, stated correctly
 *
 * ⛔ The old key — `${d.childObject}` joined to the map index — did NOT
 * collide. The index is unique among siblings by construction, so two declined
 * details keyed as `undefined-0` and `undefined-1`: distinct, no React
 * duplicate-key warning, no remount collision. Anyone re-deriving this starts
 * from the INDEX-IDENTITY hazard, never from a collision claim (objectui#6371
 * corrects the record on that point).
 *
 * The real defect: for a declined entry the DATA half of that key is
 * `undefined`, so the entry's identity was purely its POSITION — and the
 * row-state store was addressed the same way. Reordering or removing an entry
 * therefore re-associated a collection's DOM node, its rows, AND its
 * contribution to the document subtotal with a different collection.
 *
 * ## What the identity is
 *
 * A named collection is identified by the child object it lists: the half of
 * the old key that actually carried data, and the half that survives a
 * reorder. A DECLINED entry has no such half — the decline is precisely the
 * absence of one — so its identity is its AUTHORED POSITION in the incoming
 * `details` array, synthesized here, once, at config time.
 *
 * Two collections may legitimately list the SAME child object, so an
 * occurrence counter separates them without sending the named case back to
 * position. Two entries indistinguishable in the config stay indistinguishable
 * here: that ambiguity is authored, not introduced.
 */
function synthesizeDetailIds(raw: MasterDetailDetailConfig[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((d, authoredPosition) => {
    // The prefixes keep the two namespaces apart, so a child object literally
    // named `pos:0` cannot take a declined entry's identity.
    const base = d.childObject ? `obj:${d.childObject}` : `pos:${authoredPosition}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    return nth === 0 ? base : `${base}~${nth}`;
  });
}

/**
 * Read the live header record from the rendered parent-form host by scraping its
 * named controls. The header is owned by react-hook-form (inside <ObjectForm>),
 * which exposes no values callback here; rather than couple into its internals
 * we read the DOM the same way the tax-rate stack does. Radix <Select> renders a
 * visually-hidden native `<select name=...>` for form participation, so selects
 * (e.g. an invoice `status`) are captured too, and a user's pick dispatches a
 * bubbling `change` the host listener catches.
 */
function scrapeHeaderRecord(host: HTMLElement | null): Record<string, unknown> {
  if (!host) return {};
  const out: Record<string, unknown> = {};
  const els = host.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]');
  els.forEach((el) => {
    const name = el.getAttribute('name');
    if (!name) return;
    if (el.tagName === 'INPUT') {
      const input = el as HTMLInputElement;
      if (input.type === 'checkbox') { out[name] = input.checked; return; }
      if (input.type === 'radio') { if (input.checked) out[name] = input.value; return; }
      if (input.type === 'number' || input.type === 'range') {
        if (input.value === '') { out[name] = null; return; }
        const n = Number(input.value);
        out[name] = Number.isFinite(n) ? n : input.value;
        return;
      }
      out[name] = input.value;
      return;
    }
    // <select> (incl. Radix's hidden native select) and <textarea>.
    out[name] = (el as HTMLSelectElement | HTMLTextAreaElement).value;
  });
  return out;
}

interface MasterDetailLinesProps {
  entries: DetailEntry[];
  /** Row state addressed by ENTRY ID, never by array position (objectui#6371). */
  rowState: Record<string, RowState>;
  setRows: (entryId: string, rows: Record<string, any>[]) => void;
  /** Host wrapping the header <ObjectForm> — scraped for the live parent record. */
  formHostRef: React.RefObject<HTMLDivElement | null>;
  taxRateField: string;
  /** Bumped when the header form remounts (after create) so the lines re-scrape. */
  formKey: number;
  onRowExpand: (entryId: string, rowIdx: number) => void;
  onAddViaForm: (entryId: string) => void;
  /**
   * The PARENT object's name, for the `underivable` config hint — "which parent
   * this collection could not be linked to" is half the diagnosis, and the
   * entry's own config cannot carry it (objectui#6394).
   */
  parentObjectName: string;
}

/**
 * The line-item grids + document totals, isolated from the header form.
 *
 * It owns `parentRecord` — the live header values, scraped from the form host —
 * and binds it to every grid as `contextRecord`, so a column's `readonlyWhen` /
 * `requiredWhen` CEL rule can react to the header (the "paid invoice → lock
 * lines" case, `parent.status == 'paid'`; see #1581 / ADR-0036).
 *
 * Holding `parentRecord` HERE rather than in <MasterDetailForm> is the whole
 * point: a header keystroke re-renders only these lines, never the header
 * <ObjectForm> whose react-hook-form state would otherwise reset mid-edit. The
 * scrape is deduped by value so an identical re-read causes no state churn.
 */
const MasterDetailLines: React.FC<MasterDetailLinesProps> = ({
  entries,
  rowState,
  setRows,
  formHostRef,
  taxRateField,
  formKey,
  onRowExpand,
  onAddViaForm,
  parentObjectName,
}) => {
  const [parentRecord, setParentRecord] = useState<Record<string, unknown>>({});
  const parentKeyRef = useRef<string>('');

  useEffect(() => {
    const host = formHostRef.current;
    if (!host) return;
    const read = () => {
      const next = scrapeHeaderRecord(host);
      let key: string;
      try { key = JSON.stringify(next); } catch { key = String(Math.random()); }
      if (key === parentKeyRef.current) return; // value-identical → no re-render
      parentKeyRef.current = key;
      setParentRecord(next);
    };
    read();
    const onEvt = () => read();
    host.addEventListener('input', onEvt);
    host.addEventListener('change', onEvt);
    // The header populates asynchronously (schema fetch → edit-mode load → RHF
    // reset), none of which fire input events, so re-read on a few ticks to
    // capture the initial record (e.g. an already-paid invoice loads locked).
    const timers = [120, 360, 800].map((ms) => setTimeout(read, ms));
    return () => {
      host.removeEventListener('input', onEvt);
      host.removeEventListener('change', onEvt);
      timers.forEach(clearTimeout);
    };
  }, [formHostRef, formKey, entries.length]);

  // Document totals: Subtotal (Σ line amounts) → Tax (header rate %) → Total.
  // Shown only when the header carries the tax-rate field AND a detail has an
  // amount column; otherwise each grid keeps its own footer total.
  const taxRaw = parentRecord[taxRateField];
  const taxRate = taxRaw === undefined ? null : (Number.isFinite(Number(taxRaw)) ? Number(taxRaw) : 0);
  // ⚠️ Addressed by ENTRY ID. This reducer read `state[i]` — so a reorder did
  // not merely show a collection the wrong grid, it MIS-COMPUTED the document
  // total: each entry summed a different collection's rows, under its own
  // `amountField` (objectui#6371).
  const subtotal = entries.reduce(
    (acc, e) => acc + sumRows(rowState[e.id]?.rows ?? [], e.config.amountField || 'amount'),
    0,
  );
  const showTaxStack = taxRate !== null && entries.some((e) => !!e.config.amountField);
  const taxPct = taxRate ?? 0;
  const taxAmount = subtotal * (taxPct / 100);
  const grandTotal = subtotal + taxAmount;
  const money = (n: number) => `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      {/* Line items below the header. Rendered as a light section (label + the
          grid's own bordered table) rather than a heavy Card — a Card here would
          double-frame the grid and its p-6 padding wastes the width the line
          table needs. */}
      {entries.map((entry) => {
        const d = entry.config;
        return (
        // Keyed on the entry's SYNTHESIZED identity, not on the map index. The
        // old key put `d.childObject` — `undefined` for a declined entry —
        // ahead of the index, which left such a section with no identity beyond
        // its position, so a sibling moving above it re-associated the section
        // and its rows with a different collection (objectui#6371).
        <section key={entry.id} className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">{d.title || 'Line Items'}</h3>
          {/* A detail whose child object never resolved gets its OWN branch,
              ahead of the columns/loading one (objectui#6360) — the render half
              of the decline at `MasterDetailForm`'s resolve effect, and the same
              shape `LineItemsPanel` takes for this exact key (objectui#6194)
              following objectui#5940's config-hint precedent. It must not sit on
              "Loading columns…": the decline is precisely the guarantee that
              those columns can never arrive, so the spinner-shaped message is
              permanently, unfixably wrong and never names the key the author has
              to set. Checked BEFORE the columns arm because nothing is pending —
              there is no first paint where "loading" is true. */}
          {!d.childObject ? (
            <p
              className="py-4 text-sm text-muted-foreground"
              data-testid="md-detail-no-child-object"
            >
              This collection has no child object configured: set{' '}
              <code className="font-mono">childObject</code> to the object whose rows it lists.
            </p>
          ) : entry.status === 'failed' ? (
            /* The OTHER arm of the same resolver (objectui#6372). This entry
               DOES name a child object, so it skips the config hint above — and
               before this branch existed it fell through to "Loading columns…"
               and stayed there forever, because the fetch that would have
               supplied those columns already failed and is not retried.
               Distinguishing it from a genuinely-pending entry is exactly what
               `entry.status` exists for: on a bare `MasterDetailDetailConfig[]`
               the two states are identical (no `columns`).
               Shaped on `AdvancedChartImpl`'s refusal placeholders — a refusal
               is a state, not an alert, so `role="status"` — and it NAMES the
               child object, because "which collection refused" is the whole
               diagnosis for the author reading it. */
            <p
              className="py-4 text-sm text-muted-foreground"
              role="status"
              data-testid="md-detail-schema-unavailable"
            >
              Could not load the schema of{' '}
              <code className="font-mono">{d.childObject}</code>, so this collection has no
              columns to show. Check that the object exists and is readable, then reload.
            </p>
          ) : entry.status === 'underivable' ? (
            /* The THIRD arm of the same resolver (objectui#6394): the schema
               LOADED, and `deriveDetail` then threw on it — no lookup /
               master_detail field on the child references the parent. Before
               this branch existed it fell through to "Loading columns…" and
               stayed there forever, exactly like the two arms above, because
               the derive is not retried either.
               ⛔ NOT the refusal placeholder above: that one states the schema
               could not be LOADED, which is false here — "dishonest copy for a
               schema that loaded fine" (objectui#6394 triage). This is a
               CONFIGURATION error with a named remedy, so it takes the config
               hint shape of the `!d.childObject` branch (objectui#5940 /
               objectui#6360) and NAMES `relationshipField` as the key to set —
               the same key the thrown message names, which is why that error is
               also logged rather than discarded. */
            <p
              className="py-4 text-sm text-muted-foreground"
              data-testid="md-detail-no-relationship-field"
            >
              Could not work out how <code className="font-mono">{d.childObject}</code> links
              to <code className="font-mono">{parentObjectName}</code>: no lookup or
              master_detail field on it references the parent. Set{' '}
              <code className="font-mono">relationshipField</code> on this collection to the
              field that holds the parent record.
            </p>
          ) : !d.columns?.length ? (
            <p className="py-4 text-sm text-muted-foreground">Loading columns…</p>
          ) : (
            <LineItemsField
              value={rowState[entry.id]?.rows ?? []}
              onChange={(rows) => setRows(entry.id, rows)}
              // The live header record — a line cell's readonlyWhen/requiredWhen
              // CEL rule evaluates against it as `parent` (e.g. lock when
              // parent.status == 'paid').
              contextRecord={parentRecord}
              // Per-row "expand to full form" is offered when it adds something:
              // always in form mode (it IS the editor), and in grid mode only
              // when the full form has fields the grid omits. A thin grid whose
              // columns already cover every field (e.g. invoice lines) shows no
              // redundant expand button.
              {...((d.inlineMode === 'form' || (d.formFields?.length ?? 0) > (d.columns?.length ?? 0))
                ? { onRowExpand: (rowIdx: number) => onRowExpand(entry.id, rowIdx) }
                : {})}
              displayMode={d.inlineMode === 'form' ? 'list' : 'grid'}
              {...(d.inlineMode === 'form' ? { onAdd: () => onAddViaForm(entry.id) } : {})}
              field={
                {
                  columns: d.columns,
                  // Show the per-grid running total whenever an amount column is
                  // set — unless the document totals stack below subsumes it.
                  total_field: showTaxStack ? undefined : (d.amountField || (d.totalField ? 'amount' : undefined)),
                  sort_field: d.sortField,
                  min_rows: d.minRows,
                  max_rows: d.maxRows,
                  add_label: d.inlineMode === 'form' ? (d.addLabel || 'Add') : d.addLabel,
                } as any
              }
            />
          )}
        </section>
        );
      })}

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
    </>
  );
};

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
  // (DataSource.getObjectSchema). We also resolve when columns are hand-authored
  // as bare `{ name, label }` (no `type`): those need their widget type
  // hydrated from the child schema, else every cell falls back to a text input.
  const needsDerive = rawDetails.some(
    (d) => !d.relationshipField || !d.columns?.length || d.columns.some((c) => !c.type),
  );
  /**
   * Per-entry identity, synthesized ONCE from the incoming config — the anchor
   * everything below is addressed by (objectui#6371). Recomputed only when the
   * authored `details` array itself changes, never per render and never from a
   * map index.
   */
  const detailIds = useMemo(
    () => synthesizeDetailIds(rawDetails),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema.details],
  );

  /** The unresolved entries — what renders until (or unless) the fetch lands. */
  const baseEntries = useMemo<DetailEntry[]>(
    () =>
      rawDetails.map((d, i) => ({
        id: detailIds[i],
        config: d,
        status: needsDerive ? ('pending' as const) : ('ready' as const),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema.details, detailIds, needsDerive],
  );

  const [resolvedEntries, setResolvedEntries] = useState<DetailEntry[] | null>(null);
  const entries = resolvedEntries ?? baseEntries; // length always matches rawDetails

  useEffect(() => {
    if (!needsDerive) { setResolvedEntries(baseEntries); return; }
    if (!dataSource || typeof (dataSource as any).getObjectSchema !== 'function') return;
    let cancelled = false;
    (async () => {
      const out = await Promise.all(
        baseEntries.map(async (entry): Promise<DetailEntry> => {
          const d = entry.config;
          const columnsTyped = d.columns?.length ? d.columns.every((c) => !!c.type) : false;
          // Fully configured (FK + every column typed) — nothing to resolve.
          if (d.relationshipField && columnsTyped) return { ...entry, status: 'ready' };
          // Decline to fetch when the child object never resolved (objectui#5940).
          // `childObject` is REQUIRED on `MasterDetailDetailConfig`, but a detail
          // entry reaches this renderer straight off an authored schema, so a
          // malformed one (or a bare string) arrives with it `undefined` — and the
          // fetch below then asked the data layer for an object literally named
          // `undefined`. A real backend receives that query and whatever it returns
          // becomes the console's problem. `RelatedList` already takes the other
          // choice for the same class of missing key ("has no referenceField/parentId
          // — refusing to fetch all rows", RelatedList.tsx), and the sibling effect
          // below already spells it `.filter(Boolean)`; this makes the three agree.
          // Left as-is rather than dropped: `details` stays length-matched to
          // `rawDetails` (the row-state array is indexed against it), and the
          // `!d.childObject` branch in <MasterDetailLines> renders a config hint
          // naming this key. That hint did not exist when this comment was first
          // written — the branch showed "Loading columns…" forever, and a reader
          // who trusted the claim had to run the component to find out
          // (objectui#6360). Do not restore the claim that the `catch` below
          // behaves the same way: it does not (objectui#6372).
          if (!d.childObject) {
            console.warn(
              `[MasterDetailForm] a detail collection has no childObject — refusing to fetch its schema. Set childObject to the child object the collection lists.`,
            );
            return { ...entry, status: 'declined' };
          }
          // ⭐ The FETCH and the DERIVE are caught SEPARATELY, because they are
          // different failures with different truths to tell. The bare `catch`
          // this replaces covered both, so both showed the same permanent
          // "Loading columns…" — and folding both into the new refusal
          // placeholder would be just as wrong in the other direction: it says
          // the schema could not be loaded, which is FALSE for a schema that
          // loaded fine and then failed to yield a relationship field.
          // Measured while building this: `deriveDetail` throwing is what the
          // objectui#6360 fixture actually hits, not a pending fetch.
          let childSchema: Awaited<ReturnType<DataSource['getObjectSchema']>>;
          try {
            childSchema = await dataSource.getObjectSchema(d.childObject);
          } catch (err) {
            // THE FETCH FAILED — objectui#6372's subject. The entry is kept (not
            // dropped) so `entries` stays length-matched to `rawDetails` and the
            // author still sees WHICH collection failed; what changes is that
            // the failure is now RECORDED. `status: 'failed'` is the smallest
            // shape that tells this apart from "still in flight": on a bare
            // `MasterDetailDetailConfig[]` the two are identical (no `columns`),
            // which is why the renderer showed the same spinner-shaped message
            // for both, and why for this one it never ended — the fetch is not
            // retried, so nothing can ever replace it.
            //
            // The thrown error used to be DISCARDED, so whoever debugged this
            // had neither a message nor a stack. The parity bar is the decline
            // arm above, which has warned since objectui#5940; the error object
            // itself is passed through because the stack is the half that makes
            // the failure actionable.
            console.warn(
              `[MasterDetailForm] could not load the schema of child object "${d.childObject}" — its columns cannot be derived, so the collection renders a refusal placeholder instead of a permanent "Loading columns…".`,
              err,
            );
            return { ...entry, status: 'failed' };
          }
          try {
            // Author gave the FK + an explicit column set but left some columns
            // untyped — hydrate just their widget types from the schema, keeping
            // their exact column set / order / labels (don't re-derive columns).
            if (d.relationshipField && d.columns?.length) {
              return { ...entry, config: { ...d, columns: hydrateColumns(d.columns, childSchema) }, status: 'ready' };
            }
            const derived = deriveDetail(d.childObject, childSchema, schema.objectName, {
              relationshipField: d.relationshipField,
              columns: d.columns,
              amountField: d.amountField,
            });
            return {
              ...entry,
              status: 'ready',
              config: {
                ...d,
                relationshipField: derived.relationshipField,
                columns: derived.columns,
                formFields: d.formFields ?? derived.formFields,
                inlineMode: d.inlineMode ?? derived.mode,
                amountField: d.amountField ?? derived.amountField,
                sortField: d.sortField ?? derived.sortField,
              },
            };
          } catch (err) {
            // THE DERIVE FAILED, on a schema that loaded fine — almost always
            // "no lookup/master_detail field on the child references the
            // parent", i.e. a configuration error the author fixes by setting
            // `relationshipField`.
            //
            // ⛔ Still NOT the refusal placeholder above: that one states the
            // schema could not be loaded, and here it was — triage's words,
            // "dishonest copy for a schema that loaded fine". What changed in
            // objectui#6394 is the OTHER half: this arm used to return the entry
            // UNRESOLVED (`return entry`), so it fell through to "Loading
            // columns…" and stayed there forever — the derive is not retried, so
            // those columns can never arrive, the same unbounded-wait-shown-as-a
            // -spinner defect objectui#5940 / objectui#6360 / objectui#6372
            // removed one arm at a time. `status: 'underivable'` routes it to a
            // config hint of its own, naming `relationshipField`.
            //
            // The error stays logged, not discarded (objectui#6372): it carries
            // the whole diagnosis — which child object, which parent, which key
            // to set — and the placeholder deliberately shows the author the
            // key, not the raw message.
            console.warn(
              `[MasterDetailForm] loaded the schema of child object "${d.childObject}" but could not derive its detail configuration; the collection cannot render its columns. Set relationshipField (and columns) explicitly on the detail entry.`,
              err,
            );
            return { ...entry, status: 'underivable' };
          }
        }),
      );
      if (!cancelled) setResolvedEntries(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, schema.objectName, schema.details]);

  /**
   * One row-state per detail collection, addressed by the collection's
   * SYNTHESIZED ENTRY ID.
   *
   * ⚠️ This used to be an ARRAY indexed in parallel with `details`, seeded once
   * at mount from the original `rawDetails` and never re-synced when the
   * authored config changed. Reordering or removing an entry therefore handed a
   * collection a different collection's rows — visible in the grid, in the
   * document subtotal, and in the batch payload on save (objectui#6371). Keyed
   * by identity, a collection can only ever read its own slot: an entry whose
   * identity is new simply finds nothing, which is the correct answer.
   */
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const rowStateRef = useRef(rowState);
  rowStateRef.current = rowState;

  // Cache of child object schemas (keyed by childObject), fetched once so the
  // client-orchestrated and atomic-batch child writes can strip computed /
  // read-only columns from each row — parity with the parent form's
  // `sanitizeFormData`. Child rows are seeded from a full record read, so an
  // edit would otherwise round-trip formula/summary columns the server rejects.
  // A ref (not state) so a late-arriving schema never re-renders — and thus
  // never resets — the header <ObjectForm> (see #1581). Reads happen at submit
  // time, long after the fetch resolves.
  const childSchemasRef = useRef<Record<string, { fields?: Record<string, any> }>>({});
  useEffect(() => {
    const ds: any = dataSource;
    if (!ds || typeof ds.getObjectSchema !== 'function') return;
    let cancelled = false;
    const objects = Array.from(new Set(rawDetails.map((d) => d.childObject).filter(Boolean)));
    (async () => {
      const entries = await Promise.all(
        objects.map(async (obj) => {
          try { return [obj, await ds.getObjectSchema(obj)] as const; }
          catch { return [obj, null] as const; }
        }),
      );
      if (cancelled) return;
      const next: Record<string, { fields?: Record<string, any> }> = {};
      for (const [obj, sch] of entries) if (sch) next[obj] = sch;
      childSchemasRef.current = next;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, schema.objectName, schema.details]);

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
        entries.map(async (e): Promise<[string, RowState]> => {
          const d = e.config;
          if (!d.relationshipField) return [e.id, { rows: [], original: [] }]; // not resolved yet
          try {
            const res = await dataSource.find(d.childObject, {
              $filter: { [d.relationshipField]: schema.recordId },
              $top: 500,
            });
            const rows = (res?.data ?? []) as Record<string, any>[];
            return [e.id, { rows: rows.map((r) => ({ ...r })), original: rows.map((r) => ({ ...r })) }];
          } catch {
            return [e.id, { rows: [], original: [] }];
          }
        }),
      );
      // Keyed by entry id, so a collection's loaded rows land in ITS slot
      // regardless of where it currently sits in the authored array.
      if (!cancelled) setRowState(Object.fromEntries(loaded));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, dataSource, schema.recordId, resolvedEntries]);

  const setRows = useCallback((entryId: string, rows: Record<string, any>[]) => {
    setRowState((prev) => ({
      ...prev,
      [entryId]: { rows, original: prev[entryId]?.original ?? [] },
    }));
  }, []);

  // Header tax-rate field name — the live value is read by <MasterDetailLines>
  // (which scrapes the header record) and drives the Subtotal / Tax / Total stack.
  const taxRateField = schema.taxRateField || 'tax_rate';

  // Per-row "expand to full form": opens the child's complete form (all business
  // fields, incl. rich types the grid omits) in a drawer, pre-filled with the
  // row. Saving writes back into the in-memory row — the atomic batch still
  // persists everything on the parent Save (no separate backend write here).
  // `isNew` marks a row created by "Add" in list/form mode — cancelling the
  // editor without applying discards that empty row.
  const [expanded, setExpanded] = useState<{ entryId: string; rowIdx: number; isNew?: boolean } | null>(null);
  const expandedRow =
    expanded ? rowState[expanded.entryId]?.rows?.[expanded.rowIdx] : undefined;
  const expandedDetail = expanded ? entries.find((e) => e.id === expanded.entryId)?.config : undefined;

  const applyRowEdit = useCallback(
    (entryId: string, rowIdx: number, values: Record<string, any>) => {
      setRowState((prev) => {
        const cur = prev[entryId] ?? { rows: [], original: [] };
        return {
          ...prev,
          [entryId]: { ...cur, rows: cur.rows.map((r, j) => (j === rowIdx ? { ...r, ...values } : r)) },
        };
      });
    },
    [],
  );

  /** List/form mode "Add": append a blank row and open it in the full form. */
  const addRowViaForm = useCallback((entryId: string) => {
    setRowState((prev) => {
      const cur = prev[entryId] ?? { rows: [], original: [] };
      const rows = [...cur.rows, {}];
      setExpanded({ entryId, rowIdx: rows.length - 1, isNew: true });
      return { ...prev, [entryId]: { ...cur, rows } };
    });
  }, []);

  /** Editor cancelled: drop the row if it was a freshly-added (empty) one. */
  const cancelRowEdit = useCallback(() => {
    setExpanded((cur) => {
      if (cur?.isNew) {
        setRowState((prev) => {
          const s = prev[cur.entryId];
          if (!s) return prev;
          return { ...prev, [cur.entryId]: { ...s, rows: s.rows.filter((_, j) => j !== cur.rowIdx) } };
        });
      }
      return null;
    });
  }, []);

  /**
   * Built-in feedback so a save is NEVER silent (a silent success looks broken
   * and invites duplicate submits). On CREATE also clears the form for the next
   * entry by resetting the line items + remounting the parent form.
   *
   * The success toast is only our fallback: when the host supplies `onSuccess`
   * it owns confirmation (e.g. the console toasts a localized message via its
   * crud-success handler), so we stay quiet to avoid double-confirming — the
   * same contract flat `ObjectForm` follows. Without a host `onSuccess` we keep
   * the built-in toast so the save is never silent.
   */
  const handleSaved = useCallback(
    async (parent: any) => {
      releaseSave();
      if (!schema.onSuccess) {
        toast.success(isEdit ? (schema.title ? `${schema.title} saved` : 'Saved') : 'Created');
      }
      if (!isEdit) {
        // Every collection back to empty for the next entry. Dropping the whole
        // record is the same statement the per-detail rebuild made, without
        // re-deriving it from positions.
        setRowState({});
        setFormKey((k) => k + 1);
      }
      await schema.onSuccess?.(parent);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEdit, schema.onSuccess, schema.title, entries.length, releaseSave],
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

  // Persistence ALWAYS goes through dataSource.batchTransaction: the parent and
  // all child collections are expressed as one ordered operation list and
  // handed to runBatchTransaction, which uses the adapter's atomic endpoint
  // when present and emulates it (sequential + best-effort compensation)
  // otherwise. This covers BOTH create (parent + child creates via `$ref`) and
  // edit (parent update + child create/update/delete diffs). There is no
  // separate client-orchestrated / cleanup path anymore (#2679).
  const submitViaBatch = useCallback(
    async (parentValues: Record<string, any>) => {
      if (!dataSource) throw new Error('MasterDetailForm: dataSource is required');
      const parentData: Record<string, any> = { ...parentValues };
      // Client-side rollups merged into the parent payload (hooks can't do
      // nested writes — see ADR-0001).
      entries.forEach((e) => {
        const d = e.config;
        if (d.totalField) {
          parentData[d.totalField] = sumRows(rowStateRef.current[e.id]?.rows ?? [], d.amountField || 'amount');
        }
      });
      const ops = isEdit
        ? buildMasterDetailEditBatch(
            schema.objectName,
            String(schema.recordId),
            parentData,
            // ⚠️ Read by ENTRY ID. This was
            // `.filter(…).map((d, i) => stateRef.current[i])`, where `i` indexes
            // the FILTERED array while the row state was indexed against the
            // FULL one — so a declined or unresolved entry sitting above a real
            // collection shifted every read below it by one and that
            // collection's rows were silently dropped from the transaction.
            // Data loss on save, not a display defect (objectui#6371).
            entries.filter((e) => e.config.relationshipField).map((e) => ({
              childObject: e.config.childObject,
              relationshipField: e.config.relationshipField!,
              rows: rowStateRef.current[e.id]?.rows ?? [],
              original: rowStateRef.current[e.id]?.original ?? [],
              childSchema: childSchemasRef.current[e.config.childObject],
            })),
          )
        : buildMasterDetailBatch(
            schema.objectName,
            parentData,
            // Same identity read as the edit branch above, for the same reason.
            entries.filter((e) => e.config.relationshipField).map((e) => ({
              childObject: e.config.childObject,
              relationshipField: e.config.relationshipField!,
              rows: rowStateRef.current[e.id]?.rows ?? [],
              childSchema: childSchemasRef.current[e.config.childObject],
            })),
          );
      const res = await runBatchTransaction(dataSource, ops);
      // create → parent is op 0; edit → echo the parent values back.
      return res?.results?.[0] ?? { ...parentData, id: schema.recordId };
    },
    [dataSource, entries, schema.objectName, schema.recordId, isEdit],
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
      // Carry prefilled header values into the parent form (create-mode
      // wizards, e.g. lead conversion prefilling name/account).
      initialValues: schema.initialValues,
      initialData: schema.initialData,
      formType: schema.formType,
      sections: schema.sections,
      fields: schema.fields,
      title: schema.title,
      showSubmit: false,
      showCancel: false,
      // ObjectForm validates + hands the parent values to submitViaBatch (which
      // persists parent + children as one batch via dataSource.batchTransaction),
      // then handleSaved (toast + reset + page onSuccess).
      submitHandler: submitViaBatch,
      onSuccess: handleSaved,
      onError: handleError,
    }),
    [schema, submitViaBatch, handleSaved, handleError],
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

  return (
    <div className={cn('space-y-6', className, schema.className)}>
      {/* 1) Header fields on top */}
      <div ref={formHostRef}>
        <ObjectForm key={formKey} schema={parentSchema as any} dataSource={dataSource} />
      </div>

      {/* 2) Line items + document totals, in a sibling component that owns the
          live header record (scraped from the form host) so header edits never
          re-render — and thus never reset — the header <ObjectForm> (see #1581). */}
      <MasterDetailLines
        entries={entries}
        rowState={rowState}
        setRows={setRows}
        formHostRef={formHostRef}
        taxRateField={taxRateField}
        formKey={formKey}
        onRowExpand={(entryId, rowIdx) => setExpanded({ entryId, rowIdx })}
        onAddViaForm={addRowViaForm}
        parentObjectName={schema.objectName}
      />

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
              key={`row-${expanded.entryId}-${expanded.rowIdx}`}
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
                  applyRowEdit(expanded.entryId, expanded.rowIdx, values);
                  setExpanded(null);
                },
                onCancel: cancelRowEdit,
              } as any}
              dataSource={dataSource}
            />
          </CardContent>
        </Card>
      )}

      {/* Single action bar at the bottom — suppressed when the host opts out
          (e.g. the Studio screen-preview, which must never persist). */}
      {schema.showSubmit !== false && (
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          {schema.onCancel && (
            <Button type="button" variant="outline" onClick={schema.onCancel} disabled={saving} data-testid="md-form-cancel">
              {schema.cancelText ?? 'Cancel'}
            </Button>
          )}
          <Button type="button" onClick={handleSave} disabled={saving || (needsDerive && !resolvedEntries)} data-testid="md-form-submit">
            {saving ? 'Saving…' : submitText}
          </Button>
        </div>
      )}
    </div>
  );
};
