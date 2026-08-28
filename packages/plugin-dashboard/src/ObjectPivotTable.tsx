/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useContext } from 'react';
import { useDataScope, SchemaRendererContext, useFilterScope } from '@object-ui/react';
import { useSafeFieldLabel } from '@object-ui/i18n';
import { extractRecords, computeDrillFilter, isDrillEnabled, resolveDrillTitle, type DrillEvent } from '@object-ui/core';
import { Skeleton, cn } from '@object-ui/components';
import { PivotTable } from './PivotTable';
import { DrillDownDrawer } from './DrillDownDrawer';
import { resolveFilterPlaceholders } from './utils';
import type { PivotTableSchema } from '@object-ui/types';

/**
 * Shared empty fallback for the resolved row list (objectui#4629).
 *
 * `Array.isArray(rawData) ? rawData : []` evaluates a FRESH array on every
 * render, and this component hands the result straight to `PivotTable` as
 * `finalSchema.data`, where it is the identity key of the cross-tabulation
 * memo (`PivotTable.tsx`, `[data, rowField, columnField, valueField,
 * aggregation]`). So while `rawData` is a non-array — a provider-config
 * `data`, or a `bind` path that resolves to an object — that memo rebuilds its
 * row/column sets, bucket map and totals on every render over nothing at all.
 * A module-scope empty makes "no rows yet" a stable value, and the
 * `Array.isArray` arm downstream passes it through unchanged, so the memo
 * holds.
 *
 * The same move `data-table.tsx` made for its own `EMPTY_ROWS` (objectui#4618,
 * PR #4623) and `ObjectDataTable.tsx` makes for the identical expression.
 *
 * Frozen so a consumer that mutates the array it was handed cannot corrupt the
 * shared instance for every other pivot on the page.
 */
const EMPTY_ROWS = Object.freeze([]) as unknown as any[];

export interface ObjectPivotTableProps {
  schema: PivotTableSchema & {
    objectName?: string;
    dataProvider?: { provider: string; object?: string };
    bind?: string;
    filter?: any;
  };
  dataSource?: any;
  className?: string;
}

/**
 * ObjectPivotTable — Async-aware wrapper around PivotTable.
 *
 * When `objectName` is provided and a `dataSource` is available via context
 * or props, fetches records automatically and passes them to PivotTable.
 *
 * Lifecycle states:
 * - **Loading** → skeleton placeholder
 * - **Error** → error message
 * - **Empty** → friendly "No data available" (delegated to PivotTable)
 * - **Data** → PivotTable with fetched rows
 */
export const ObjectPivotTable: React.FC<ObjectPivotTableProps> = ({ schema, dataSource: propDataSource, className }) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = propDataSource || context?.dataSource;
  const boundData = useDataScope(schema.bind);

  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-field value→label maps and field-name→display-label mapping derived
  // from the referenced object's schema. Lets the pivot table render
  // select-field display labels (e.g. "Web") instead of raw stored values
  // (e.g. "web"), and use the field's display label (e.g. "Stage") in the
  // top-left header cell.
  const [fieldLabelMaps, setFieldLabelMaps] = useState<Record<string, Record<string, string>>>({});
  const [fieldNameLabels, setFieldNameLabels] = useState<Record<string, string>>({});
  // Drill-down click event — declared with the other hooks (above any
  // conditional early return) to keep React's hook order stable.
  const [drillEvent, setDrillEvent] = useState<DrillEvent | null>(null);

  // i18n: translate field display labels and select option labels via the
  // standard object/field translation conventions.
  const { fieldLabel, fieldOptionLabel } = useSafeFieldLabel();

  useEffect(() => {
    if (!dataSource || !schema.objectName) return;
    const getSchema = (dataSource as any).getObjectSchema;
    if (typeof getSchema !== 'function') return;
    let alive = true;
    Promise.resolve(getSchema.call(dataSource, schema.objectName))
      .then((s: any) => {
        if (!alive || !s?.fields) return;
        const objectName = schema.objectName!;
        const maps: Record<string, Record<string, string>> = {};
        const nameLabels: Record<string, string> = {};
        for (const [fieldName, fieldDef] of Object.entries<any>(s.fields)) {
          const rawLabel = fieldDef?.label ? String(fieldDef.label) : fieldName;
          nameLabels[fieldName] = fieldLabel(objectName, fieldName, rawLabel);
          const opts = fieldDef?.options;
          if (Array.isArray(opts) && opts.length > 0) {
            const m: Record<string, string> = {};
            for (const opt of opts) {
              if (opt && opt.value !== undefined && opt.label !== undefined) {
                const value = String(opt.value);
                const fallback = String(opt.label);
                m[value] = fieldOptionLabel(objectName, fieldName, value, fallback);
              }
            }
            if (Object.keys(m).length > 0) maps[fieldName] = m;
          }
        }
        setFieldLabelMaps(maps);
        setFieldNameLabels(nameLabels);
      })
      .catch(() => { /* silently fall back to raw values */ });
    return () => { alive = false; };
    // `fieldLabel` / `fieldOptionLabel` are REAL dependencies: the derivation
    // above calls both, so a run with a stale resolver stores stale labels in
    // `fieldLabelMaps` / `fieldNameLabels` and the pivot's headers and cells
    // render in the wrong language until some unrelated dependency happens to
    // move. They used to be hidden behind refs because `useSafeFieldLabel()`
    // returned a fresh object on every render outside an i18next provider,
    // which would have made this effect re-run on every render — and, because
    // it ends in two `setState` calls with freshly built objects, each run
    // scheduled the next one: an unbounded derive loop. `useObjectLabel`'s memo
    // now holds on both paths (objectui#5564), so these identities change only
    // when the resolver genuinely changes — a provider mounting, or a language
    // switch — and the effect settles after one run per such change.
    // Pinned by `ObjectPivotTable.i18nResolverDeps.test.tsx` (objectui#5625).
  }, [dataSource, schema.objectName, fieldLabel, fieldOptionLabel]);

  // Session scope for `{current_user_id}` / `{current_org_id}` in the schema
  // filter. Read at component level — the fetch below is async.
  const filterScope = useFilterScope();

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!dataSource || !schema.objectName) return;
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        let data: any[];

        if (typeof dataSource.find === 'function') {
          const results = await dataSource.find(schema.objectName, {
            $filter: resolveFilterPlaceholders(schema.filter, filterScope),
          });
          data = extractRecords(results);
        } else {
          return;
        }

        if (isMounted) {
          setFetchedData(data);
        }
      } catch (e) {
        console.error('[ObjectPivotTable] Fetch error:', e);
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Failed to load data');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (schema.objectName && !boundData && (!schema.data || schema.data.length === 0)) {
      fetchData();
    }

    return () => { isMounted = false; };
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, filterScope]);

  // Resolve data: bound data > static schema data > fetched data
  const rawData = boundData || schema.data || fetchedData;
  const finalData = Array.isArray(rawData) ? rawData : EMPTY_ROWS;

  // Loading skeleton
  if (loading && finalData.length === 0) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="pivot-loading">
        {schema.title && (
          <h3 className="text-sm font-semibold mb-2">{schema.title}</h3>
        )}
        <div className="space-y-2 p-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('overflow-auto', className)} data-testid="pivot-error">
        {schema.title && (
          <h3 className="text-sm font-semibold mb-2">{schema.title}</h3>
        )}
        <div className="flex flex-col items-center justify-center py-8 text-destructive" data-testid="pivot-error-message">
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
        {schema.title && (
          <h3 className="text-sm font-semibold mb-2">{schema.title}</h3>
        )}
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <p className="text-xs">No data source available for &ldquo;{schema.objectName}&rdquo;</p>
        </div>
      </div>
    );
  }

  // Delegate to PivotTable with resolved data
  const finalSchema: PivotTableSchema = {
    ...schema,
    data: finalData,
  };

  const rowLabels = schema.rowField ? fieldLabelMaps[schema.rowField] : undefined;
  const colLabels = schema.columnField ? fieldLabelMaps[schema.columnField] : undefined;
  const rowFieldLabel = schema.rowField ? fieldNameLabels[schema.rowField] : undefined;

  // --- Drill-down wiring ---------------------------------------------------
  const drillDown = (schema as any).drillDown;

  const handleDrillDown = isDrillEnabled(drillDown)
    ? (event: DrillEvent) => setDrillEvent(event)
    : undefined;

  const renderDrillDrawer = () => {
    if (!drillEvent || !schema.objectName) return null;
    const baseFilter = computeDrillFilter(drillDown, drillEvent, {
      rowField: schema.rowField,
      columnField: schema.columnField,
    });
    const merged = { ...(schema.filter || {}), ...baseFilter };
    const title = resolveDrillTitle(drillDown, drillEvent, schema.title || 'Details');
    return (
      <DrillDownDrawer
        open
        onClose={() => setDrillEvent(null)}
        title={title}
        target={drillDown?.target ?? 'drawer'}
        objectName={schema.objectName}
        filter={merged}
        dataSource={dataSource}
        columns={drillDown?.columns}
        maxRows={drillDown?.maxRows}
        report={(drillDown as any)?.report}
      />
    );
  };

  return (
    <>
      <PivotTable
        schema={finalSchema}
        className={className}
        rowLabels={rowLabels}
        columnLabels={colLabels}
        rowFieldLabel={rowFieldLabel}
        onDrillDown={handleDrillDown}
      />
      {renderDrillDrawer()}
    </>
  );
};
