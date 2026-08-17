/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * chart-presentation — the AUTHORED half of a dataset-bound chart, lowered onto
 * the bindings {@link buildChartSeries} derived from the dataset selection.
 *
 * `chart-series.ts` beside this file owns the DATA half: which columns become
 * series, which rows, which buckets. This file owns everything the author gets
 * to say about how that data LOOKS — the ruled data/presentation split of
 * objectui#4229, stated once:
 *
 *  - **Data (derived, never forwarded)** — series MEMBERSHIP and the column each
 *    binding reads. Concretely `buildChartSeries`' `dataKey`s, `xAxisKey`, and
 *    the spec's two binding keys `ChartSeries.name` and `ChartAxis.field`.
 *  - **Presentation (authored, merged forward)** — everything else on those same
 *    objects: `series[].type` (the per-series mark), `series[].yAxis` (which
 *    axis it binds to), `label`/`color`/`stack`/`variant`/`dashArray`/`opacity`,
 *    the axis definitions' `title`/`format`/`min`/`max`/`stepSize`/
 *    `showGridLines`/`position`/`logarithmic`, and the chart chrome
 *    (`showLegend`, `showDataLabels`, `colors`, `annotations`, …).
 *
 * ## Why it lives in `@object-ui/core` rather than in one plugin
 *
 * It was written for `plugin-dashboard`'s `DatasetWidget` (#3135 → objectstack#7016
 * → #4229) and lifted here by objectui#4877, when `plugin-report`'s embedded
 * report chart turned out to need the SAME merge over the same spec shapes: the
 * report was forwarding six keys and dropping every authored chrome key the
 * schema declares, and re-deriving this beside the dashboard's copy is exactly
 * the duplication objectui#4389 filed as a defect (two longhand copies of the
 * analytics label net, one per plugin, drifting apart).
 *
 * Everything here is a pure data transform over plain records, so it sits below
 * both plugins with no React and no i18n — the same layering `chart-series.ts`
 * already has (see {@link OptionLabelTranslator} there for why an i18n-resolved
 * string always arrives as an ARGUMENT rather than being read here).
 *
 * ## Two entry points, because the two surfaces declare axes differently
 *
 * A dashboard widget's `chartConfig` spells its axes as spec `ChartAxis`
 * OBJECTS. A report's `chart.xAxis` / `chart.yAxis` are bare dimension/measure
 * NAME strings — on that surface the axes are pure DATA (they ARE the selection)
 * and carry no presentation at all. So:
 *
 *  - {@link mergeAuthoredPresentation} is the object-axis entry point: series
 *    merge + axis presentation, for a caller whose axes are `ChartAxis` objects.
 *  - {@link mergeAuthoredSeries} is the series merge ALONE, for a caller whose
 *    axes are names. That split is structural, not a guard: handing a bare
 *    string to {@link mergeAuthoredPresentation} would run it through
 *    `axisPresentation`, which reads nothing off a string and would synthesise a
 *    `yAxis: [{}]` entry — a y-axis declaring nothing but its own existence,
 *    which is precisely how the COUNT of entries turns on a secondary axis. A
 *    surface that cannot author axis presentation should not be able to reach
 *    the code that reads it.
 */

import type { ChartSeriesBinding } from './chart-series';

/** Authored spec `ChartSeries` presentation, in the renderer's internal spelling. */
export interface AuthoredSeriesPresentation {
  label?: string;
  /** Spec `ChartSeries.type`, narrowed — see {@link seriesPresentation}. */
  chartType?: 'bar' | 'line' | 'area';
  yAxis?: 'left' | 'right';
  color?: string;
  stack?: string;
  variant?: 'primary' | 'comparison';
  dashArray?: string;
  opacity?: number;
}

/** A derived series binding with the author's presentation merged onto it. */
export type MergedChartSeries = ChartSeriesBinding & AuthoredSeriesPresentation;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * An i18n label is a plain string or a `{ en, zh-CN, … }` record; charts render
 * a string. Same pick `normalizeChartSchema` makes, so a label reads the same
 * on both paths.
 *
 * **First-string-wins, deliberately, and deliberately NOT locale-aware** — this
 * package is React-free and holds no i18n provider, so it cannot know which
 * limb a console wants. A caller that CAN resolve the language (the report
 * renderer, via `pickLocalized`) resolves the label itself and overrides the
 * merged one; see objectui#4020, whose whole point is that picking the first
 * limb paints English on a zh console.
 */
function labelText(v: unknown): string | undefined {
  if (typeof v === 'string' && v) return v;
  if (isRecord(v)) {
    const first = Object.values(v).find((x) => typeof x === 'string' && x);
    return first as string | undefined;
  }
  return undefined;
}

/**
 * One authored `ChartSeries`, minus its `name` — i.e. everything about it that
 * is presentation rather than membership.
 *
 * `type` is narrowed to the three families that COMPOSE on one cartesian plot,
 * because this array reaches the renderer already speaking the internal shape
 * (`ChartRenderer` forwards a `dataKey`-shaped array untouched, so
 * `normalizeChartSchema`'s own identical narrowing never sees it). Without the
 * narrowing a `type: 'pie'` would not merely be inert — it would count as a
 * family disagreement in `effectiveChartFamily`, flip the whole chart into a
 * combo, and then draw that series as a bar anyway.
 */
export function seriesPresentation(raw: Record<string, unknown>): AuthoredSeriesPresentation {
  const out: AuthoredSeriesPresentation = {};
  const family = raw.type;
  if (family === 'bar' || family === 'line' || family === 'area') out.chartType = family;
  if (raw.yAxis === 'left' || raw.yAxis === 'right') out.yAxis = raw.yAxis;
  const label = labelText(raw.label);
  if (label) out.label = label;
  if (typeof raw.color === 'string' && raw.color) out.color = raw.color;
  if (typeof raw.stack === 'string' && raw.stack) out.stack = raw.stack;
  if (raw.variant === 'primary' || raw.variant === 'comparison') out.variant = raw.variant;
  if (typeof raw.dashArray === 'string' && raw.dashArray) out.dashArray = raw.dashArray;
  if (typeof raw.opacity === 'number' && Number.isFinite(raw.opacity)) out.opacity = raw.opacity;
  return out;
}

/**
 * One authored `ChartAxis`, minus its `field` — the axis's presentation.
 *
 * `field` is the one DATA key on an axis (it names the plotted column), and
 * dropping it here is what keeps membership with the dataset **structurally**
 * rather than by a guard: `normalizeChartSchema` synthesises series out of
 * `yAxis[].field` when a chart declares no series, so a forwarded `field`
 * would be a live membership channel on an empty selection. With it gone the
 * axis carries scale and chrome only, and the count of entries — which is what
 * turns on the secondary axis (`yAxes.length > 1`) — survives, including for
 * an entry that declares nothing but its own existence.
 *
 * Keys the renderer does not read on a given axis are dropped by
 * `normalizeChartSchema`, the ONE normalization layer (#2880 S1): today it
 * keeps `format`/`title`/`showGridLines` on the x-axis and the full set on the
 * y-axes. That narrowing is deliberately NOT mirrored here — a second copy
 * would drift from the renderer's real capability the moment it grew.
 */
export function axisPresentation(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isRecord(raw)) return out;
  const title = labelText(raw.title);
  if (title) out.title = title;
  if (typeof raw.format === 'string' && raw.format) out.format = raw.format;
  if (typeof raw.min === 'number' && Number.isFinite(raw.min)) out.min = raw.min;
  if (typeof raw.max === 'number' && Number.isFinite(raw.max)) out.max = raw.max;
  if (typeof raw.stepSize === 'number' && Number.isFinite(raw.stepSize) && raw.stepSize > 0) {
    out.stepSize = raw.stepSize;
  }
  if (typeof raw.showGridLines === 'boolean') out.showGridLines = raw.showGridLines;
  if (raw.position === 'left' || raw.position === 'right' || raw.position === 'top' || raw.position === 'bottom') {
    out.position = raw.position;
  }
  if (typeof raw.logarithmic === 'boolean') out.logarithmic = raw.logarithmic;
  return out;
}

/**
 * Merge an authored `series[]` array's PRESENTATION onto the bindings the
 * dataset selection derived — the series half of #4229's split, and the whole
 * of it for a surface whose axes are names rather than objects (see the file
 * header).
 *
 * The match rule is **by name/key**: an authored `series[].name` is paired with
 * the derived binding whose `dataKey` it equals, and the pairing decides
 * nothing but presentation:
 *
 *  - an authored entry naming a measure that is NOT in the dataset selection is
 *    **ignored** — membership belongs to the dataset, so an author cannot add,
 *    remove or re-point a series from the chart config;
 *  - a derived series with no authored entry keeps the family default, so every
 *    surface that never wrote `series` renders byte-for-byte as before;
 *  - where both exist the **explicit binding wins** (#2880 S2), which is the
 *    whole point: `type: 'line'` + `yAxis: 'right'` is how the spec says "this
 *    measure is a line on the secondary axis".
 *
 * Matching on `name` only is deliberate: `name` is the spec's authorable key
 * for a series (`dataKey` is a declared ALIAS of it, resolved where the
 * metadata is parsed), so reading a second spelling here would fossilize a
 * dialect this renderer has no business accepting (AGENTS.md #0.1).
 *
 * The FIRST entry naming a measure wins; a later duplicate cannot silently
 * reconfigure a series the author already described.
 *
 * @param derived the bindings {@link buildChartSeries} produced from the selection
 * @param authoredSeries the authored `series` array (anything, incl. absent)
 */
export function mergeAuthoredSeries(
  derived: ChartSeriesBinding[],
  authoredSeries: unknown,
): MergedChartSeries[] {
  const authored = new Map<string, Record<string, unknown>>();
  for (const entry of Array.isArray(authoredSeries) ? authoredSeries : []) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name : undefined;
    if (name && !authored.has(name)) authored.set(name, entry);
  }
  return derived.map((s) => {
    const entry = authored.get(s.dataKey);
    return entry ? { ...s, ...seriesPresentation(entry) } : s;
  });
}

/**
 * Merge an authored chart config's PRESENTATION onto the series and axes the
 * dataset selection derived — the one place that happens for a surface whose
 * axes are spec `ChartAxis` OBJECTS (#4229).
 *
 * The series half is {@link mergeAuthoredSeries}; see it for the match rule and
 * for why membership is safe. The axes half reads `xAxis` / `yAxis` through
 * {@link axisPresentation}, which is why a surface spelling those as bare NAME
 * strings must call `mergeAuthoredSeries` directly instead (file header).
 *
 * @param derived the bindings {@link buildChartSeries} produced from the selection
 * @param raw the authored chart config (anything, incl. absent)
 * @returns the merged series, plus the presentation-only axes to spread onto
 *   the chart schema (absent when the author declared none)
 */
export function mergeAuthoredPresentation(
  derived: ChartSeriesBinding[],
  raw: unknown,
): { series: MergedChartSeries[]; axes: Record<string, unknown> } {
  const config: Record<string, unknown> = isRecord(raw) ? raw : {};
  const series = mergeAuthoredSeries(derived, config.series);

  const axes: Record<string, unknown> = {};
  const xAxis = axisPresentation(config.xAxis);
  if (Object.keys(xAxis).length > 0) axes.xAxis = xAxis;
  // The COUNT of y-axis entries is itself presentation — it is what declares a
  // secondary axis — so every declared entry keeps its slot even when it
  // carries nothing but `field` (which is data and does not travel).
  const yAxisRaw = Array.isArray(config.yAxis)
    ? config.yAxis
    : config.yAxis !== undefined
      ? [config.yAxis]
      : [];
  if (yAxisRaw.length > 0) axes.yAxis = yAxisRaw.map(axisPresentation);

  return { series, axes };
}

/**
 * Lower an authored chart config's CHROME (spec `ChartConfigSchema` /
 * `ReportChartSchema` — the same keys on both) onto the chart schema a
 * dataset-bound surface hands the renderer.
 *
 * ## Why this is a whitelist and not a spread
 *
 * Until #3135 NONE of a dashboard widget's `chartConfig` reached the renderer:
 * the widget read `options` and nothing else, so an author who wrote
 * `showLegend: false` still got a legend and one who wrote `true` only got one
 * because "on" is the renderer's default. #3135 lowered that single flag and
 * left the rest declared and inert. objectstack#7016 lowered the rest of the
 * keys that are actually DELIVERED, admitting a key only when both of these
 * hold:
 *
 *  1. **The chart block draws it end to end.** `{ type: 'chart' }` resolves to
 *     `ChartRenderer` → `AdvancedChartImpl`, which draws `title`/`subtitle` in
 *     its ChartFrame, turns `description` into the chart container's
 *     `role="img"` + `aria-label`, applies `height` as that container's inline
 *     height, reads `colors` as the positional palette, prints
 *     `showDataLabels` as a Recharts `LabelList`, draws `annotations` as
 *     ReferenceLine/ReferenceArea and honours `interaction` as the tooltip
 *     toggle plus `Brush`. Forwarding a key the renderer ignores would only
 *     move declared-but-not-delivered one layer down, which is the failure this
 *     exists to remove.
 *  2. **It does not fight the dataset derivation.** `type` stays out: the
 *     calling surface's own type already picks the chart family, which is the
 *     dataset path's chart-family channel.
 *
 * `aria` is the one declared key with **no reader at all**: `AdvancedChartImpl`
 * has no `aria` prop, and `SchemaRenderer`'s ARIA injection reads the FLAT
 * `ariaLabel`/`ariaDescribedBy`/`role`, never a nested `aria` object. It is
 * therefore left unforwarded on purpose (criterion 1) rather than papered over
 * with a caller-side flattening that would also collide with the accessible
 * name `description` already sets — reported back to objectstack#5175's
 * narrowing half instead.
 *
 * `title` IS emitted here. A caller that paints the title itself (the report
 * renderer's own `h3` above the chart) must drop it from the result, or the
 * chart draws a second one.
 *
 * @param raw the authored chart config (anything, incl. absent)
 * @param fieldCategoryColors per-category colours resolved from the category
 *   dimension's own select/lookup option colours, merged UNDER an explicit
 *   author map (see the `colors` note below)
 * @returns only the keys that resolved, so the caller can spread it over the
 *   derived chart schema and every undeclared key keeps the renderer's default
 */
export function chartConfigPresentation(
  raw: unknown,
  fieldCategoryColors?: Record<string, string> | null,
): Record<string, unknown> {
  const config: Record<string, unknown> = isRecord(raw) ? raw : {};
  const out: Record<string, unknown> = {};

  const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

  if (typeof config.showLegend === 'boolean') out.showLegend = config.showLegend;
  if (typeof config.showDataLabels === 'boolean') out.showDataLabels = config.showDataLabels;
  const title = text(config.title);
  if (title) out.title = title;
  const subtitle = text(config.subtitle);
  if (subtitle) out.subtitle = subtitle;
  const description = text(config.description);
  if (description) out.description = description;
  // A non-positive height would collapse the plot; the container default is the
  // more honest answer than an invisible chart.
  if (typeof config.height === 'number' && Number.isFinite(config.height) && config.height > 0) {
    out.height = config.height;
  }
  if (Array.isArray(config.annotations) && config.annotations.length > 0) out.annotations = config.annotations;
  if (config.interaction && typeof config.interaction === 'object' && !Array.isArray(config.interaction)) {
    out.interaction = config.interaction;
  }

  // `colors` is overloaded kanban-style — and the two arms reach the renderer
  // through two DIFFERENT props, so the split has to happen here (the react
  // tier's ObjectChart splits it the same way): a `string[]` is the positional
  // palette (`colors`), a `{ value: color }` record is an explicit per-category
  // map (`categoryColors`). The author's map is merged OVER the dimension
  // field's own option colours, which is the precedence the spec field comment
  // states ("a value→color map — and a select/lookup dimension's option colors
  // — take precedence over the positional palette per category").
  const palette = Array.isArray(config.colors)
    ? config.colors.filter((c): c is string => typeof c === 'string' && !!c)
    : undefined;
  if (palette?.length) out.colors = palette;
  const authorCategoryColors =
    config.colors && typeof config.colors === 'object' && !Array.isArray(config.colors)
      ? (config.colors as Record<string, string>)
      : undefined;
  if (fieldCategoryColors || authorCategoryColors) {
    out.categoryColors = { ...(fieldCategoryColors ?? {}), ...(authorCategoryColors ?? {}) };
  }

  return out;
}
