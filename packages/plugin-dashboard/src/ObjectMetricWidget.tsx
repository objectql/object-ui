/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { SchemaRendererContext } from '@object-ui/react';
import { MetricWidget } from './MetricWidget';

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
}) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = propDataSource || context?.dataSource;

  const [fetchedValue, setFetchedValue] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          filter,
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
        const results = await ds.find(objectName, { $filter: filter });
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
  }, [objectName, aggregate, filter]);

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

  return (
    <MetricWidget
      label={label}
      value={displayValue}
      trend={trend}
      icon={icon}
      className={className}
      description={description}
      loading={loading}
      error={error}
    />
  );
};
