
import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { useDataScope, SchemaRendererContext, SchemaRenderer, useDrillNavigation, useFilterScope } from '@object-ui/react';
import { ChartRenderer } from './ChartRenderer';
import { ComponentRegistry, extractRecords, computeDrillFilter, isDrillEnabled, resolveDrillTitle, resolveFilterPlaceholders, resolveContextTokens, shiftFilterByCompareTo, compareToTrendLabelKey, buildChartSeries, buildOptionColorMap, buildDimensionLabelMap, relabelDimensions, type CompareToConfig, type DrillEvent, type ChartResultField } from '@object-ui/core';
import { Sheet, SheetContent, SheetHeader, SheetTitle, Dialog, DialogContent, DialogHeader, DialogTitle, RefreshIndicator, Button, ChartSkeleton } from '@object-ui/components';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import { useSafeFieldLabel, useSafeTranslate } from '@object-ui/i18n';
import type { DrillDownConfig } from '@object-ui/types';

/**
 * Humanize a snake_case or kebab-case string into Title Case.
 * Local implementation to avoid a dependency on @object-ui/fields.
 */
export function humanizeLabel(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * The result column an object-bound `aggregate` projects its value under
 * (framework#3701, `chartAggregateValueKey` in `@objectstack/spec/ui`).
 *
 * The raw `field` name — an object-bound aggregate does NOT decorate it the way
 * a dataset measure is named (`sum_amount`). Only `count` may omit `field`, and
 * it then lands under the literal `'count'`, which is the alias the engine
 * projects `COUNT(*)` under. Exported so every path that builds these rows
 * agrees on one key instead of each re-deriving it.
 */
export function aggregateValueKey(aggregate: { field?: string; function?: string }): string {
  return aggregate.field || aggregate.function || 'count';
}

/** Suffix the previous-window value carries under a compareTo overlay. */
export const COMPARISON_SUFFIX = '__comparison';

/**
 * Client-side aggregation for fetched records.
 * Groups records by `groupBy` field and applies the aggregation function
 * to the `field` values in each group.
 */
export function aggregateRecords(
  records: any[],
  aggregate: { field?: string; function: string; groupBy: string }
): any[] {
  const { field, function: aggFn, groupBy } = aggregate;
  const valueKey = aggregateValueKey(aggregate);
  const groups: Record<string, any[]> = {};

  for (const record of records) {
    const key = String(record[groupBy] ?? 'Unknown');
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }

  return Object.entries(groups).map(([key, group]) => {
    const values = field ? group.map(r => Number(r[field]) || 0) : [];
    let result: number;

    switch (aggFn) {
      case 'count':
        result = group.length;
        break;
      case 'avg':
        result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
      case 'min':
        result = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        result = values.length > 0 ? Math.max(...values) : 0;
        break;
      case 'sum':
      default:
        result = values.reduce((a, b) => a + b, 0);
        break;
    }

    return { [groupBy]: key, [valueKey]: result };
  });
}

/**
 * Resolve groupBy field values to human-readable labels using field metadata.
 *
 * - **select/picklist** fields: maps value→label via `field.options`.
 * - **lookup/master_detail** fields: batch-fetches referenced records
 *   via `dataSource.find()` and maps id→name.
 * - **fallback**: applies `humanizeLabel()` to convert snake_case/kebab-case
 *   values into Title Case.
 *
 * The resolved data is a new array with the groupBy key replaced by its label.
 * This function is pure data-layer logic — the rendering layer does not need
 * to perform any value→label conversion.
 */
export async function resolveGroupByLabels(
  data: any[],
  groupByField: string,
  objectSchema: any,
  dataSource?: any,
  translateOption?: (value: string, fallbackLabel: string) => string,
): Promise<any[]> {
  if (!data.length || !groupByField) return data;

  const t = translateOption || ((_v: string, fallback: string) => fallback);
  // Stash the original raw value under a side-channel key so click handlers
  // can recover it for filter computation. Display-side rendering keeps using
  // `groupByField` as before.
  const rawKey = `__raw_${groupByField}`;

  const fieldDef = objectSchema?.fields?.[groupByField];
  if (!fieldDef) {
    // No metadata available — apply humanizeLabel as fallback, but pass
    // ISO-date-like values through untouched so date chart axes can format them.
    const isoLike = /^\d{4}-\d{2}-\d{2}/;
    return data.map(row => {
      const raw = row[groupByField];
      const rawStr = String(raw ?? '');
      const humanized = isoLike.test(rawStr) ? rawStr : humanizeLabel(rawStr);
      return {
        ...row,
        [groupByField]: t(rawStr, humanized),
        [rawKey]: raw,
      };
    });
  }

  const fieldType = fieldDef.type;

  // --- select / picklist / dropdown fields ---
  if (fieldType === 'select' || fieldType === 'picklist' || fieldType === 'dropdown') {
    const options: Array<{ value: string; label: string } | string> = fieldDef.options || [];
    if (options.length === 0) {
      return data.map(row => {
        const raw = row[groupByField];
        const rawStr = String(raw ?? '');
        const humanized = humanizeLabel(rawStr);
        return {
          ...row,
          [groupByField]: t(rawStr, humanized),
          [rawKey]: raw,
        };
      });
    }

    // Build value→label map (options can be {value,label} objects or plain strings)
    const labelMap: Record<string, string> = {};
    for (const opt of options) {
      if (typeof opt === 'string') {
        labelMap[opt] = opt;
      } else if (opt && typeof opt === 'object') {
        labelMap[String(opt.value)] = opt.label || String(opt.value);
      }
    }

    return data.map(row => {
      const raw = row[groupByField];
      const rawValue = String(raw ?? '');
      const fallback = labelMap[rawValue] || humanizeLabel(rawValue);
      return {
        ...row,
        [groupByField]: t(rawValue, fallback),
        [rawKey]: raw,
      };
    });
  }

  // --- lookup / master_detail fields ---
  if (fieldType === 'lookup' || fieldType === 'master_detail') {
    // --- lookup / master_detail fields ---
    const referenceTo = fieldDef.reference_to || fieldDef.reference;
    if (!referenceTo || !dataSource || typeof dataSource.find !== 'function') {
      // Cannot resolve — return as-is but still attach the rawKey so the
      // click handler can recover the FK id.
      return data.map(row => ({ ...row, [rawKey]: row[groupByField] }));
    }

    // Collect unique IDs to fetch
    const ids = [...new Set(data.map(row => row[groupByField]).filter(v => v != null))];
    if (ids.length === 0) return data.map(row => ({ ...row, [rawKey]: row[groupByField] }));

    // Derive the ID field from metadata (fallback to 'id')
    const idField: string = fieldDef.id_field || 'id';

    try {
      const results = await dataSource.find(referenceTo, {
        $filter: { [idField]: { $in: ids } },
        $top: ids.length,
      });
      const records = extractRecords(results);

      // Build id→label map using display field from metadata with sensible fallbacks
      const displayField: string =
        fieldDef.reference_field || fieldDef.display_field || 'name';
      const idToName: Record<string, string> = {};
      for (const rec of records) {
        const id = String(rec[idField] ?? rec.id ?? rec._id ?? '');
        const name = rec[displayField] || rec.name || rec.label || rec.title || id;
        if (id) idToName[id] = String(name);
      }

      return data.map(row => {
        const raw = row[groupByField];
        const rawValue = String(raw ?? '');
        return {
          ...row,
          [groupByField]: idToName[rawValue] || rawValue,
          [rawKey]: raw,
        };
      });
    } catch (e) {
      console.warn('[ObjectChart] Failed to resolve lookup labels:', e);
      return data.map(row => ({ ...row, [rawKey]: row[groupByField] }));
    }
  }

  // --- date / datetime / timestamp fields ---
  // Preserve the raw ISO string so the chart layer can format it (e.g. "May 23").
  // humanizeLabel would replace hyphens with spaces and break date parsing.
  if (
    fieldType === 'date' ||
    fieldType === 'datetime' ||
    fieldType === 'date_time' ||
    fieldType === 'timestamp' ||
    fieldType === 'time'
  ) {
    return data.map(row => ({ ...row, [rawKey]: row[groupByField] }));
  }

  // --- fallback for other field types ---
  // Detect ISO 8601-like date strings and pass them through untouched so the
  // chart's tickFormatter can present them nicely. Otherwise humanize.
  const isoLike = /^\d{4}-\d{2}-\d{2}/;
  return data.map(row => {
    const raw = row[groupByField];
    const rawValue = String(raw ?? '');
    return {
      ...row,
      [groupByField]: isoLike.test(rawValue) ? rawValue : humanizeLabel(rawValue),
      [rawKey]: raw,
    };
  });
}

// Re-export extractRecords from @object-ui/core for backward compatibility
export { extractRecords } from '@object-ui/core';

export const ObjectChart = (props: any) => {
  const { schema } = props;
  // Optional host-owned segment click. When provided (e.g. a dataset widget
  // that owns precise drill-through), it takes over the chart click and the
  // widget's own object-drill drawer is suppressed.
  const onSegmentClick: ((ev: { category?: string; series?: string; value?: number }) => void) | undefined = props.onSegmentClick;
  const context = useContext(SchemaRendererContext);
  const dataSource = props.dataSource || context?.dataSource;
  const boundData = useDataScope(schema.bind);
  const { fieldOptionLabel } = useSafeFieldLabel();
  // Keep a stable ref to fieldOptionLabel — the i18n hook returns a fresh
  // function reference on every render, which would otherwise invalidate
  // fetchData's useCallback identity and trigger an infinite refetch loop.
  const fieldOptionLabelRef = useRef(fieldOptionLabel);
  useEffect(() => {
    fieldOptionLabelRef.current = fieldOptionLabel;
  }, [fieldOptionLabel]);
  
  const [fetchedData, setFetchedData] = useState<any[]>([]);
  // Measure/dimension label metadata from a dataset-bound queryDataset()
  // response (e.g. { name: 'task_count', label: 'Tasks' }) — captured so
  // buildChartSeries() below can resolve a human series label instead of
  // falling back to the raw field name.
  const [datasetFields, setDatasetFields] = useState<ChartResultField[] | null>(null);
  // Start in loading state when we will fetch, so the no-data / empty branch
  // doesn't flash before the fetch effect runs and flips loading to true.
  const [loading, setLoading] = useState<boolean>(() => {
    const hasInline = Array.isArray(schema.data) && schema.data.length > 0;
    return !hasInline && (!!schema.objectName || !!schema.dataset);
  });
  const [error, setError] = useState<string | null>(null);
  // Drill-down click event — must be declared with the other hooks (above
  // any conditional early return) to keep hook order stable between renders.
  const [drillEvent, setDrillEvent] = useState<DrillEvent | null>(null);
  // P3: semantic per-category colors. The category dimension is usually a
  // select field whose options carry colors (e.g. project health
  // green=#10B981 / red=#EF4444). Charts otherwise paint categories from the
  // generic --chart-1..5 palette, so a "Red" health slice renders teal. Resolve
  // the dimension field's option colors → {value|label → color} so the render
  // layer can use them. Keyed by BOTH value and label since the row category
  // may be either (server resolves dataset dimension labels).
  const [fieldOptionColors, setFieldOptionColors] = useState<Record<string, string> | null>(null);
  // Dataset path: {value → label} per dimension, so a value-keyed group (e.g.
  // status=`active`) shows its option label (`合作中`) on the axis/legend with
  // its count intact when the server returned raw values (cloud#667). The legacy
  // objectName path already resolves labels via resolveGroupByLabels below.
  const [dimensionLabels, setDimensionLabels] = useState<Record<string, Record<string, string>> | null>(null);
  // Host-provided "open in list" navigation for the drill escape hatch.
  const { openRecordList } = useDrillNavigation();
  const tt = useSafeTranslate();

  // Stable JSON keys for aggregate/filter so that callers passing a fresh
  // object literal on each render (e.g. DashboardRenderer.getComponentSchema)
  // do not trigger infinite refetch loops.
  const aggregateKey = useMemo(
    () => (schema.aggregate ? JSON.stringify(schema.aggregate) : ''),
    [schema.aggregate],
  );
  const filterKey = useMemo(
    () => (schema.filter ? JSON.stringify(schema.filter) : ''),
    [schema.filter],
  );
  const compareToKey = useMemo(
    () => ((schema as any).compareTo ? JSON.stringify((schema as any).compareTo) : ''),
    [(schema as any).compareTo],
  );
  // ADR-0021 (#1890): a chart can bind to a semantic-layer `dataset` instead of
  // the legacy inline `objectName` + `aggregate` query. Stable key over the
  // dataset selection so a fresh object literal each render doesn't refetch-loop.
  const datasetKey = useMemo(
    () => (schema.dataset
      ? JSON.stringify({ d: schema.dataset, dim: schema.dimensions ?? [], val: schema.values ?? [] })
      : ''),
    [schema.dataset, schema.dimensions, schema.values],
  );

  // Pie / donut / funnel are single-distribution charts where a comparison
  // overlay would be meaningless — we skip the comparison fetch entirely.
  const supportsCompareTo = (ct?: string) => ct !== 'pie' && ct !== 'donut' && ct !== 'funnel';

  // Resolve the category dimension's option colors (P3). Best-effort: any
  // failure leaves categoryColors null and the chart keeps the theme palette.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const reqOpts = { headers: { accept: 'application/json' }, credentials: 'include' as const };
        let objectName: string | undefined = schema.objectName;
        let fieldName: string | undefined;
        let datasetDef: any = null;
        const gb = schema.aggregate?.groupBy as any;
        if (objectName) {
          fieldName = (gb && typeof gb === 'object' && !Array.isArray(gb)) ? gb.field
            : (typeof gb === 'string' ? gb : schema.xAxisKey);
        } else if (schema.dataset) {
          // dataset path: dataset.object + first dimension's underlying field
          const dim0 = Array.isArray(schema.dimensions) && schema.dimensions.length ? schema.dimensions[0] : undefined;
          const defRes = await fetch(`/api/v1/meta/dataset/${encodeURIComponent(schema.dataset)}`, reqOpts);
          const defJson = await defRes.json().catch(() => null);
          datasetDef = defJson?.item ?? defJson?.data ?? defJson;
          objectName = datasetDef?.object;
          const dim = (datasetDef?.dimensions || []).find((d: any) => d?.name === dim0) ?? (datasetDef?.dimensions || [])[0];
          fieldName = dim?.field ?? dim0;
        }
        if (!objectName || !fieldName) { if (!cancelled) { setFieldOptionColors(null); setDimensionLabels(null); } return; }
        const schemaRes = await fetch(`/api/v1/meta/object/${encodeURIComponent(objectName)}`, reqOpts);
        const sj = await schemaRes.json().catch(() => null);
        const objSchema = sj?.item ?? sj?.data ?? sj;
        const map = buildOptionColorMap(objSchema?.fields?.[fieldName]?.options);
        // dataset path: build a {value → label} map for EVERY select dimension
        // (the objectName path resolves labels via resolveGroupByLabels instead).
        let labels: Record<string, Record<string, string>> | null = null;
        if (schema.dataset && Array.isArray(schema.dimensions)) {
          const acc: Record<string, Record<string, string>> = {};
          for (const dimName of schema.dimensions) {
            const dimDef = (datasetDef?.dimensions || []).find((d: any) => d?.name === dimName);
            const f = dimDef?.field ?? dimName;
            const m = buildDimensionLabelMap(objSchema?.fields?.[f]?.options);
            if (m) acc[dimName] = m;
          }
          if (Object.keys(acc).length > 0) labels = acc;
        }
        if (!cancelled) { setFieldOptionColors(map); setDimensionLabels(labels); }
      } catch { if (!cancelled) { setFieldOptionColors(null); setDimensionLabels(null); } }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, schema.dataset, datasetKey, aggregateKey, schema.xAxisKey]);

  // Run a single aggregate query (used for both the current and comparison
  // windows). Extracted so the two queries share identical logic.
  const runAggregate = useCallback(async (ds: any, filterForRun: any): Promise<any[]> => {
    if (schema.aggregate && typeof ds.aggregate === 'function') {
      const gb = schema.aggregate.groupBy as any;
      // Structured GroupBy node (e.g. `{ field, dateGranularity: 'day' }`)
      // requires the spec-shape `{ groupBy: GroupByNode[], aggregations,
      // where }` payload so the server-side date-bucket engine kicks in.
      // The legacy `{ field, function, groupBy, filter }` cube/analytics
      // path does NOT honour `dateGranularity`.
      const isStructured = gb && typeof gb === 'object' && !Array.isArray(gb);
      if (isStructured) {
        const aggField = schema.aggregate.field;
        const aggFn = schema.aggregate.function;
        // Project the measure under its plain field name so downstream
        // (xAxisKey + series.dataKey lookups) finds it unchanged — the
        // object-bound result-column convention (framework#3701).
        const alias = aggregateValueKey(schema.aggregate);
        // For `count`, omit `field` so the engine emits `count(*)` /
        // `COUNT(*)`. The upstream dashboard wiring defaults `field: 'value'`
        // for charts without an explicit valueField, which crashes on SQL
        // drivers ("no such column: value") since dashboards typically
        // count rows, not a measure column.
        const aggregationNode: Record<string, unknown> = { function: aggFn, alias };
        if (aggFn !== 'count' && aggField) aggregationNode.field = aggField;
        const results = await ds.aggregate(schema.objectName, {
          groupBy: [gb],
          aggregations: [aggregationNode],
          where: filterForRun,
        });
        return Array.isArray(results) ? results : [];
      }
      const results = await ds.aggregate(schema.objectName, {
        field: schema.aggregate.field,
        function: schema.aggregate.function,
        groupBy: gb,
        filter: filterForRun,
      });
      return Array.isArray(results) ? results : [];
    }
    if (typeof ds.find === 'function') {
      const results = await ds.find(schema.objectName, { $filter: filterForRun });
      let data = extractRecords(results);
      if (schema.aggregate && data.length > 0) {
        data = aggregateRecords(data, schema.aggregate);
      }
      return data;
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, aggregateKey]);

  // Session scope for `{current_user_id}` / `{current_org_id}` in the schema
  // filter. Read at component level — `fetchData` is async and a callback.
  const filterScope = useFilterScope();

  const fetchData = useCallback(async (ds: any, mounted: { current: boolean }) => {
      if (!ds || (!schema.objectName && !schema.dataset)) {
        // No way to fetch — clear loading so the no-datasource / empty state
        // can render instead of an indefinite "Loading chart data…".
        if (mounted.current) setLoading(false);
        return;
      }
      if (mounted.current) {
        setLoading(true);
        setError(null);
      }
      try {
          // ── Dataset-bound path (ADR-0021, #1890) ──────────────
          // When the chart binds to a semantic-layer `dataset`, run the same
          // governed `queryDataset` path the dashboard DatasetWidget and
          // dataset-bound reports use, so the numbers match everywhere. The
          // server resolves dimension labels + measure formats, so the legacy
          // client-side aggregate / groupBy-label resolution below is skipped.
          if (schema.dataset && typeof ds.queryDataset === 'function') {
              const runtimeFilter = resolveFilterPlaceholders(schema.filter, filterScope);
              const res = await ds.queryDataset(schema.dataset, {
                  dimensions: Array.isArray(schema.dimensions) ? schema.dimensions : [],
                  measures: Array.isArray(schema.values) ? schema.values : [],
                  ...(runtimeFilter ? { runtimeFilter } : {}),
              });
              if (mounted.current) {
                  setFetchedData(Array.isArray(res?.rows) ? res.rows : []);
                  setDatasetFields(Array.isArray(res?.fields) ? res.fields : null);
              }
              return;
          }

          // Resolve every filter placeholder — relative-date macros (e.g.
          // "{current_quarter_start}") AND session tokens ("{current_user_id}")
          // — so both aggregate and find see real values and any drill-down
          // filter further down the line stays consistent.
          const resolvedFilter = resolveFilterPlaceholders(schema.filter, filterScope);
          // `{ kind, dimension? }` since objectstack#5011. Nothing here reads the
          // value apart from its presence: the ONE discriminator (`.kind`) is
          // read where the shift is computed — `shiftFilterByCompareTo` — so
          // this file has no second copy of the branch table to drift from it.
          const compareTo: CompareToConfig | undefined = (schema as any).compareTo;
          const wantsComparison = !!compareTo && supportsCompareTo(schema.chartType);
          // shiftFilterByCompareTo expects the raw filter (with date macros)
          // so it can substitute `{current_*}` tokens or re-resolve macros
          // against a shifted `now`. It only understands the date vocabulary,
          // so the session tokens still need their pass over the result —
          // otherwise the comparison series silently ignores the owner clause
          // that the primary series honours.
          const comparisonFilter = wantsComparison
            ? resolveContextTokens(shiftFilterByCompareTo(schema.filter, compareTo!), filterScope)
            : null;

          const [currentRowsRaw, comparisonRows] = await Promise.all([
            runAggregate(ds, resolvedFilter),
            comparisonFilter ? runAggregate(ds, comparisonFilter) : Promise.resolve([]),
          ]);

          // Merge comparison data BEFORE label resolution so we can match by
          // the raw groupBy value (server-side enums like 'closed_won'),
          // not by the humanized label ('Closed Won') which only exists
          // post-resolution. Otherwise comparison-only buckets appear as
          // duplicated raw rows alongside the humanized current rows.
          let data = currentRowsRaw;
          // groupBy may be a bare string or a structured `{field, dateGranularity}`
          // node (when categoryGranularity is configured upstream). Normalise
          // to the underlying string field name so all column lookups work.
          const gbRaw = schema.aggregate?.groupBy as any;
          const groupByField: string | undefined = (gbRaw && typeof gbRaw === 'object' && !Array.isArray(gbRaw))
            ? gbRaw.alias || gbRaw.field
            : (gbRaw || schema.xAxisKey);
          if (wantsComparison && comparisonRows.length > 0 && schema.aggregate) {
            const aggField = schema.aggregate.field;
            const aggFn = schema.aggregate.function;
            // The column this aggregate projects its value under — `field`,
            // or `count` for a fieldless count (framework#3701).
            const valueKey = aggregateValueKey(schema.aggregate);
            const readValue = (row: Record<string, any>): number | null => {
              if (row == null) return null;
              if (aggField) {
                const suffixed = `${aggField}_${aggFn}`;
                if (suffixed in row) return Number(row[suffixed]);
                if (aggFn === 'count' && `${aggField}_count` in row) return Number(row[`${aggField}_count`]);
              }
              if (valueKey in row) return Number(row[valueKey]);
              if ('value' in row) return Number(row.value);
              if ('count' in row) return Number(row.count);
              return null;
            };
            const comparisonKey = `${valueKey}${COMPARISON_SUFFIX}`;
            const gb = groupByField;
            if (gb && data.some((r: any) => r[gb] != null) && comparisonRows.some((r: any) => r[gb] != null)) {
              const cmpByKey = new Map<string, number | null>();
              for (const row of comparisonRows) {
                const k = String(row[gb] ?? '');
                cmpByKey.set(k, readValue(row));
              }
              data = data.map((row: any) => {
                const k = String(row[gb] ?? '');
                const v = cmpByKey.get(k);
                return v == null ? row : { ...row, [comparisonKey]: v };
              });
              const seen = new Set(data.map((r: any) => String(r[gb] ?? '')));
              for (const row of comparisonRows) {
                const k = String(row[gb] ?? '');
                if (!seen.has(k)) {
                  data.push({ [gb]: k, [comparisonKey]: readValue(row) });
                }
              }
            } else {
              const padded = Math.max(data.length, comparisonRows.length);
              const merged = [] as any[];
              for (let i = 0; i < padded; i++) {
                const cur = data[i] || {};
                const cmp = comparisonRows[i];
                merged.push(cmp ? { ...cur, [comparisonKey]: readValue(cmp) } : cur);
              }
              data = merged;
            }
          }

          // Resolve groupBy value→label using field metadata. Now that the
          // merge has happened on raw keys, the resolver can convert the
          // shared groupBy column (e.g. 'closed_won' → 'Closed Won') uniformly.
          if (groupByField && typeof ds.getObjectSchema === 'function') {
              try {
                  const objectSchema = await ds.getObjectSchema(schema.objectName);
                  data = await resolveGroupByLabels(
                    data,
                    groupByField,
                    objectSchema,
                    ds,
                    (value, fallback) => fieldOptionLabelRef.current(schema.objectName, groupByField, value, fallback),
                  );
              } catch {
                  // Schema fetch failed — continue with raw values
              }
          }

          if (mounted.current) {
              setFetchedData(data);
          }
      } catch (e) {
          console.error('[ObjectChart] Fetch error:', e);
          if (mounted.current) {
              setError(e instanceof Error ? e.message : 'Failed to load chart data');
          }
      } finally {
          if (mounted.current) setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, datasetKey, aggregateKey, filterKey, compareToKey, schema.xAxisKey, schema.chartType, runAggregate, filterScope]);

  useEffect(() => {
    const mounted = { current: true };

    if ((schema.objectName || schema.dataset) && !boundData && !schema.data) {
        fetchData(dataSource, mounted);
    } else if (mounted.current) {
        // Have inline / bound data — won't fetch; clear loading.
        setLoading(false);
    }
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, datasetKey, dataSource, boundData, schema.data, filterKey, aggregateKey, compareToKey, fetchData]);

  const rawData = boundData || schema.data || fetchedData;
  const finalData = Array.isArray(rawData) ? rawData : [];

  // --- Drill-down --------------------------------------------------------
  // Charts can opt into drill-down via `schema.drillDown`. Clicking a bar
  // segment / pie slice opens a Sheet rendering the underlying records,
  // filtered by the click context (category → groupBy field). The drilled
  // table is rendered via SchemaRenderer + the registered "object-data-table"
  // component (provided by plugin-dashboard).
  //
  // This read used to be `(schema as any).drillDown`, and framework#5022 is the
  // issue that untyped read produced: the block drove a real capability that
  // the PROTOCOL declared nowhere, so the spec's own migration prose ended up
  // prescribing a key no schema had. The protocol now declares it —
  // `ChartDrillDownSchema` in `@objectstack/spec/ui`, published on this block's
  // react contract — and the registry `inputs` below carry it, so the SDUI save
  // gate treats it as a contract prop instead of an unknown one.
  //
  // TODO(framework#5022): narrow this to the spec type once the pin advances.
  // `@objectstack/spec` is pinned at `^17.0.0-rc.2` here and the declaration
  // lands in the NEXT rc, so importing `ChartDrillDown` today would not compile
  // against the published package. Re-declaring the shape locally instead is
  // exactly the fork that would let the two drift, so the read stays on
  // `DrillDownConfig` — the renderer-side type five widgets already share —
  // until the bump. Note the two are not the same set on purpose: the spec type
  // is the CHART subset (`enabled`/`filter`/`title`/`target`/`columns`/
  // `maxRows`), while this one also carries the table/pivot/metric keys
  // (`mode`, `report`) that this component does not read.
  //
  // objectui#3354 shrank the gap from the other side: the whole `target` union
  // — including `'navigate'` — is honoured below, and the two keys no renderer
  // read at all (`view`, `sort`) are gone from `DrillDownConfig`.
  //
  // That leaves ONE asymmetry, deliberately not papered over here. The spec's
  // `ChartDrillDownSchema` declares `target: 'drawer' | 'dialog'`, and its
  // stated rationale was a measurement — every key has an `ObjectChart` read
  // site, and at the time this component ignored `'navigate'`. That measurement
  // changed with this issue, so the protocol's union is now narrower than what
  // the renderer delivers. The fix belongs in the spec (extend the union), not
  // here (objectstack#5435): widening the union renderer-side is free, but
  // ADVERTISING it before
  // the protocol does would collide with the publish gate that parses the
  // strict schema. Until the spec moves, `'navigate'` works for any host that
  // composes an `object-chart` schema directly, and stays absent from the
  // registry `inputs` below.
  const drillDown = (schema as { drillDown?: DrillDownConfig }).drillDown;
  const groupByField = schema.aggregate?.groupBy || schema.xAxisKey;

  // Build a label→raw map from the resolved chart data. resolveGroupByLabels
  // stashes the original raw enum/id under `__raw_${groupByField}`. The chart
  // event payload exposes the displayed label as `category`; we reverse-resolve
  // it so the drill filter compares against the value the backend actually
  // stores instead of the human-readable label (which would never match).
  // NOTE: declared above any conditional early returns to keep hook order stable.
  const labelToRaw = useMemo(() => {
    if (!groupByField) return new Map<string, unknown>();
    const map = new Map<string, unknown>();
    const rawKey = `__raw_${groupByField}`;
    for (const row of finalData) {
      const label = row?.[groupByField];
      if (label == null) continue;
      const raw = rawKey in (row || {}) ? row[rawKey] : label;
      map.set(String(label), raw);
    }
    return map;
  }, [finalData, groupByField]);

  // The filter the drilled list is scoped by: the widget's own filter narrowed
  // by the click context. Hoisted out of the drawer block below (which runs
  // after this component's conditional early returns) because the `'navigate'`
  // target needs it from an effect, and effects may not live after an early
  // return. The drawer reads the same value, so both targets drill by exactly
  // one filter.
  const drillFilter = useMemo(() => {
    if (!drillEvent) return undefined;
    return {
      ...(schema.filter || {}),
      ...computeDrillFilter(drillDown, drillEvent, { groupByField }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillEvent, drillDown, groupByField, filterKey]);

  // `target: 'navigate'` — skip the in-place peek and send the user straight to
  // the object's full list page, scoped by the same filter (objectui#3354).
  //
  // This mirrors `DrillDownDrawer`'s `navigateOnly` (plugin-dashboard), which
  // the table / pivot / metric widgets already honour. ObjectChart draws its own
  // drawer instead of using that component, and had only a `'dialog'` branch and
  // a default Sheet — so `'navigate'` silently rendered a Sheet, contradicting
  // the shared `DrillDownConfig.target` JSDoc for the one widget that did not
  // route through the drawer.
  //
  // Documented fallback, same as the drawer's: when the host wired no
  // `DrillNavigationContext.openRecordList` there is nowhere to navigate, so the
  // drill degrades to the in-place drawer exactly as the JSDoc promises. The
  // header's "Open in list" escape hatch stays independent of `target`.
  const navigateOnly =
    !onSegmentClick &&
    !!drillEvent &&
    !!schema.objectName &&
    drillDown?.target === 'navigate' &&
    !!openRecordList;
  useEffect(() => {
    if (!navigateOnly) return;
    openRecordList!(schema.objectName as string, drillFilter);
    setDrillEvent(null);
    // Fires on the transition into `navigateOnly` only — the drawer does the
    // same. Widening the deps would re-navigate on every unrelated re-render
    // that happens before `setDrillEvent(null)` lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigateOnly]);

  // Merge data if not provided in schema. When `compareTo` is configured
  // for a supported chart type, also synthesize a second series so the
  // chart implementation renders the comparison overlay (dashed / muted).
  const compareToConfig: CompareToConfig | undefined = (schema as any).compareTo;
  // The result column this aggregate projects its value under, and the column
  // the comparison overlay arrives in (framework#3701).
  const valueKey = schema.aggregate ? aggregateValueKey(schema.aggregate) : undefined;
  const comparisonKey = valueKey ? `${valueKey}${COMPARISON_SUFFIX}` : undefined;
  const enableComparisonSeries =
    !!compareToConfig &&
    supportsCompareTo(schema.chartType) &&
    !!comparisonKey &&
    finalData.some((row: Record<string, any>) => row[comparisonKey] != null);

  const augmentedSeries = useMemo(() => {
    const existing = Array.isArray((schema as any).series) ? (schema as any).series : null;
    if (!enableComparisonSeries) return existing;
    const primary = existing || [{ dataKey: valueKey }];
    const labelMap: Record<string, string> = {
      vsLastWeek: 'Previous week',
      vsLastMonth: 'Previous month',
      vsLastQuarter: 'Previous quarter',
      vsLastYear: 'Previous year',
      vsYesterday: 'Yesterday',
      vsPreviousPeriod: 'Previous period',
    };
    const labelKey = compareToTrendLabelKey(compareToConfig!, schema.filter);
    const friendlyLabel = labelMap[labelKey] || 'Previous period';
    return [
      ...primary.map((s: any) => ({ ...s, variant: s.variant || 'current' })),
      {
        dataKey: comparisonKey,
        label: friendlyLabel,
        variant: 'comparison',
      },
    ];
  }, [enableComparisonSeries, (schema as any).series, valueKey, comparisonKey, schema.filter, compareToConfig]);

  // ADR-0021 (#1759): when the chart binds to a dataset, derive data/xAxisKey/
  // series from its dimensions/measures via the shared buildChartSeries helper —
  // this pivots a second dimension into grouped series, matching DatasetWidget.
  const datasetChart = schema.dataset
    ? buildChartSeries(relabelDimensions(finalData, dimensionLabels), schema.dimensions, schema.values, datasetFields)
    : null;

  const finalSchema = datasetChart
    ? { ...schema, data: datasetChart.data, xAxisKey: datasetChart.xAxisKey, series: datasetChart.series }
    : { ...schema, data: finalData, ...(augmentedSeries ? { series: augmentedSeries } : {}) };

  // P3: per-category semantic colors. When the category dimension is a select/
  // lookup field, its option colors (resolved above into `fieldOptionColors`)
  // paint each slice/bar — a "Red" health category renders red, not the next
  // positional palette slot. The render layer looks each category up in
  // `categoryColors` first and only falls back to the positional palette, so an
  // explicit brand `colors` palette no longer suppresses the semantic colors.
  //
  // `colors` is overloaded kanban-style: a string[] is the positional palette
  // (fallback only); a Record<value, color> is an explicit author map that wins
  // over the field's option colors. We split the two and pass the palette as
  // `colors` and the merged map as `categoryColors`.
  const explicitColorMap: Record<string, string> | null =
    (schema as any).colors && !Array.isArray((schema as any).colors) && typeof (schema as any).colors === 'object'
      ? ((schema as any).colors as Record<string, string>)
      : null;
  const paletteColors: string[] | undefined =
    Array.isArray((schema as any).colors) ? ((schema as any).colors as string[]) : undefined;
  const mergedCategoryColors = (fieldOptionColors || explicitColorMap)
    ? { ...(fieldOptionColors || {}), ...(explicitColorMap || {}) }
    : undefined;
  const finalSchemaWithColors = {
    ...finalSchema,
    colors: paletteColors,
    ...(mergedCategoryColors ? { categoryColors: mergedCategoryColors } : {}),
  };

  // Pending with nothing to draw yet → a chart-shaped skeleton (placeholder
  // bars), not a 0-value axis or a thin text line. Reads as "loading", never as
  // an empty/broken chart on the first paint. Once any data is present the chart
  // renders and a RefreshIndicator covers subsequent refetches.
  if (loading && finalData.length === 0) {
      return (
        <div
          className={"p-2 " + (schema.className || '')}
          data-testid="chart-loading"
          role="status"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading chart data…</span>
          <ChartSkeleton className="h-full" />
        </div>
      );
  }

  // Error state — show the error prominently so issues are not hidden
  if (error) {
      return (
        <div className={"flex flex-col items-center justify-center gap-2 p-4 " + (schema.className || '')} data-testid="chart-error" role="alert">
          <AlertCircle className="h-6 w-6 text-destructive opacity-60" />
          <p className="text-xs text-destructive font-medium">Failed to load chart data</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">{error}</p>
        </div>
      );
  }

  if (!dataSource && schema.objectName && finalData.length === 0) {
      return <div className={"flex items-center justify-center text-muted-foreground text-sm p-4 " + (schema.className || '')} data-testid="chart-no-datasource">No data source available for &ldquo;{schema.objectName}&rdquo;</div>;
  }

  const internalChartClick = isDrillEnabled(drillDown)
    ? (ev: { category?: string; series?: string; value?: number }) => {
        const labelCategory = ev.category;
        const rawCategory = labelCategory != null && labelToRaw.has(String(labelCategory))
          ? labelToRaw.get(String(labelCategory))
          : labelCategory;
        setDrillEvent({
          ...ev,
          // Use the raw value for filter matching; expose label separately for the title.
          category: rawCategory as any,
          categoryLabel: labelCategory,
          scope: 'cell',
        });
      }
    : undefined;
  // Host-owned click (dataset drill-through) wins over the widget's own object-drill.
  const onChartClick = onSegmentClick ?? internalChartClick;

  // `navigateOnly` renders nothing: the effect above has already handed the
  // drill to the host's list page, so the in-place drawer must not flash.
  const drillDrawer = !onSegmentClick && drillEvent && schema.objectName && !navigateOnly ? (() => {
    const merged = drillFilter ?? {};
    const title = resolveDrillTitle(drillDown, drillEvent, schema.title || 'Details');
    const target = drillDown?.target ?? 'drawer';
    const tableSchema = {
      type: 'object-data-table',
      objectName: schema.objectName,
      filter: merged,
      pagination: true,
      pageSize: drillDown?.maxRows,
      columns: drillDown?.columns?.map((c: string) => ({ accessorKey: c, header: c })),
      // Complete the drill chain: a row in the filtered list opens that record.
      // Rendered as a dialog so it stacks cleanly over this drill drawer.
      drillDown: { enabled: true, mode: 'record' as const, target: 'dialog' as const },
    };
    const body = (
      <div className="overflow-auto" data-testid="chart-drill-body">
        <SchemaRenderer schema={tableSchema} dataSource={dataSource} />
      </div>
    );
    // Escape hatch — escalate this segment peek to the object's full list page,
    // scoped by the same filter. Shown only when the host wired navigation.
    const escapeHatch = openRecordList && schema.objectName ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="drill-open-in-list"
        onClick={() => { openRecordList(schema.objectName!, merged); setDrillEvent(null); }}
      >
        {tt('dashboard.openInList', 'Open in list')}
        <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    ) : null;
    if (target === 'dialog') {
      return (
        <Dialog open onOpenChange={(v) => !v && setDrillEvent(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader className="flex-row items-center justify-between gap-4 pr-8">
              <DialogTitle>{title}</DialogTitle>
              {escapeHatch}
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Sheet open onOpenChange={(v) => !v && setDrillEvent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl flex flex-col">
          <SheetHeader className="flex-row items-center justify-between gap-4 pr-8">
            <SheetTitle>{title}</SheetTitle>
            {escapeHatch}
          </SheetHeader>
          <div className="flex-1 overflow-hidden mt-2">{body}</div>
        </SheetContent>
      </Sheet>
    );
  })() : null;

  return (
    <div className="relative">
      <RefreshIndicator active={loading && finalData.length > 0} />
      <ChartRenderer {...props} schema={finalSchemaWithColors} onChartClick={onChartClick} />
      {drillDrawer}
    </div>
  );
};

// Register it
ComponentRegistry.register('object-chart', ObjectChart, {
    namespace: 'plugin-charts',
    label: 'Object Chart',
    category: 'view',
    inputs: [
        { name: 'objectName', type: 'string', label: 'Object Name', required: true },
        { name: 'data', type: 'array', label: 'Data', description: 'Optional static data' },
        { name: 'filter', type: 'array', label: 'Filter' },
        { name: 'aggregate', type: 'object', label: 'Aggregate', description: 'Aggregation config: { field, function, groupBy }' },
        // framework#5022. The manifest built from these `inputs` is what the
        // SDUI save gate validates a page's JSX against, so an undeclared prop
        // is reported as `unknown-prop` — which is what an author writing the
        // segment drill got, for a prop this component has always read. The
        // spec now declares the shape (`ChartDrillDownSchema`), and this entry
        // is the half that makes the gate agree.
        //
        // Only the six keys the spec declares are advertised here; the wider
        // renderer-side `DrillDownConfig` (`mode`, `report`) belongs to the
        // table/pivot/metric widgets, and advertising it would re-open the gap
        // framework#5022 closed — one layer down, in the designer palette.
        //
        // `target: 'navigate'` is DELIVERED by this component since
        // objectui#3354 but is deliberately NOT advertised here yet, and the
        // asymmetry is on purpose. `ChartDrillDownSchema` (`@objectstack/spec`)
        // landed the chart drill as `target: 'drawer' | 'dialog'` — strict, and
        // enforced at publish by `validate-react-page-props`, which PARSES it
        // against the authored `drillDown={{…}}` literal. Listing `'navigate'`
        // in this palette would therefore hand an author a value the publish
        // gate then rejects: the platform's authority for a key its own gate
        // refuses, which is precisely the failure framework#5022 was opened to
        // stop. The protocol's union is the thing that has to move first; until
        // it does, this description tracks the spec, not the renderer.
        //
        // `view` / `sort` are gone from `DrillDownConfig` entirely
        // (objectui#3354) — no renderer ever read them, so there is no longer a
        // key to advertise or withhold.
        { name: 'drillDown', type: 'object', label: 'Drill-down', description: "Segment drill config: { enabled?, filter?, title?, target?: 'drawer' | 'dialog', columns?, maxRows? }. Present = on; {} is enough. Clicking a segment opens the underlying records filtered by the clicked category." },
    ]
});
