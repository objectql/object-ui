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
import { MetricWidget } from './MetricWidget';
import { resolveDateMacros } from './utils';

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
   * Drill-down config. When enabled, clicking the metric card opens a
   * drawer (or modal) showing the underlying records that contributed
   * to this metric, filtered by the same `filter` used for aggregation.
   */
  drillDown?: DrillDownConfig;
  /** Title for the drill-down panel; defaults to the metric label. */
  title?: string | { key?: string; defaultValue?: string };
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
  drillDown,
  title,
}) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = propDataSource || context?.dataSource;
  const [drillOpen, setDrillOpen] = useState(false);

  const [fetchedValue, setFetchedValue] = useState<string | number | null>(null);
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

  const inferredCurrency = useMemo(() => {
    if (currency) return currency;
    if (valueFieldDef?.type !== 'currency') return undefined;
    return valueFieldDef.defaultCurrency || valueFieldDef.currency || undefined;
  }, [currency, valueFieldDef]);

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

  const fetchMetric = useCallback(async (ds: any, mounted: { current: boolean }) => {
    if (!ds || !objectName) return;
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }

    try {
      let value: string | number;

      if (aggregate && typeof ds.aggregate === 'function') {
        // Server-side aggregation
        const results = await ds.aggregate(objectName, {
          field: aggregate.field,
          function: aggregate.function,
          groupBy: aggregate.groupBy || '_all',
          filter: resolvedFilter,
        });
        const data = Array.isArray(results) ? results : [];

        if (data.length === 0) {
          value = 0;
        } else if (aggregate.function === 'count') {
          // Sum all count results
          value = data.reduce((sum: number, r: any) => sum + (Number(r[aggregate.field]) || Number(r.count) || 0), 0);
        } else {
          // Take the first result's value
          value = data[0][aggregate.field] ?? 0;
        }
      } else if (typeof ds.find === 'function') {
        // Fallback: count records
        const results = await ds.find(objectName, { $filter: resolvedFilter });
        const records = Array.isArray(results) ? results : results?.data || results?.records || [];
        value = records.length;
      } else {
        return;
      }

      if (mounted.current) {
        setFetchedValue(value);
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
  }, [objectName, aggregateKey, resolvedFilterKey]);

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
  const displayValue = fetchedValue !== null
    ? fetchedValue
    : (!dataSource ? (fallbackValue ?? '—') : '—');

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
    const tableSchema = {
      type: 'object-data-table',
      objectName,
      filter: resolvedFilter,
      pageSize: 25,
      drillDown: { enabled: false },
    } as any;
    const body = (
      <div className="h-full overflow-auto">
        <SchemaRenderer schema={tableSchema} />
      </div>
    );
    if (target === 'modal') {
      return (
        <Dialog open onOpenChange={(v) => !v && setDrillOpen(false)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>{drawerTitle}</DialogTitle></DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Sheet open onOpenChange={(v) => !v && setDrillOpen(false)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl flex flex-col">
          <SheetHeader><SheetTitle>{drawerTitle}</SheetTitle></SheetHeader>
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
        trend={trend}
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
