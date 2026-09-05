/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The ONE place the spec's author-facing chart shape is translated into the
 * renderer's internal pipeline contract (framework#3729 / objectui#2880).
 *
 * ## Why this exists
 *
 * `ChartConfigSchema` (`@objectstack/spec/ui`) is the chart protocol — axes are
 * `{ field, format, min, max, logarithmic, … }` objects and series are
 * `{ name, stack, yAxis, … }`. The renderer, however, grew a Recharts-flavoured
 * internal shape: `chartType`, `xAxisKey` (a bare string) and
 * `series[].dataKey`. Everything an author wrote in the SPEC shape reached the
 * renderer and was silently dropped — precisely what ADR-0078 forbids.
 *
 * This module closes that gap by NORMALIZING at the boundary, rather than by
 * sprinkling `??` fallbacks through the render tree. That distinction matters
 * (framework PD #12): a lone normalization layer is a translation from one
 * declared contract to another, whereas scattered fallbacks fossilize a second
 * de-facto dialect at every read site.
 *
 * **Internal props win.** `DashboardRenderer`, `ObjectView` and the dataset
 * path already speak the internal shape; passing `xAxisKey`/`series[].dataKey`
 * explicitly keeps working byte-for-byte, so there is no migration.
 *
 * ## The `type` collision
 *
 * `ChartConfig.type` is the chart family (`'bar' | 'line' | …`). But on every
 * surface that FLATTENS chart config into a component props bag — the react
 * tier's injected blocks especially — `type` is already taken: it is the SDUI
 * envelope's component discriminator (`{ type: 'object-chart', … }`). An author
 * writing `type="bar"` would replace the discriminator and the block would not
 * resolve at all.
 *
 * The collision is created by the flattening, so it is resolved there: the
 * react-page wrapper preserves an author-supplied `type` under `specType`
 * before stamping the discriminator (see `react-page.tsx`). This module reads
 * it back. Surfaces where chart config is properly NESTED (a dashboard
 * widget's `chartConfig`) never collide and pass `type` through untouched.
 */

/**
 * A chart family this renderer actually draws.
 *
 * Every member is a `@objectstack/spec` `ChartTypeSchema` value except
 * **`combo`**, which is renderer-local and is NOT a spec chart type (#2945).
 * The spec models a combo chart per-series instead — `ChartSeries.type`, whose
 * field comment reads *"Series type override (combo charts)"* — exactly as it
 * models stacking with `ChartSeries.stack` rather than a `stacked-bar` family:
 *
 * > stacking is not a chart family, it is a property of the series … One `bar`
 * > family plus a series-level stack group expresses all three without
 * > multiplying the taxonomy.  — `spec/src/ui/chart.zod.ts`
 *
 * So `combo` is not a name an author should have to reach for. It is what "the
 * series disagree about their family" looks like from the renderer's side, and
 * {@link effectiveChartFamily} derives it. It stays in the union because
 * internal-shape callers pass it explicitly today (`DatasetPreview`) and
 * because dropping a name that is already authored breaks those charts.
 */
export type ChartFamily =
  | 'bar' | 'column' | 'horizontal-bar'
  | 'line' | 'area'
  | 'pie' | 'donut' | 'funnel'
  | 'radar' | 'scatter'
  | 'treemap' | 'sankey'
  | 'combo';

export const RENDERABLE = new Set<string>([
  'bar', 'column', 'horizontal-bar',
  'line', 'area',
  'pie', 'donut', 'funnel',
  'radar', 'scatter',
  'treemap', 'sankey',
  'combo',
]);

/**
 * Every value the spec's `ChartTypeSchema` admits — a superset of
 * {@link RENDERABLE}, because single-value families (`metric`, `kpi`, `gauge`,
 * …) and tabular ones render through other components entirely.
 *
 * Recognition is broader than rendering on purpose: this set is what decides
 * whether a bare `type` is a chart family or the SDUI envelope's component
 * discriminator, and getting THAT wrong would break the block outright.
 */
/**
 * The spec's single-value chart families (`ChartTypeSchema`, whose own
 * comment calls gauge/solid-gauge/bullet "honest single-value variants
 * pending a real dial/target renderer"). The chart draws these as a number —
 * they used to fall through the cartesian component map's `|| BarChart` into
 * a bar SHELL whose series marks all returned null: grid, axes, tooltip and
 * legend rendered with no data marks, indistinguishable from an empty
 * dataset (#2942). Exported for the dispatch and the spec-parity test.
 */
export const SINGLE_VALUE_CHART_TYPES: ReadonlySet<string> = new Set([
  'gauge', 'solid-gauge', 'metric', 'kpi', 'bullet',
]);

/**
 * The spec's tabular chart families — a table is not a series chart; these
 * render through the data-table / pivot components, and the chart block says
 * so instead of drawing the same silent empty plot (#2942).
 */
export const TABULAR_CHART_TYPES: ReadonlySet<string> = new Set(['table', 'pivot']);

const CHART_TYPES = new Set<string>([
  ...RENDERABLE,
  ...SINGLE_VALUE_CHART_TYPES,
  ...TABULAR_CHART_TYPES,
]);

export type AnyRec = Record<string, any>;

/** A y-axis (or the x-axis) after normalization — spec `ChartAxis`, resolved. */
export interface NormalizedAxis {
  /** Result column this axis reads (y-axis only; the x-axis field becomes `xAxisKey`). */
  field?: string;
  /** d3-style format string, e.g. `"$0,0.00"` / `"0.0%"`. */
  format?: string;
  min?: number;
  max?: number;
  /** Distance between ticks on this axis. */
  stepSize?: number;
  /** Default true, per the spec schema. */
  showGridLines?: boolean;
  logarithmic?: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
  /** Axis title (already resolved to a plain string). */
  title?: string;
}

/** The families that compose on one cartesian plot — see {@link SeriesFamily}. */
export type SeriesFamily = 'bar' | 'line' | 'area';

export interface NormalizedSeries {
  dataKey: string;
  label?: string;
  /**
   * Per-series family override — spec `ChartSeries.type`.
   *
   * The spec types it as the full `ChartTypeSchema`, but only the cartesian
   * families compose on one plot (a `pie` series inside a bar chart names
   * nothing), so recognition stops at bar/line/area.
   */
  chartType?: SeriesFamily;
  variant?: 'current' | 'comparison' | 'primary';
  opacity?: number;
  dashArray?: string;
  /** Stack group id — series sharing one id stack together. */
  stack?: string;
  /** Which y-axis this series binds to (dual-axis charts). */
  yAxis?: 'left' | 'right';
  color?: string;
}

export interface NormalizedChartSchema {
  chartType?: ChartFamily;
  xAxisKey?: string;
  series?: NormalizedSeries[];
  /** X-axis presentation config (its `field` is hoisted to `xAxisKey`). */
  xAxis?: NormalizedAxis;
  /** Y-axes, in declaration order. Index 0 is the primary (left) axis. */
  yAxes?: NormalizedAxis[];
  showLegend?: boolean;
  showDataLabels?: boolean;
  title?: string;
  subtitle?: string;
  /** Accessibility description — announced to screen readers. */
  description?: string;
  /** Fixed plot height in pixels. */
  height?: number;
  annotations?: AnyRec[];
  interaction?: AnyRec;
}

const isRec = (v: unknown): v is AnyRec => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * An i18n label may be a plain string or a `{ en, zh-CN, … }` record. Charts
 * render a string; pick a reasonable one rather than `[object Object]`.
 */
function label(v: unknown): string | undefined {
  const s = str(v);
  if (s) return s;
  if (isRec(v)) {
    const first = Object.values(v).find((x) => typeof x === 'string' && x);
    return first as string | undefined;
  }
  return undefined;
}

function normalizeAxis(raw: unknown): NormalizedAxis | undefined {
  if (!isRec(raw)) return undefined;
  const out: NormalizedAxis = {};
  const field = str(raw.field);
  if (field) out.field = field;
  const format = str(raw.format);
  if (format) out.format = format;
  const min = num(raw.min);
  if (min !== undefined) out.min = min;
  const max = num(raw.max);
  if (max !== undefined) out.max = max;
  const stepSize = num(raw.stepSize);
  if (stepSize !== undefined && stepSize > 0) out.stepSize = stepSize;
  if (typeof raw.showGridLines === 'boolean') out.showGridLines = raw.showGridLines;
  if (typeof raw.logarithmic === 'boolean') out.logarithmic = raw.logarithmic;
  const position = str(raw.position);
  if (position === 'left' || position === 'right' || position === 'top' || position === 'bottom') {
    out.position = position;
  }
  const title = label(raw.title);
  if (title) out.title = title;
  return out;
}

/**
 * Merge one series entry from either shape.
 *
 * Internal (`dataKey`) wins over spec (`name`) so a caller that already speaks
 * the internal contract is untouched.
 *
 * ## `chartType` is the INTERNAL spelling, and only that (objectui#7744)
 *
 * The two spellings of the per-series family are NOT two authoring keys:
 *
 * - `type` is the AUTHORING face's key — spec `ChartSeries.type`, declared on
 *   the mirror as `ChartDataSeriesSchema.type` (`'bar' | 'line' | 'area'`).
 * - `chartType` is the RENDERER-INTERNAL carrier. It rides on the `dataKey`-
 *   shaped series that `DashboardRenderer`, `ObjectView` and the dataset path
 *   hand straight to `ChartRenderer`, which is where it is declared
 *   (`ChartRenderer.tsx:65`, on the internal series shape) and where
 *   {@link NormalizedSeries.chartType} is the output half of the same
 *   contract. On the AUTHORING face it is not a member at all: it is a named
 *   alias refusal — `ChartDataSeriesSchema.chartType`
 *   (`packages/types/src/zod/data-display.zod.ts`, objectui#7694 / PR #7737),
 *   pinned in that package's
 *   `__tests__/chart-series-chart-type-alias-refusal-7694.test.ts`. Read the
 *   rule and its remedy THERE. Restating either here would be a second copy of
 *   a rule that only one of the two files is ever edited with.
 *
 * ## The split this limb carries, deliberately (objectui#7744)
 *
 * This function normalizes BOTH shapes, and the `family` limb below cannot
 * tell them apart: by the time `raw` arrives it is a bag of keys with nothing
 * on it naming its producer. So an AUTHORED series that skipped validation
 * still gets `chartType` honoured at runtime — and honoured OVER the declared
 * `type`, which the limb reads second — while the validator refuses that same
 * key by name. The two faces disagree, and that is the state this comment
 * exists to make legible rather than to fix: the objectui#7744 ruling was to
 * annotate and pin, NOT to retire the limb at the reader, because retiring it
 * would change what the internal producers above render — a reader-side
 * decision of its own.
 *
 * ⛔ Do not delete the limb on the strength of a green ablation. Deleting
 * `str(raw.chartType) ??` left the repo fully green when it was measured
 * (304 files / 5817 tests) while deleting its ` ?? str(raw.type)` sibling went
 * 2 red — green there means only that no test PINNED it, never that no
 * producer depends on it. Both halves of the split, and the precedence between
 * them, are now pinned in `__tests__/chartType-internal-only-7744.test.ts`;
 * that case is what goes red if the two faces are ever brought into agreement,
 * from either side.
 */
function normalizeSeries(raw: unknown): NormalizedSeries | undefined {
  if (!isRec(raw)) {
    // A bare string is accepted as a shorthand for `{ name }` — the Tremor-ish
    // `categories: ['a','b']` form ChartRenderer already adapts.
    const bare = str(raw);
    return bare ? { dataKey: bare } : undefined;
  }
  const dataKey = str(raw.dataKey) ?? str(raw.name);
  if (!dataKey) return undefined;
  const out: NormalizedSeries = { dataKey };
  const lbl = label(raw.label);
  if (lbl) out.label = lbl;
  // INTERNAL spelling FIRST, authored `type` second — see the docblock above.
  // The order is load-bearing and pinned; neither limb is dead.
  const family = str(raw.chartType) ?? str(raw.type);
  if (family === 'bar' || family === 'line' || family === 'area') out.chartType = family;
  const variant = str(raw.variant);
  if (variant === 'comparison' || variant === 'current' || variant === 'primary') out.variant = variant;
  const opacity = num(raw.opacity);
  if (opacity !== undefined) out.opacity = opacity;
  const dash = str(raw.dashArray);
  if (dash) out.dashArray = dash;
  const stack = str(raw.stack);
  if (stack) out.stack = stack;
  const yAxis = str(raw.yAxis);
  if (yAxis === 'left' || yAxis === 'right') out.yAxis = yAxis;
  const color = str(raw.color);
  if (color) out.color = color;
  return out;
}

/**
 * Translate a chart schema — spec shape, internal shape, or a mix — into the
 * renderer's internal contract. Only keys that resolve to something are
 * present on the result, so callers can spread it over their own defaults.
 */
export function normalizeChartSchema(schema: unknown): NormalizedChartSchema {
  if (!isRec(schema)) return {};
  const out: NormalizedChartSchema = {};

  // ── chart family ────────────────────────────────────────────────────────
  // `chartType` (internal) → `specType` (an author `type` rescued from the
  // envelope collision) → `type` (only when it is unambiguously a chart family
  // and not a component discriminator).
  const rawType = str(schema.type);
  const chartType =
    str(schema.chartType) ??
    str(schema.specType) ??
    (rawType && CHART_TYPES.has(rawType) ? rawType : undefined);
  // A family this renderer does not draw (`metric`, `table`, …) is left unset
  // rather than mapped onto a bar chart — the caller's own default is a more
  // honest answer than silently drawing the wrong picture.
  if (chartType && RENDERABLE.has(chartType)) out.chartType = chartType as ChartFamily;

  // ── axes ────────────────────────────────────────────────────────────────
  // Spec `xAxis` is an object; the report surface narrows it to a bare string.
  // Both mean "the column on the category axis".
  const xAxisRaw = schema.xAxis;
  const xAxisSpec = normalizeAxis(xAxisRaw);
  if (xAxisSpec && (xAxisSpec.format || xAxisSpec.title || xAxisSpec.showGridLines !== undefined)) {
    out.xAxis = xAxisSpec;
  }
  const xAxisKey = str(schema.xAxisKey) ?? xAxisSpec?.field ?? str(xAxisRaw);
  if (xAxisKey) out.xAxisKey = xAxisKey;

  const yAxes = (Array.isArray(schema.yAxis) ? schema.yAxis : schema.yAxis !== undefined ? [schema.yAxis] : [])
    .map((a: unknown) => normalizeAxis(a) ?? (str(a) ? { field: str(a) } : undefined))
    .filter((a): a is NormalizedAxis => !!a);
  if (yAxes.length) out.yAxes = yAxes;

  // ── series ──────────────────────────────────────────────────────────────
  // ⚠️ `categories` is an ALTERNATIVE SERIES LIST here, not axis labels, and
  // this branch is the whole of its meaning: it is consulted only when `series`
  // is absent, and each entry then goes through `normalizeSeries`, whose bare-
  // string branch reads it as `{ dataKey }` — a COLUMN NAME. The category axis
  // is resolved separately, from `xAxisKey` / `xAxis` above.
  //
  // `@object-ui/types` documented this key as "X-axis labels/categories" until
  // objectui#6896; the declaration was corrected to this reading rather than
  // this reading to the declaration (maintainer ruling 2026-08-31 — prose
  // follows machine). Pinned in `normalizeChartSchema.test.ts`; if you change
  // what `categories` means here, that docblock is the other half of the edit.
  const rawSeries = Array.isArray(schema.series)
    ? schema.series
    : Array.isArray(schema.categories)
      ? schema.categories
      : undefined;
  let series = rawSeries?.map(normalizeSeries).filter((s): s is NormalizedSeries => !!s);
  // No series at all: the y-axes name the plotted columns, so a chart written
  // purely in spec shape (`yAxis: [{ field: 'total' }]`) still plots.
  if (!series?.length) {
    const fromAxes = yAxes
      .filter((a) => a.field)
      .map<NormalizedSeries>((a, i) => ({
        dataKey: a.field!,
        ...(a.title ? { label: a.title } : {}),
        ...(i > 0 || a.position === 'right' ? { yAxis: 'right' as const } : {}),
      }));
    if (fromAxes.length) series = fromAxes;
  }
  if (series?.length) out.series = series;

  // ── chrome ──────────────────────────────────────────────────────────────
  if (typeof schema.showLegend === 'boolean') out.showLegend = schema.showLegend;
  if (typeof schema.showDataLabels === 'boolean') out.showDataLabels = schema.showDataLabels;
  const title = label(schema.title);
  if (title) out.title = title;
  const subtitle = label(schema.subtitle);
  if (subtitle) out.subtitle = subtitle;
  const description = label(schema.description);
  if (description) out.description = description;
  const height = num(schema.height);
  if (height !== undefined && height > 0) out.height = height;
  if (Array.isArray(schema.annotations) && schema.annotations.length) {
    out.annotations = schema.annotations.filter(isRec);
  }
  if (isRec(schema.interaction)) out.interaction = schema.interaction;

  return out;
}

/**
 * Which family an un-annotated series takes when the chart is drawn as a combo,
 * or `undefined` when the chart's own family has no per-series meaning.
 *
 * `undefined` therefore doubles as "this combo was authored, not derived":
 * only a cartesian family can be widened into a combo, so a chart that reaches
 * the combo renderer with no base family got there by being named `combo`.
 */
export function comboBaseFamily(chartType: string | undefined): SeriesFamily | undefined {
  if (chartType === 'bar' || chartType === 'column') return 'bar';
  if (chartType === 'line') return 'line';
  if (chartType === 'area') return 'area';
  return undefined;
}

/**
 * The family the renderer should actually draw.
 *
 * `ChartSeries.type` is the spec's own way to say "this series is a line on an
 * otherwise-bar chart", and until now it was parsed, carried through
 * normalization, and then dropped: only the renderer's `chartType === 'combo'`
 * branch reads `series[].chartType`, so a chart authored in the spec shape
 *
 * ```ts
 * { type: 'bar', series: [{ name: 'revenue' }, { name: 'margin', type: 'line' }] }
 * ```
 *
 * drew `margin` as a bar. Silently — the value was right at every layer except
 * the last. That is the failure this widens: an author writing the protocol got
 * the wrong picture unless they also knew to write objectui's non-spec `combo`.
 *
 * Only a disagreement derives a combo. A chart whose series all resolve to the
 * same family keeps its own family, so nothing that renders correctly today
 * changes; and an explicit `combo` is returned untouched.
 *
 * Pass the chart's EFFECTIVE family (defaults already applied) — the answer
 * depends on what an un-annotated series would otherwise have drawn.
 */
export function effectiveChartFamily<T extends ChartFamily | undefined>(
  chartType: T,
  series: readonly Pick<NormalizedSeries, 'chartType'>[] | undefined,
): T | 'combo' {
  if (chartType === 'combo') return 'combo';
  const base = comboBaseFamily(chartType);
  if (!base || !series || series.length < 2) return chartType;
  const resolved = series.map((s) => s.chartType ?? base);
  return new Set(resolved).size > 1 ? 'combo' : chartType;
}

/**
 * Build a tick formatter from a spec `ChartAxis.format` string.
 *
 * The spec documents "d3-format or similar" (`"$0,0.00"`, `"0.0%"`). Rather
 * than pull in d3-format for a handful of patterns, this reads the shape of
 * the string — currency prefix, percent suffix, thousands separator, decimal
 * places — and drives `Intl.NumberFormat`, which is already loaded and
 * locale-aware. An unrecognized format returns `undefined`, so the caller
 * keeps its own default formatting rather than rendering something wrong.
 */
export function formatterFor(format: string | undefined): ((value: any) => string) | undefined {
  if (!format) return undefined;
  const isPercent = format.includes('%');
  const currencyMatch = /^([$£€¥₹])/.exec(format);
  const grouped = format.includes(',');
  const decimals = /\.(0+)/.exec(format)?.[1].length ?? 0;
  const CURRENCY_BY_SYMBOL: Record<string, string> = {
    $: 'USD', '£': 'GBP', '€': 'EUR', '¥': 'CNY', '₹': 'INR',
  };
  // Nothing recognizable to act on — don't guess.
  if (!isPercent && !currencyMatch && !grouped && decimals === 0) return undefined;

  const opts: Intl.NumberFormatOptions = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  };
  if (isPercent) opts.style = 'percent';
  else if (currencyMatch) {
    opts.style = 'currency';
    opts.currency = CURRENCY_BY_SYMBOL[currencyMatch[1]] ?? 'USD';
  }
  return (value: any) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return value == null ? '' : String(value);
    try {
      return new Intl.NumberFormat(undefined, opts).format(n);
    } catch {
      return String(n);
    }
  };
}

/**
 * Explicit tick positions for an axis that declares a `stepSize`, or
 * `undefined` to keep Recharts' automatic ticks.
 *
 * Recharts has no "every N units" prop — `tickCount` is a hint it may ignore
 * and `interval` is for categorical axes — so honoring `stepSize` means
 * handing it the tick array outright. The range comes from the axis's own
 * `min`/`max` where declared and from the plotted values otherwise, so a step
 * works with or without a pinned domain.
 *
 * `values` should be every number plotted on this axis. An empty range, a
 * non-finite one, or a step that would produce an absurd number of ticks
 * (>`MAX_TICKS`) yields `undefined` — a 10,000-tick axis is a wrong config,
 * and drawing it would hang the page rather than report the mistake.
 */
const MAX_TICKS = 200;

export function ticksFor(axis: NormalizedAxis | undefined, values: number[]): number[] | undefined {
  const step = axis?.stepSize;
  if (!step || step <= 0) return undefined;

  const finite = values.filter((v) => Number.isFinite(v));
  const dataMin = finite.length ? Math.min(...finite) : undefined;
  const dataMax = finite.length ? Math.max(...finite) : undefined;
  // A value axis conventionally starts at zero unless told otherwise, which is
  // also what Recharts' own auto domain does for bars/areas.
  const lo = axis.min ?? Math.min(0, dataMin ?? 0);
  const hi = axis.max ?? dataMax;
  if (hi === undefined || !Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return undefined;

  const start = Math.floor(lo / step) * step;
  // An explicit `max` pins the domain, so the last tick must not overshoot it
  // (Recharts would place a tick outside the plot). A data-derived max is not
  // pinned, so round UP to the next step — otherwise the topmost value sits
  // above the last gridline and the axis reads as truncated.
  const end = axis.max !== undefined ? axis.max : Math.ceil(hi / step) * step;
  // `(end - start) / step` is exact in decimal but not in binary: 0.5 / 0.1 is
  // 5.000000000000001 one way and 4.999999999999999 the other, and a bare
  // floor() drops a whole tick in the second case.
  const count = Math.floor((end - start) / step + 1e-9) + 1;
  if (count < 1 || count > MAX_TICKS) return undefined;

  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    // Re-derive from the index rather than accumulating, so a fractional step
    // (0.1) does not drift into 0.30000000000000004 territory across the axis.
    out.push(Number((start + i * step).toPrecision(12)));
  }
  // Make sure an explicit max is actually reachable as a tick.
  if (axis.max !== undefined && out[out.length - 1] < axis.max) out.push(axis.max);
  return out;
}

/**
 * Recharts `domain` for an axis, or `undefined` to keep the auto domain.
 * A half-open range (only `min`, only `max`) pins that end and leaves the
 * other automatic.
 */
export function domainFor(axis: NormalizedAxis | undefined): [any, any] | undefined {
  if (!axis) return undefined;
  const { min, max } = axis;
  if (min === undefined && max === undefined) return undefined;
  return [min ?? 'auto', max ?? 'auto'];
}
