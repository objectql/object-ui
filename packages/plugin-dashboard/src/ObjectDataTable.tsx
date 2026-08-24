/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useDataScope, SchemaRendererContext, SchemaRenderer, useFilterScope } from '@object-ui/react';
import {
  extractRecords,
  isDrillEnabled,
  columnIdentity,
  columnHeader,
} from '@object-ui/core';
import type { DrillDownConfig } from '@object-ui/types';
import { Skeleton, RefreshIndicator, cn } from '@object-ui/components';
import { useSafeFieldLabel, useObjectTranslation, useLocalization, useDisplayLocale } from '@object-ui/i18n';
import { resolveFilterPlaceholders, humanizeFieldKey } from './utils';
import {
  buildFieldMeta,
  renderFieldValue,
  isNumericFieldMeta,
  isSystemField,
  // The package's single relation predicate (objectui#5876). The retirement
  // gate and the family read live in ITS body — never restated here.
  isLookupType,
} from './recordFields';
import { RecordDetailDrawer } from './RecordDetailDrawer';

export interface ObjectDataTableProps {
  schema: {
    type: string;
    objectName?: string;
    dataProvider?: { provider: string; object?: string };
    bind?: string;
    filter?: any;
    data?: any[];
    columns?: any[];
    searchable?: boolean;
    pagination?: boolean;
    className?: string;
    [key: string]: any;
  };
  dataSource?: any;
  className?: string;
}

/** A column definition after normalization, with header and accessor key. */
interface NormalizedColumn {
  header: string;
  accessorKey: string;
  [key: string]: any;
}

/**
 * Shared empty fallback for the resolved row list (objectui#4629).
 *
 * `Array.isArray(rawData) ? rawData : []` evaluates a FRESH array on every
 * render, and that value is a dependency of the `derivedColumns` memo below.
 * So for as long as `rawData` is a non-array — a provider-config `data`, or a
 * `bind` path that resolves to an object — the memo's key changes on every
 * render and every column is re-derived (`buildFieldMeta`, a fresh `cell`
 * closure per column, the `isSystemField` pass, the `fieldLabel` lookups) only
 * to be discarded: `finalData.length === 0` is exactly the case in which the
 * component returns its empty state without ever rendering the table.
 * Hoisting the empty to module scope makes "no rows yet" a stable value, so
 * the memo sees what is actually true — nothing changed.
 *
 * The same move `data-table.tsx` made for its own `EMPTY_ROWS` (objectui#4618,
 * PR #4623). This file is the `provider: 'object'` sibling of that one, so it
 * takes the same shape rather than a second remedy for one defect class.
 *
 * Frozen so a consumer that mutates the array it was handed cannot corrupt the
 * shared instance for every other table on the page.
 */
const EMPTY_ROWS = Object.freeze([]) as unknown as any[];

/**
 * Normalize columns to support both string[] shorthand and object[] formats.
 *
 * - `string[]` entries are converted to `{ header, accessorKey }` objects,
 *   handling both snake_case and camelCase for header generation.
 * - Object entries have their field identity AND their display text RESOLVED
 *   here, at the producer, and stamped onto the data-table adapter's own keys
 *   (`accessorKey` / `header`). The adapter reads only those two, and no longer
 *   falls back to `name` / `label` (objectui#5120, objectui#5351).
 *
 * Object entries used to be returned raw (objectui#5120). `accessorKey` is the
 * table LIBRARY's column key — `column-identity.ts` names it
 * `TABLE_ADAPTER_COLUMN_KEY` and deliberately holds the metadata-identity fold
 * away from it — so a column authored in the spec-canonical spelling
 * (`{ field: 'stage' }`) reached the adapter carrying no `accessorKey` at all
 * and rendered a header over `row[undefined]`: blank cells, no warning. The
 * `$expand` whitelist in `computeLookupExpand` missed it for the same reason,
 * so a `field`-spelled lookup column also lost its related record.
 *
 * Resolving it HERE is the move objectui#5022 made in `RelatedList` and
 * objectui#5068 generalized in `ObjectGrid`: metadata vocabulary in, adapter
 * vocabulary out, one translation in one place. The adapter stays monolingual;
 * the producer owns the translation.
 *
 * Mirror, don't move — the same three rules `RelatedList` states:
 *  - an author-supplied `accessorKey` is NEVER overwritten; a deliberate
 *    divergence between the table slot and the metadata key belongs to the
 *    author;
 *  - the authored spelling is left in place, so a host reading `field` / `name`
 *    back off these columns keeps working;
 *  - an entry with neither a resolvable identity nor any display text is
 *    returned UNTOUCHED — nothing is invented for it. It behaves exactly as it
 *    does today: a header over empty cells, silently. Whether that silence
 *    deserves a dev-time diagnostic is objectui#5349's question, and is
 *    deliberately NOT answered here.
 *
 * Returning the INPUT entry by reference when there is nothing to add is load
 * bearing: data-table re-seeds its column state whenever the list is a new
 * object (objectui#4618), and this widget rebuilds its node on every render.
 */
export function normalizeColumns(columns: (string | Record<string, any>)[]): NormalizedColumn[] {
  return columns.map((col) => {
    if (typeof col === 'string') {
      // Shared with the static-table derivation so both halves of the `table`
      // widget family spell a header the same way (objectui#4618).
      return { header: humanizeFieldKey(col), accessorKey: col };
    }
    if (!col) return col as NormalizedColumn;
    const patch: Record<string, unknown> = {};
    // Identity: `accessorKey` is the adapter's key, so an author who supplied
    // it addressed the table directly and is never second-guessed.
    if (!col.accessorKey) {
      const key = columnIdentity(col);
      if (key) patch.accessorKey = key;
    }
    // Display text: the same boundary, seen from the label side
    // (objectui#5351). The spec spells it `label`, the adapter spells it
    // `header`, and the adapter no longer reads `label` — so the translation
    // happens HERE, before delivery, or the column arrives headerless.
    //
    // This is a FIX as well as a move: `enrich` below spreads `buildFieldMeta`'s
    // result over the column, and that result carries its own `label` (built
    // from `col.header`), so an authored `label` was overwritten before it ever
    // reached the adapter's alias. A `{ field, label }` column rendered a BLANK
    // header here even while the alias still existed — measured, not assumed.
    if (!col.header) {
      const text = columnHeader(col);
      if (text) patch.header = text;
    }
    // Nothing to add: return the INPUT entry by reference, so data-table's
    // column-state re-seed stays quiet on the common path (objectui#4618).
    if (Object.keys(patch).length === 0) return col as NormalizedColumn;
    return { ...col, ...patch } as NormalizedColumn;
  });
}

/**
 * ObjectDataTable — Async-aware wrapper for data-table.
 *
 * When `objectName` is provided and a `dataSource` is available via context
 * or props, fetches records automatically and passes them to the registered
 * `data-table` component via SchemaRenderer.
 *
 * Also auto-derives columns from fetched data keys when no explicit columns
 * are configured.
 *
 * Lifecycle states:
 * - **Loading** → skeleton placeholder
 * - **Error** → error message
 * - **Empty** → friendly "No data available" message
 * - **Data** → data-table with fetched rows
 */
/**
 * Compute the list of lookup-typed accessors that should be expanded when
 * fetching rows. Returns column accessors whose object schema field type is
 * a relation. Neither the type family nor the test itself is restated here:
 * this delegates to {@link isLookupType} in `recordFields.tsx`, the package's
 * single relation predicate, which reads `EXPANDABLE_FIELD_TYPES` — the family
 * `@object-ui/core` publishes. Used
 * by the dashboard table widget to ask the data adapter to populate referenced
 * records (e.g. `account: { id, name }`) so cells don't show raw FK ids.
 *
 * THE GATE (objectui#4914, ruling B) runs ahead of the relation test. Measured
 * before the ruling: a `record_owner: { type: 'owner' }` column was ACTIVELY
 * requested for `$expand` — the retired spelling got the full relational read
 * path while the same field's editor answered with a tombstone. It is refused
 * now, loudly and once, and the cell shows the raw id it was always going to
 * show once the spelling stopped being a relation. That the author is TOLD is
 * the whole difference between this and the mechanical deletion the
 * measurement rejected.
 *
 * ## The relation test is core's object, not a private copy (objectui#5692)
 *
 * It used to be the inline literal
 * `t === 'lookup' || t === 'reference' || t === 'master_detail' || t === 'user'`
 * — one of TWO copies this package held (the other `LOOKUP_TYPES` in
 * `recordFields.tsx`), neither deriving from nor pinned against the family core
 * publishes. objectui#5312's claim to have converted "the LAST private copy"
 * was false by these two; they predate that sweep and were outside its file
 * surface.
 *
 * This is the LIVE half of that convergence — `computeLookupExpand` drives a
 * real `$expand` on every dashboard table fetch — so both membership deltas are
 * observable here, and both were decided by measurement (see `isLookupType` in
 * `recordFields.tsx` for the full record):
 *
 *  - a `tree` column now GETS `$expand`-ed, the same treatment the form / grid
 *    road already gives it;
 *  - a `reference` column no longer does, and that is a no-op on spec-compliant
 *    data: the spelling is absent from `@objectstack/spec`'s closed `FieldType`
 *    and refused by `FieldSchema.safeParse`, so no object schema can declare a
 *    field whose stored type is `reference`.
 *
 * ## One predicate, not two that agree by coincidence (objectui#5876)
 *
 * This function used to carry its own `isLookup`, byte-identical to
 * `isLookupType` once objectui#5692 had pointed both at the same set — two
 * bodies that agreed because one sweep aligned them, with nothing keeping them
 * aligned afterwards. The test IS `isLookupType` now, so this module no longer
 * IMPORTS the shared family or the retirement gate and no longer CALLS either
 * (they are named in this prose and nowhere else in the file). That absence is
 * the assertion: a BEHAVIOURAL test cannot see this change, because a
 * byte-identical local copy satisfies every boolean claim you can make about
 * `$expand`. The pin that can see it is the identity pin in
 * `__tests__/expandableFamily.identity-5692.test.ts`.
 */
export function computeLookupExpand(
  schema: { columns?: any[]; objectName?: string },
  objectSchema: any,
): string[] {
  if (!objectSchema?.fields) return [];
  const fieldsByName: Record<string, any> = {};
  if (Array.isArray(objectSchema.fields)) {
    for (const def of objectSchema.fields) if (def?.name) fieldsByName[def.name] = def;
  } else {
    for (const [name, def] of Object.entries(objectSchema.fields)) fieldsByName[name] = { name, ...(def as any) };
  }
  const cols = Array.isArray(schema.columns) ? schema.columns : [];
  const out = new Set<string>();

  if (cols.length > 0) {
    // Explicit columns whitelist: only expand the relations the user asked for.
    // One reader for identity, the same one `normalizeColumns` stamps with
    // (objectui#5120). This used to be `c.accessorKey || c.name` — name-first,
    // and blind to the spec-canonical `field` — so a `field`-spelled lookup
    // column was left out of `$expand` and its cell showed a raw FK id while
    // the whitelist claimed the author had not asked for it. The adapter key
    // still wins when the author supplied one, exactly as it does in
    // `normalizeColumns`, so both halves resolve the same column.
    const accessors = cols
      .map((c: any) => (typeof c === 'string' ? c : (c?.accessorKey || columnIdentity(c))))
      .filter(Boolean);
    for (const acc of accessors) {
      const def = fieldsByName[acc];
      if (def && isLookupType(def.type)) out.add(acc);
    }
  } else {
    // No columns whitelist (auto-derive mode, e.g. drill-down drawer):
    // expand every lookup-type field known from the schema so cells show
    // the related record's display name instead of a bare FK id.
    for (const [name, def] of Object.entries(fieldsByName)) {
      if (isLookupType((def as any)?.type)) out.add(name);
    }
  }
  return Array.from(out);
}

export const ObjectDataTable: React.FC<ObjectDataTableProps> = ({ schema, dataSource: propDataSource, className }) => {
  // Tenant default currency backstops columns that omit an explicit code.
  const { currency: tenantCurrency } = useLocalization();
  // objectui#4553: percent/number cells are FORMATTED inside the memo below,
  // so the locale is both an argument and a dependency of it.
  const displayLocale = useDisplayLocale();
  const context = useContext(SchemaRendererContext);
  const dataSource = propDataSource || context?.dataSource;
  const boundData = useDataScope(schema.bind);
  const { fieldLabel, fieldOptionLabel } = useSafeFieldLabel();
  let noDataLabel = 'No data available';
  let noDataSourceLabel = 'No data source available for';
  // useObjectTranslation is provider-safe (react-i18next falls back to the
  // global instance and never throws), so call it directly — no try/catch,
  // which would make the hook conditional. The English defaults above stand
  // until a translation resolves.
  const { t } = useObjectTranslation();
  const a = t('dashboard.noDataAvailable');
  if (a && a !== 'dashboard.noDataAvailable') noDataLabel = a;
  const b = t('dashboard.noDataSourceFor');
  if (b && b !== 'dashboard.noDataSourceFor') noDataSourceLabel = b;

  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [objectSchema, setObjectSchema] = useState<any>(null);
  // Start in loading state when we will fetch from a dataSource, so the
  // "No data available" empty state doesn't flash on slow networks before
  // the fetch effect runs and flips loading to true.
  const [loading, setLoading] = useState<boolean>(() => {
    const hasInline = Array.isArray(schema.data) && schema.data.length > 0;
    return !hasInline && !!(schema.objectName);
  });
  const [error, setError] = useState<string | null>(null);

  // --- Drill-to-record ---------------------------------------------------
  // Table / list widgets drill *to record*: clicking a row opens that single
  // record in a detail drawer (the row already IS a record, so there is no
  // filter to derive). Opt-in via `schema.drillDown` — DashboardRenderer
  // defaults object-backed table/list widgets to `{ enabled: true }`.
  const drillDown = schema.drillDown as DrillDownConfig | undefined;
  const recordDrillEnabled = isDrillEnabled(drillDown) && (drillDown?.mode ?? 'record') === 'record';
  const [drillRecord, setDrillRecord] = useState<Record<string, any> | null>(null);
  const handleRowClick = useCallback((row: Record<string, any>) => {
    setDrillRecord(row ?? null);
  }, []);

  // Session scope for `{current_user_id}` / `{current_org_id}` in the schema
  // filter. Read at component level — the fetch below is async, and hooks
  // cannot be called from inside it.
  const filterScope = useFilterScope();

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!dataSource || !schema.objectName) {
        // No way to fetch — clear loading so the empty / no-datasource state
        // can render instead of an indefinite skeleton.
        if (isMounted) setLoading(false);
        return;
      }
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        let data: any[];

        if (typeof dataSource.find === 'function') {
          // If we know the schema, ask the server to expand lookup columns so
          // cells can render the related record's display name instead of a
          // bare FK id. Adapters that don't understand `$expand` ignore it.
          const expand = computeLookupExpand(schema, objectSchema);
          const params: any = { $filter: resolveFilterPlaceholders(schema.filter, filterScope) };
          if (expand.length) params.$expand = expand;
          const results = await dataSource.find(schema.objectName, params);
          data = extractRecords(results);
        } else {
          return;
        }

        if (isMounted) {
          setFetchedData(data);
        }
      } catch (e) {
        console.error('[ObjectDataTable] Fetch error:', e);
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Failed to load data');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (schema.objectName && !boundData && (!schema.data || schema.data.length === 0)) {
      fetchData();
    } else if (isMounted) {
      // We have inline / bound data and won't fetch — make sure loading is
      // cleared (matters when we lazily-initialized it to true).
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, objectSchema, filterScope]);

  // Fetch object schema for column-header translation and select-option cell labels.
  useEffect(() => {
    let isMounted = true;
    if (!dataSource || !schema.objectName || typeof dataSource.getObjectSchema !== 'function') {
      return;
    }
    dataSource.getObjectSchema(schema.objectName)
      .then((s: any) => { if (isMounted) setObjectSchema(s); })
      .catch(() => { /* schema lookup failure is non-fatal */ });
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  // Resolve data: bound data > static schema data > fetched data
  const rawData = boundData || schema.data || fetchedData;
  const finalData = Array.isArray(rawData) ? rawData : EMPTY_ROWS;

  // Auto-derive columns from data keys when none are provided. When `objectName`
  // is set, prefer translated field labels via the convention-based hook so that
  // headers automatically pick up i18n bundles.
  //
  // Each column is also enriched with `type/options/referenceTo/format` from
  // the bound object schema and gets a `cell:` render function that delegates
  // to `getCellRenderer` from `@object-ui/fields`. This produces the same
  // type-aware rendering as ObjectGrid / list views and the report viewer
  // (Badge for select, link for lookup, ✓/✗ for boolean, mailto:/tel: links,
  // currency/percent/date formatting honouring the column's `format` prop).
  const derivedColumns = useMemo(() => {
    const objectName = schema.objectName;
    const fieldsByName: Record<string, any> = {};
    if (objectSchema?.fields) {
      const f = objectSchema.fields;
      if (Array.isArray(f)) {
        for (const def of f) {
          if (def?.name) fieldsByName[def.name] = def;
        }
      } else {
        for (const [name, def] of Object.entries(f)) {
          fieldsByName[name] = { name, ...(def as any) };
        }
      }
    }

    // The AUTO-DERIVED half of this widget's headers. It spells the convention
    // with `humanizeFieldKey` — the same function `normalizeColumns` (the
    // DECLARED half, above) and `deriveStaticTableColumns` (the static half of
    // the same `table` widget family) already use, whose docstring names itself
    // the single home for this convention "because both halves of the `table`
    // widget family need it and they must agree".
    //
    // This line used to carry a THIRD, inline spelling that split camelCase but
    // never turned `_` into a space, so one field key rendered under two
    // spellings on one dashboard — measured, as headers over the same
    // `crm_opportunity` columns (objectui#5425):
    //
    //   auto-derived (here)                 Close_date · Needs_analysis
    //   declared `columns: ['close_date']`  Close Date · Needs Analysis
    //   static `data-table`, no columns     Close Date · Needs Analysis
    //
    // That is the defect class objectui#5425 rules out — "a value cannot appear
    // twice under two spellings" — so the odd one out adopts the convention
    // rather than the convention gaining a fourth dialect. The i18n wrapper is
    // unchanged: a bundle entry still wins, and this is only its fallback.
    const buildHeader = (k: string) => {
      const humanized = humanizeFieldKey(k);
      return objectName ? fieldLabel(objectName, k, humanized) : humanized;
    };

    const enrich = (col: NormalizedColumn): NormalizedColumn => {
      // Build the shared FieldMeta (translated select options, resolved
      // referenceTo / currency / decimals). Column-level props override the
      // schema-derived values. Lookup fields just pass `referenceTo` through —
      // the server expands them via `$expand` so the cell value is `{ id, name }`,
      // which the lookup/user cell renderers handle natively.
      const fieldMeta = buildFieldMeta({
        accessorKey: col.accessorKey,
        label: col.header,
        def: fieldsByName[col.accessorKey],
        objectName,
        fieldOptionLabel,
        overrides: {
          type: col.type,
          format: col.format,
          options: col.options,
          referenceTo: (col as any).referenceTo,
          currency: (col as any).currency,
          decimals: (col as any).decimals,
        },
      });

      // Numeric-flavoured columns look better right-aligned (tabular-nums
      // already on the cell). Honor an explicit `align` if the author set one.
      const inferredAlign = (col as any).align
        ?? (isNumericFieldMeta(fieldMeta) ? 'right' : undefined);

      if (typeof col.cell === 'function') return { ...col, ...fieldMeta, align: inferredAlign };

      // Tenant-default currency backstops a currency column with no explicit code.
      const cell = (value: any): React.ReactNode => renderFieldValue(value, fieldMeta, tenantCurrency, displayLocale);
      return { ...col, ...fieldMeta, align: inferredAlign, cell };
    };

    if (schema.columns && schema.columns.length > 0) {
      const normalized = normalizeColumns(schema.columns);
      const withHeaders = !objectName
        ? normalized
        : normalized.map((col) => ({ ...col, header: fieldLabel(objectName, col.accessorKey, col.header) }));
      return withHeaders.map(enrich);
    }
    if (finalData.length === 0) return [];

    // Auto-derived columns hide framework/system audit fields by default
    // (shared `isSystemField` denylist). Users wanting them can pass an
    // explicit `columns` whitelist.
    // Prefer the objectSchema field order (declaration order = author intent)
    // and drop system fields. Fall back to the row's keys when no schema
    // is loaded, applying the same denylist.
    const orderedKeys = Object.keys(fieldsByName).length > 0
      ? Object.keys(fieldsByName).filter((k) => !isSystemField(k, fieldsByName[k]))
      : Object.keys(finalData[0]).filter((k) => !k.startsWith('_') && !isSystemField(k));

    return orderedKeys.map((k) => enrich({ header: buildHeader(k), accessorKey: k }));
  }, [schema.columns, schema.objectName, finalData, objectSchema, fieldLabel, fieldOptionLabel, tenantCurrency, displayLocale]);

  // Note: per-cell select-label translation that used to happen here is now
  // handled by SelectCellRenderer in the shared field registry, which also
  // takes care of badge styling and option colors. The raw data is passed
  // straight through to the underlying data-table.

  // Loading skeleton
  if (loading && finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-loading">
        <div className="space-y-2 p-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/4" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-error">
        <div className="flex flex-col items-center justify-center py-8 text-destructive" data-testid="table-error-message">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  // No data source available but objectName configured
  if (!dataSource && schema.objectName && finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)}>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p className="text-xs">{noDataSourceLabel} &ldquo;{schema.objectName}&rdquo;</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="table-empty-state">
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <p className="text-xs">{noDataLabel}</p>
        </div>
      </div>
    );
  }

  // Delegate to data-table via SchemaRenderer. Wrap in a positioned container
  // so the re-fetch indicator can anchor to the top of the table when a
  // refresh is in flight while existing rows remain visible.
  // Honor an author-supplied onRowClick; otherwise wire the drill-to-record
  // handler when drill-down is enabled. The base data-table guards against
  // firing on interactive cells (buttons / menus / dialogs).
  const tableSchema = {
    ...schema,
    type: 'data-table',
    data: finalData,
    columns: derivedColumns,
    onRowClick: (schema as any).onRowClick ?? (recordDrillEnabled ? handleRowClick : undefined),
  };

  // A `${event.*}` template (filter-mode title) is meaningless for a single
  // record — fall back to the record's display name in that case.
  const recordTitle =
    drillDown?.title && !drillDown.title.includes('${') ? drillDown.title : undefined;

  return (
    <div className={cn('relative', className)}>
      <RefreshIndicator active={loading && finalData.length > 0} />
      <SchemaRenderer schema={tableSchema} className={className} />
      {recordDrillEnabled && (
        <RecordDetailDrawer
          record={drillRecord}
          objectName={schema.objectName}
          objectSchema={objectSchema}
          fields={drillDown?.columns}
          title={recordTitle}
          target={drillDown?.target === 'dialog' ? 'dialog' : 'drawer'}
          onClose={() => setDrillRecord(null)}
        />
      )}
    </div>
  );
};
