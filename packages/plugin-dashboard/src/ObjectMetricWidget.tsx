/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { SchemaRendererContext, SchemaRenderer } from '@object-ui/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, Dialog, DialogContent, DialogHeader, DialogTitle } from '@object-ui/components';
import { isDrillEnabled, resolveDrillTitle } from '@object-ui/core';
import type { DrillDownConfig } from '@object-ui/types';
import { useLocalization, resolveFieldCurrency } from '@object-ui/i18n';
import { MetricWidget } from './MetricWidget';
import { OpenInListButton } from './OpenInListButton';
import {
  resolveDateMacros,
  shiftFilterByCompareTo,
  compareToTrendLabelKey,
  computeMetricDelta,
  type CompareToConfig,
} from './utils';

/**
 * ObjectMetricWidget — Data-bound metric widget.
 *
 * When a metric widget has an `object` binding and a `dataSource` is available,
 * this component attempts to fetch the metric value from the server using
 * aggregation. If the fetch fails, it shows an error state instead of
 * silently displaying stale/hardcoded data.
 *
 * Lifecycle states:
 * - **Loading** → spinner placeholder
 * - **Error** → error message (API failure is surfaced, not hidden)
 * - **Data** → actual metric value from server
 * - **Fallback** → when no dataSource is available, renders the static
 *   `options.value` as provided in the widget config (demo/fallback mode)
 */
export interface ObjectMetricWidgetProps {
  /** The object/resource name to query */
  objectName: string;
  /** Aggregation config (field, function, groupBy) */
  aggregate?: { field: string; function: string; groupBy?: string };
  /** Filter conditions */
  filter?: any;
  /** Static label for the metric */
  label: string | { key?: string; defaultValue?: string };
  /** Fallback static value (used when no dataSource or in demo mode) */
  fallbackValue?: string | number;
  /** Trend info */
  trend?: {
    value: number;
    label?: string | { key?: string; defaultValue?: string };
    direction?: 'up' | 'down' | 'neutral';
  };
  /** Icon name or ReactNode */
  icon?: React.ReactNode | string;
  /** Additional CSS class */
  className?: string;
  /** Description */
  description?: string | { key?: string; defaultValue?: string };
  /** External data source (overrides context) */
  dataSource?: any;
  /** Visual color variant for the icon container */
  colorVariant?: 'default' | 'blue' | 'teal' | 'orange' | 'purple' | 'success' | 'warning' | 'danger';
  /** Number format pattern (e.g. `'0,0'`, `'0,0.00'`, `'$0,0'`, `'0%'`). */
  format?: string;
  /** ISO currency code (e.g. `'USD'`); enables currency formatting on numeric values. */
  currency?: string;
  /** Static prefix appended in front of the formatted value (e.g. `'$'`, `'¥'`). */
  prefix?: string;
  /** Static suffix appended after the formatted value (e.g. `' /mo'`). */
  suffix?: string;
  /**
   * When true, the displayed value is `1 - value` (clamped to `[0, 1]`).
   * Useful for "compliance" / "uptime" style gauges that aggregate the
   * opposite signal (e.g. `avg(is_violated)` → display "compliance rate").
   * Only applied when the fetched value is a finite number in `[0, 1]`.
   */
  invert?: boolean;
  /**
   * Drill-down config. When enabled, clicking the metric card opens a
   * drawer (or modal) showing the underlying records that contributed
   * to this metric, filtered by the same `filter` used for aggregation.
   */
  drillDown?: DrillDownConfig;
  /** Title for the drill-down panel; defaults to the metric label. */
  title?: string | { key?: string; defaultValue?: string };
  /**
   * Period-over-period comparison configuration. When set, the widget
   * issues a parallel aggregate for the comparison window and derives a
   * trend (% delta + direction + i18n label like "vs last quarter").
   *
   * - `'previousPeriod'`: same window length immediately before the current.
   * - `'previousYear'`: same window shifted back one year.
   * - `{ offset: '7d' }`: sliding window shifted back by N days/weeks.
   *
   * Has no effect when no `filter` (or no date filter) is provided — the
   * shift uses the filter's date range to compute the comparison window.
   */
  compareTo?: CompareToConfig;
  /** Optional i18n translator used to localize the trend label. */
  t?: (key: string, defaultValue: string) => string;
}

export const ObjectMetricWidget: React.FC<ObjectMetricWidgetProps> = ({
  objectName,
  aggregate,
  filter,
  label,
  fallbackValue,
  trend,
  icon,
  className,
  description,
  dataSource: propDataSource,
  colorVariant,
  format,
  currency,
  prefix,
  suffix,
  invert,
  drillDown,
  title,
  compareTo,
  t: tProp,
}) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = propDataSource || context?.dataSource;
  const [drillOpen, setDrillOpen] = useState(false);

  const [fetchedValue, setFetchedValue] = useState<string | number | null>(null);
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);

  // Fetch object schema so we can derive currency/precision from the
  // aggregated field's metadata. This lets dashboard configs omit the
  // redundant `format: '$0,0'` / `prefix: '$'` for `Field.currency()` fields.
  useEffect(() => {
    let mounted = true;
    if (!dataSource || !objectName || typeof dataSource.getObjectSchema !== 'function') return;
    dataSource.getObjectSchema(objectName)
      .then((s: any) => { if (mounted) setObjectSchema(s); })
      .catch(() => { /* metadata lookup is best-effort */ });
    return () => { mounted = false; };
  }, [dataSource, objectName]);

  // Resolve the field definition for the aggregated field (e.g. 'amount').
  const valueFieldDef = useMemo(() => {
    const fieldName = aggregate?.field;
    if (!fieldName || !objectSchema?.fields) return null;
    const fields = objectSchema.fields;
    if (Array.isArray(fields)) return fields.find((f: any) => f?.name === fieldName) || null;
    return fields[fieldName] || null;
  }, [objectSchema, aggregate?.field]);

  // Derive format/currency from the field metadata when the dashboard config
  // doesn't override them. Honors `Field.currency({ defaultCurrency, precision })`.
  const inferredFormat = useMemo(() => {
    if (format) return format;
    if (!valueFieldDef) return undefined;
    if (valueFieldDef.type === 'currency') {
      const decimals = valueFieldDef.precision ?? valueFieldDef.scale ?? 0;
      return decimals > 0 ? `0,0.${'0'.repeat(decimals)}` : '0,0';
    }
    if (valueFieldDef.type === 'percent') return '0,0%';
    if (valueFieldDef.type === 'number' || valueFieldDef.type === 'integer') return '0,0';
    return undefined;
  }, [format, valueFieldDef]);

  // Tenant default currency (localization.currency, ADR-0053) backstops a
  // currency field that declares no explicit code of its own.
  const { currency: tenantCurrency } = useLocalization();
  const inferredCurrency = useMemo(() => {
    if (currency) return currency;
    if (valueFieldDef?.type !== 'currency') return undefined;
    return resolveFieldCurrency(valueFieldDef, tenantCurrency);
  }, [currency, valueFieldDef, tenantCurrency]);

  // Stable JSON keys to prevent infinite refetch loops when callers
  // pass fresh `aggregate` / `filter` object references each render
  // (e.g. DashboardRenderer.getComponentSchema rebuilds these on every render).
  const aggregateKey = useMemo(() => (aggregate ? JSON.stringify(aggregate) : ''), [aggregate]);

  // Resolve relative-date macros (e.g. "{current_quarter_start}") so the
  // server sees a real ISO date and the drill-down `find()` later sees the
  // exact same filter as the aggregate query.
  const resolvedFilter = useMemo(() => resolveDateMacros(filter), [filter]);
  const resolvedFilterKey = useMemo(
    () => (resolvedFilter ? JSON.stringify(resolvedFilter) : ''),
    [resolvedFilter],
  );

  const compareToKey = useMemo(
    () => (compareTo ? JSON.stringify(compareTo) : ''),
    [compareTo],
  );

  // Compute the single-bucket aggregate value for a given filter. Shared
  // between the current-period and comparison-period queries.
  const computeOne = useCallback(async (ds: any, filterForRun: any): Promise<number | string | null> => {
    if (aggregate && typeof ds.aggregate === 'function') {
      const results = await ds.aggregate(objectName, {
        field: aggregate.field,
        function: aggregate.function,
        groupBy: aggregate.groupBy || '_all',
        filter: filterForRun,
      });
      const data = Array.isArray(results) ? results : [];
      if (data.length === 0) return 0;
      if (aggregate.function === 'count') {
        const suffixedKey = `${aggregate.field}_count`;
        return data.reduce((sum: number, r: any) => sum + (
          Number(r[suffixedKey]) ||
          Number(r[aggregate.field]) ||
          Number(r.count) ||
          0
        ), 0);
      }
      const row = data[0] as Record<string, any>;
      const suffixedKey = `${aggregate.field}_${aggregate.function}`;
      return row[suffixedKey] ?? row[aggregate.field] ?? row.value ?? 0;
    }
    if (typeof ds.find === 'function') {
      const results = await ds.find(objectName, { $filter: filterForRun });
      const records = Array.isArray(results) ? results : results?.data || results?.records || [];
      return records.length;
    }
    return null;
  }, [objectName, aggregateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMetric = useCallback(async (ds: any, mounted: { current: boolean }) => {
    if (!ds || !objectName) return;
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // Run current and (optional) comparison aggregates in parallel so
      // a slow backend doesn't double the perceived load time.
      // Pass the RAW (unresolved) filter so `shiftFilterByCompareTo` can
      // substitute `{current_*}` tokens with their `{last_*}` counterparts
      // (`previousPeriod`) or re-resolve macros against a shifted `now`
      // (`previousYear` / `{offset}`). Passing the already-resolved filter
      // would produce an identical query with no period shift.
      const comparisonFilter = compareTo
        ? shiftFilterByCompareTo(filter, compareTo)
        : null;

      const [current, previous] = await Promise.all([
        computeOne(ds, resolvedFilter),
        comparisonFilter ? computeOne(ds, comparisonFilter) : Promise.resolve(null),
      ]);

      if (current === null) return;

      if (mounted.current) {
        setFetchedValue(current);
        setPreviousValue(typeof previous === 'number' && Number.isFinite(previous) ? previous : null);
      }
    } catch (e) {
      console.error('[ObjectMetricWidget] Fetch error:', e);
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Failed to load metric');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectName, aggregateKey, resolvedFilterKey, compareToKey, computeOne]);

  useEffect(() => {
    const mounted = { current: true };

    if (dataSource && objectName) {
      fetchMetric(dataSource, mounted);
    } else {
      // Reset state when dataSource becomes unavailable so we fall back
      // to the static fallbackValue instead of showing stale server data.
      setFetchedValue(null);
      setError(null);
    }

    return () => { mounted.current = false; };
  }, [dataSource, objectName, fetchMetric]);

  // Determine the display value:
  // - If we fetched a value from the server, use it
  // - If there's no data source, use the fallback (demo/static value)
  let displayValue: string | number = fetchedValue !== null
    ? fetchedValue
    : (!dataSource ? (fallbackValue ?? '—') : '—');

  // Apply `invert` for compliance-style gauges (display 1 - rate).
  if (invert && typeof displayValue === 'number' && isFinite(displayValue) && displayValue >= 0 && displayValue <= 1) {
    displayValue = 1 - displayValue;
  }

  // Derive a trend descriptor from the parallel comparison aggregate. When
  // `compareTo` is set and both values are finite numbers, this synthesizes
  // a `{ value, direction, label }` trend that overrides any static `trend`
  // prop passed in. The label uses the i18n key derived from `compareTo`
  // (e.g. `dashboard.trend.vsLastQuarter`).
  const derivedTrend = useMemo(() => {
    if (!compareTo) return undefined;
    if (typeof fetchedValue !== 'number' || !Number.isFinite(fetchedValue)) return undefined;
    if (previousValue === null) return undefined;
    const delta = computeMetricDelta(fetchedValue, previousValue);
    if (!delta) return undefined;
    const labelKey = compareToTrendLabelKey(compareTo, filter);
    const fullKey = `dashboard.trend.${labelKey}`;
    const defaults: Record<string, string> = {
      vsPreviousPeriod: 'vs previous period',
      vsLastWeek: 'vs last week',
      vsLastMonth: 'vs last month',
      vsLastQuarter: 'vs last quarter',
      vsLastYear: 'vs last year',
      vsYesterday: 'vs yesterday',
    };
    const labelText = tProp ? tProp(fullKey, defaults[labelKey] || labelKey) : (defaults[labelKey] || labelKey);
    return { value: delta.value, direction: delta.direction, label: labelText };
  }, [compareTo, fetchedValue, previousValue, filter, tProp]);

  const effectiveTrend = derivedTrend ?? trend;

  // --- Drill-down --------------------------------------------------------
  // KPI cards drill into the underlying records they aggregate. The drill
  // table reuses the metric's own `filter` (no additional category narrowing
  // — the whole metric is the slice). Falls back to the metric label as
  // drawer title when no explicit `drillDown.title` template is set.
  const drillEnabled = isDrillEnabled(drillDown) && !!objectName && !!dataSource;
  const drawerTitle = useMemo(() => {
    const labelText = typeof label === 'string' ? label : (label?.defaultValue || '');
    const titleText = typeof title === 'string' ? title : (title?.defaultValue || '');
    return resolveDrillTitle(drillDown, {}, titleText || labelText || 'Details');
  }, [drillDown, label, title]);

  const drillDrawer = useMemo(() => {
    if (!drillEnabled) return null;
    const target = drillDown?.target ?? 'drawer';

    // M3: when drillDown.report is supplied, drill into an analytical Report
    // (Dashboard → Report → List → Record). The widget's resolvedFilter is
    // merged into the report so the metric's scope is preserved.
    const reportConfig = (drillDown as any)?.report;
    const hasReport = reportConfig && typeof reportConfig === 'object'
      && (Array.isArray((reportConfig as any).columns) || 'objectName' in reportConfig);

    // Escape hatch — escalate the KPI peek to the object's full list page
    // (scoped by the same filter the metric aggregates). Hidden for report
    // drills and when no host navigation handler is present.
    const escapeHatch = !hasReport
      ? <OpenInListButton objectName={objectName} filter={resolvedFilter} onNavigate={() => setDrillOpen(false)} />
      : null;

    let body: React.ReactNode;
    if (hasReport) {
      const existingFilter = (reportConfig as any).filter;
      const mergedReportFilter = existingFilter
        ? (resolvedFilter ? { $and: [existingFilter, resolvedFilter] } : existingFilter)
        : resolvedFilter;
      const reportSchema = {
        type: 'spec-report',
        ...(reportConfig as Record<string, unknown>),
        filter: mergedReportFilter,
      } as any;
      body = (
        <div className="h-full overflow-auto">
          <SchemaRenderer schema={reportSchema} />
        </div>
      );
    } else {
      const tableSchema = {
        type: 'object-data-table',
        objectName,
        filter: resolvedFilter,
        pageSize: 25,
        // Complete the drill chain: a row in the KPI's record list opens that
        // record. Dialog target so it stacks cleanly over this drill drawer.
        drillDown: { enabled: true, mode: 'record', target: 'dialog' },
      } as any;
      body = (
        <div className="h-full overflow-auto">
          <SchemaRenderer schema={tableSchema} />
        </div>
      );
    }

    if (target === 'dialog') {
      return (
        <Dialog open onOpenChange={(v) => !v && setDrillOpen(false)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader className="flex-row items-center justify-between gap-4 pr-8">
              <DialogTitle>{drawerTitle}</DialogTitle>
              {escapeHatch}
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Sheet open onOpenChange={(v) => !v && setDrillOpen(false)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-5xl flex flex-col">
          <SheetHeader className="flex-row items-center justify-between gap-4 pr-8">
            <SheetTitle>{drawerTitle}</SheetTitle>
            {escapeHatch}
          </SheetHeader>
          <div className="flex-1 overflow-hidden mt-2">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }, [drillEnabled, drillDown, objectName, resolvedFilter, drawerTitle]);

  return (
    <>
      <MetricWidget
        label={label}
        value={displayValue}
        trend={effectiveTrend}
        icon={icon}
        className={className}
        description={description}
        loading={loading}
        error={error}
        colorVariant={colorVariant}
        format={inferredFormat}
        currency={inferredCurrency}
        prefix={prefix}
        suffix={suffix}
        onClick={drillEnabled ? () => setDrillOpen(true) : undefined}
      />
      {drillOpen && drillDrawer}
    </>
  );
};
