/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useDataScope, SchemaRendererContext, SchemaRenderer } from '@object-ui/react';
import { extractRecords, isDrillEnabled } from '@object-ui/core';
import type { DrillDownConfig } from '@object-ui/types';
import { Skeleton, RefreshIndicator, cn } from '@object-ui/components';
import { useSafeFieldLabel, useObjectTranslation, useLocalization } from '@object-ui/i18n';
import { resolveDateMacros } from './utils';
import {
  buildFieldMeta,
  renderFieldValue,
  isNumericFieldMeta,
  isSystemField,
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
 * Normalize columns to support both string[] shorthand and object[] formats.
 *
 * - `string[]` entries are converted to `{ header, accessorKey }` objects,
 *   handling both snake_case and camelCase for header generation.
 * - Object entries are returned as-is.
 */
export function normalizeColumns(columns: (string | Record<string, any>)[]): NormalizedColumn[] {
  return columns.map((col) => {
    if (typeof col === 'string') {
      return {
        header: col
          // snake_case → spaces
          .replace(/_/g, ' ')
          // camelCase → spaces before uppercase letters
          .replace(/([A-Z])/g, ' $1')
          .trim()
          // Title Case each word
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        accessorKey: col,
      };
    }
    return col as NormalizedColumn;
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
 * a relation (lookup/reference/master_detail/user/owner). Used by the
 * dashboard table widget to ask the data adapter to populate referenced
 * records (e.g. `account: { id, name }`) so cells don't show raw FK ids.
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
  const isLookup = (t: unknown) =>
    t === 'lookup' || t === 'reference' || t === 'master_detail' || t === 'user' || t === 'owner';

  const cols = Array.isArray(schema.columns) ? schema.columns : [];
  const out = new Set<string>();

  if (cols.length > 0) {
    // Explicit columns whitelist: only expand the relations the user asked for.
    const accessors = cols
      .map((c: any) => (typeof c === 'string' ? c : (c.accessorKey || c.name)))
      .filter(Boolean);
    for (const acc of accessors) {
      const def = fieldsByName[acc];
      if (def && isLookup(def.type)) out.add(acc);
    }
  } else {
    // No columns whitelist (auto-derive mode, e.g. drill-down drawer):
    // expand every lookup-type field known from the schema so cells show
    // the related record's display name instead of a bare FK id.
    for (const [name, def] of Object.entries(fieldsByName)) {
      if (isLookup((def as any)?.type)) out.add(name);
    }
  }
  return Array.from(out);
}

export const ObjectDataTable: React.FC<ObjectDataTableProps> = ({ schema, dataSource: propDataSource, className }) => {
  // Tenant default currency backstops columns that omit an explicit code.
  const { currency: tenantCurrency } = useLocalization();
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
          const params: any = { $filter: resolveDateMacros(schema.filter) };
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
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, objectSchema]);

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
  const finalData = Array.isArray(rawData) ? rawData : [];

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

    const buildHeader = (k: string) => {
      const humanized = k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1');
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
      const cell = (value: any): React.ReactNode => renderFieldValue(value, fieldMeta, tenantCurrency);
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
  }, [schema.columns, schema.objectName, finalData, objectSchema, fieldLabel, fieldOptionLabel, tenantCurrency]);

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
