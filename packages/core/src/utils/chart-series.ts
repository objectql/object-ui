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
 * Resolve select/enum dimension VALUES to display LABELS in chart rows.
 *
 * Analytics groups by a select field's stored `value` (e.g. `active`), but a
 * chart axis should read the option `label` (e.g. `合作中`). The server SHOULD
 * resolve this (ADR-0021), but when it can't — an AI-built select whose
 * `options` the analytics layer never sees, so its `resolveDimensionLabels`
 * silently no-ops — the rows arrive value-keyed. The axis then shows raw enum
 * values, and (worse) option-keyed colour / category wiring built from the
 * field `label`s no longer lines up with the value-keyed rows, so categories
 * read empty. This is the chart-layer safety net the legacy aggregate path
 * already gets from `resolveGroupByLabels`.
 *
 * Each row is rewritten by replacing `row[dim]` with `labelMaps[dim][value]`
 * when a mapping exists. Measure columns are untouched, so the grouped count
 * stays attached to its (now label-keyed) category — `value` is the matching
 * key, `label` is only the display. Values with no mapping (already a label
 * because the server resolved it, a lookup id, free text) pass through, so this
 * is safe to run unconditionally and is idempotent.
 *
 * Returns a NEW array; a row that needs no change keeps its identity, and the
 * input rows are never mutated, so the server's raw rows survive for
 * index-aligned drill-through (`drillRawRows`).
 */
export function relabelDimensions(
  rows: Array<Record<string, unknown>> | null | undefined,
  labelMaps: Record<string, Record<string, string>> | null | undefined,
): Array<Record<string, unknown>> {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!labelMaps) return safeRows;
  const dims = Object.keys(labelMaps).filter(
    (d) => labelMaps[d] && Object.keys(labelMaps[d]).length > 0,
  );
  if (dims.length === 0) return safeRows;
  return safeRows.map((row) => {
    let next: Record<string, unknown> | null = null;
    for (const dim of dims) {
      const raw = row[dim];
      if (raw == null) continue;
      const label = labelMaps[dim][String(raw)];
      if (label != null && label !== raw) {
        if (!next) next = { ...row };
        next[dim] = label;
      }
    }
    return next ?? row;
  });
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

/**
 * Build a per-category colour map from a select/lookup field's `options`.
 *
 * Keyed by BOTH the option `value` AND its display `label`, because a chart
 * row's category may carry either — the server resolves dataset select
 * dimensions value→label, while the legacy aggregate path keeps the raw value.
 * Returns `null` when the field has no options or none carry a colour, so the
 * caller can fall back to the positional palette.
 *
 * Shared by `ObjectChart` (plugin-charts) and `DatasetWidget` (plugin-dashboard)
 * so a select/lookup dimension's option colours (e.g. health green/red/yellow)
 * paint identically across the chart view and dashboard widgets.
 */
export function buildOptionColorMap(options: unknown): Record<string, string> | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  const map: Record<string, string> = {};
  for (const opt of options) {
    if (opt && typeof opt === 'object') {
      const o = opt as { value?: unknown; label?: unknown; color?: unknown };
      if (typeof o.color === 'string' && o.color) {
        if (o.value != null) map[String(o.value)] = o.color;
        if (o.label != null) map[String(o.label)] = o.color;
      }
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}

/**
 * Build a `{ value → label }` map from a select/enum field's `options`, for
 * resolving a grouped dimension's stored value to its display label (fed to
 * {@link relabelDimensions}). Mirrors {@link buildOptionColorMap}.
 *
 * Options may be `{ value, label }` objects or bare strings (value == label —
 * nothing to relabel). Only entries whose `label` actually differs from the
 * `value` are kept, so the map is empty (→ `null`) when relabeling would be a
 * no-op and the caller can skip it entirely.
 */
export function buildDimensionLabelMap(options: unknown): Record<string, string> | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  const map: Record<string, string> = {};
  for (const opt of options) {
    if (opt && typeof opt === 'object') {
      const o = opt as { value?: unknown; label?: unknown };
      if (o.value != null && o.label != null) {
        const v = String(o.value);
        const l = String(o.label);
        if (l !== v) map[v] = l;
      }
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}
