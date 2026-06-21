
import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { useDataScope, SchemaRendererContext, SchemaRenderer } from '@object-ui/react';
import { ChartRenderer } from './ChartRenderer';
import { ComponentRegistry, extractRecords, computeDrillFilter, isDrillEnabled, resolveDrillTitle, resolveDateMacros, shiftFilterByCompareTo, compareToTrendLabelKey, buildChartSeries, type CompareToConfig, type DrillEvent } from '@object-ui/core';
import { Sheet, SheetContent, SheetHeader, SheetTitle, Dialog, DialogContent, DialogHeader, DialogTitle, RefreshIndicator } from '@object-ui/components';
import { AlertCircle } from 'lucide-react';
import { useSafeFieldLabel } from '@object-ui/i18n';

/**
 * Humanize a snake_case or kebab-case string into Title Case.
 * Local implementation to avoid a dependency on @object-ui/fields.
 */
export function humanizeLabel(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Client-side aggregation for fetched records.
 * Groups records by `groupBy` field and applies the aggregation function
 * to the `field` values in each group.
 */
export function aggregateRecords(
  records: any[],
  aggregate: { field: string; function: string; groupBy: string }
): any[] {
  const { field, function: aggFn, groupBy } = aggregate;
  const groups: Record<string, any[]> = {};

  for (const record of records) {
    const key = String(record[groupBy] ?? 'Unknown');
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }

  return Object.entries(groups).map(([key, group]) => {
    const values = group.map(r => Number(r[field]) || 0);
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

    return { [groupBy]: key, [field]: result };
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
        // (xAxisKey + series.dataKey lookups) finds it unchanged.
        const alias = aggField || aggFn;
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
              const runtimeFilter = resolveDateMacros(schema.filter);
              const res = await ds.queryDataset(schema.dataset, {
                  dimensions: Array.isArray(schema.dimensions) ? schema.dimensions : [],
                  measures: Array.isArray(schema.values) ? schema.values : [],
                  ...(runtimeFilter ? { runtimeFilter } : {}),
              });
              if (mounted.current) {
                  setFetchedData(Array.isArray(res?.rows) ? res.rows : []);
              }
              return;
          }

          // Resolve relative-date macros (e.g. "{current_quarter_start}")
          // so both aggregate and find see real ISO dates and any drill-down
          // filter further down the line stays consistent.
          const resolvedFilter = resolveDateMacros(schema.filter);
          const compareTo: CompareToConfig | undefined = (schema as any).compareTo;
          const wantsComparison = !!compareTo && supportsCompareTo(schema.chartType);
          // shiftFilterByCompareTo expects the raw filter (with date macros)
          // so it can substitute `{current_*}` tokens or re-resolve macros
          // against a shifted `now`.
          const comparisonFilter = wantsComparison
            ? shiftFilterByCompareTo(schema.filter, compareTo!)
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
            const readValue = (row: Record<string, any>): number | null => {
              if (row == null) return null;
              const suffixed = `${aggField}_${aggFn}`;
              if (suffixed in row) return Number(row[suffixed]);
              if (aggFn === 'count' && `${aggField}_count` in row) return Number(row[`${aggField}_count`]);
              if (aggField in row) return Number(row[aggField]);
              if ('value' in row) return Number(row.value);
              if ('count' in row) return Number(row.count);
              return null;
            };
            const comparisonKey = `${aggField}__comparison`;
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
  }, [schema.objectName, datasetKey, aggregateKey, filterKey, compareToKey, schema.xAxisKey, schema.chartType, runAggregate]);

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
  const drillDown = (schema as any).drillDown;
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

  // Merge data if not provided in schema. When `compareTo` is configured
  // for a supported chart type, also synthesize a second series so the
  // chart implementation renders the comparison overlay (dashed / muted).
  const compareToConfig: CompareToConfig | undefined = (schema as any).compareTo;
  const enableComparisonSeries =
    !!compareToConfig &&
    supportsCompareTo(schema.chartType) &&
    !!schema.aggregate &&
    finalData.some((row: Record<string, any>) => row[`${schema.aggregate!.field}__comparison`] != null);

  const augmentedSeries = useMemo(() => {
    const existing = Array.isArray((schema as any).series) ? (schema as any).series : null;
    if (!enableComparisonSeries) return existing;
    const primary = existing || [{ dataKey: schema.aggregate!.field }];
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
        dataKey: `${schema.aggregate!.field}__comparison`,
        label: friendlyLabel,
        variant: 'comparison',
      },
    ];
  }, [enableComparisonSeries, (schema as any).series, schema.aggregate, schema.filter, compareToConfig]);

  // ADR-0021 (#1759): when the chart binds to a dataset, derive data/xAxisKey/
  // series from its dimensions/measures via the shared buildChartSeries helper —
  // this pivots a second dimension into grouped series, matching DatasetWidget.
  const datasetChart = schema.dataset
    ? buildChartSeries(finalData, schema.dimensions, schema.values)
    : null;

  const finalSchema = datasetChart
    ? { ...schema, data: datasetChart.data, xAxisKey: datasetChart.xAxisKey, series: datasetChart.series }
    : { ...schema, data: finalData, ...(augmentedSeries ? { series: augmentedSeries } : {}) };
  
  if (loading && finalData.length === 0) {
      return <div className={"flex items-center justify-center text-muted-foreground text-sm p-4 " + (schema.className || '')} data-testid="chart-loading">Loading chart data…</div>;
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

  const onChartClick = isDrillEnabled(drillDown)
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

  const drillDrawer = drillEvent && schema.objectName ? (() => {
    const baseFilter = computeDrillFilter(drillDown, drillEvent, { groupByField });
    const merged = { ...(schema.filter || {}), ...baseFilter };
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
    if (target === 'dialog') {
      return (
        <Dialog open onOpenChange={(v) => !v && setDrillEvent(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Sheet open onOpenChange={(v) => !v && setDrillEvent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl flex flex-col">
          <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-hidden mt-2">{body}</div>
        </SheetContent>
      </Sheet>
    );
  })() : null;

  return (
    <div className="relative">
      <RefreshIndicator active={loading && finalData.length > 0} />
      <ChartRenderer {...props} schema={finalSchema} onChartClick={onChartClick} />
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
    ]
});
