/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * chart-series — shape a semantic-layer `queryDataset` result into the
 * `{ data, xAxisKey, series }` triple a chart renderer consumes (ADR-0021, #1759).
 *
 * Shared by `ObjectChart` (plugin-charts) and `DatasetWidget` (plugin-dashboard)
 * so multi-dimension charts visualise identically across surfaces.
 *
 * Rules:
 *  - **2+ dimensions, single measure** → pivot the SECOND dimension into one
 *    series per distinct value (grouped/coloured bars). `xAxisKey` = first
 *    dimension; each output row is one first-dimension bucket with a column per
 *    second-dimension value holding the measure. This makes the second dimension
 *    visible instead of just repeating the x-axis label.
 *  - **otherwise** (single dimension, or multiple measures) → first dimension is
 *    the x-axis and each measure is its own series (long format passes through).
 */

export interface ChartResultField {
  name: string;
  label?: string;
  format?: string;
}

export interface ChartSeries {
  dataKey: string;
  label: string;
}

export interface ChartSeriesResult {
  data: Array<Record<string, unknown>>;
  xAxisKey: string | undefined;
  series: ChartSeries[];
}

export function buildChartSeries(
  rows: Array<Record<string, unknown>> | null | undefined,
  dimensions: string[] | null | undefined,
  values: string[] | null | undefined,
  fields?: ChartResultField[] | null,
): ChartSeriesResult {
  const dims = (dimensions ?? []).filter(Boolean);
  const vals = (values ?? []).filter(Boolean);
  const safeRows = Array.isArray(rows) ? rows : [];
  const labelOf = (name: string): string =>
    (fields ?? []).find((f) => f.name === name)?.label ?? name;

  // Multi-dimension, single-measure → pivot the second dimension into series.
  if (dims.length >= 2 && vals.length === 1) {
    const xKey = dims[0];
    const groupKey = dims[1];
    const measure = vals[0];
    const seriesKeys: string[] = [];
    const byX = new Map<string, Record<string, unknown>>();

    for (const row of safeRows) {
      const xRaw = row[xKey];
      const xId = String(xRaw ?? '');
      if (!byX.has(xId)) byX.set(xId, { [xKey]: xRaw });
      const gId = String(row[groupKey] ?? '');
      if (gId !== '' && !seriesKeys.includes(gId)) seriesKeys.push(gId);
      byX.get(xId)![gId] = row[measure];
    }

    return {
      data: Array.from(byX.values()),
      xAxisKey: xKey,
      // Series labels are the second-dimension values themselves (already
      // server-resolved to display labels by queryDataset).
      series: seriesKeys.map((k) => ({ dataKey: k, label: k })),
    };
  }

  // Default: first dimension on the x-axis, one series per measure.
  return {
    data: safeRows,
    xAxisKey: dims[0],
    series: vals.map((v) => ({ dataKey: v, label: labelOf(v) })),
  };
}

/**
 * Inverse of {@link buildChartSeries}: map a clicked chart segment back to the
 * index of its source dataset row, so a chart click can drill through to the
 * same records a table/pivot row would.
 *
 * Mirrors `buildChartSeries`' pivot rule:
 *  - **2+ dimensions, single measure** (second dim pivoted into series) → match
 *    BOTH the x-axis dimension (`category`) and the series dimension (`seriesKey`).
 *  - **otherwise** → match the x-axis (first) dimension only.
 *
 * Comparison is string-wise on the rows' display values (which is what the chart
 * surfaces as `category` / series key). Returns `-1` when nothing matches.
 */
export function findChartSeriesRow(
  rows: Array<Record<string, unknown>> | null | undefined,
  dimensions: string[] | null | undefined,
  values: string[] | null | undefined,
  category: string | undefined,
  seriesKey?: string,
): number {
  const dims = (dimensions ?? []).filter(Boolean);
  const vals = (values ?? []).filter(Boolean);
  const safeRows = Array.isArray(rows) ? rows : [];
  const xDim = dims[0];
  if (!xDim) return -1;
  const c = String(category ?? '');
  if (dims.length >= 2 && vals.length === 1) {
    const gDim = dims[1];
    const s = String(seriesKey ?? '');
    return safeRows.findIndex((r) => String(r[xDim] ?? '') === c && String(r[gDim] ?? '') === s);
  }
  return safeRows.findIndex((r) => String(r[xDim] ?? '') === c);
}
