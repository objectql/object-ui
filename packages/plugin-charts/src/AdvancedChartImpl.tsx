/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  ComposedChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Scatter,
  ScatterChart,
  ZAxis,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Funnel,
  FunnelChart,
  LabelList,
  Treemap,
  Sankey,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Brush,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartContainerConfig
} from './ChartContainerImpl';
import { mapScatterClick, mapTreemapClick, mapSankeyClick } from './chartDrillEvents';
import { formatterFor, domainFor, ticksFor, RENDERABLE, SINGLE_VALUE_CHART_TYPES, TABULAR_CHART_TYPES, effectiveChartFamily, comboBaseFamily, type NormalizedAxis, type NormalizedSeries } from './normalizeChartSchema';
import { buildCategoryRank, chartRowBucketId, type ChartSegmentClickEvent } from '@object-ui/core';

// Default color fallback for chart series
const DEFAULT_CHART_COLOR = 'hsl(var(--primary))';

// Simple color map for Tailwind names (Mock - ideal would be computed styles)
const TW_COLORS: Record<string, string> = {
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
};

const resolveColor = (color: string) => TW_COLORS[color] || color;

/**
 * Default visual treatment for a `variant: 'comparison'` series. Returns
 * overrides per chart family so the comparison overlay reads as muted
 * (dashed line, lower fill opacity) while still being color-matched to
 * the primary series. Series-level `opacity` / `dashArray` win over defaults.
 */
const comparisonStyle = (s: any, kind: 'line' | 'area' | 'bar' | 'scatter') => {
  if (s?.variant !== 'comparison') return null;
  const strokeOpacity = typeof s.opacity === 'number' ? s.opacity : (kind === 'line' || kind === 'scatter' ? 0.5 : 0.6);
  const fillOpacity = typeof s.opacity === 'number' ? s.opacity : (kind === 'bar' ? 0.4 : kind === 'area' ? 0.2 : 0.5);
  const strokeDasharray = s.dashArray ?? (kind === 'line' || kind === 'area' ? '4 4' : undefined);
  return { strokeOpacity, fillOpacity, strokeDasharray };
};

/**
 * Which series did a CARTESIAN click land on? (objectui#4672)
 *
 * recharts 3 answers with `activeDataKey` on the chart-level click payload —
 * but only when the interaction was dispatched by a graphical ITEM, which is
 * the per-series cursor (`Tooltip shared={false}`). Under the SHARED (axis)
 * cursor these charts render, the click is an AXIS interaction, and recharts
 * dispatches those with `activeDataKey: undefined` hard-coded
 * (`recharts/lib/state/mouseEventsMiddleware.js`) — the cursor spans every
 * series at that tick, so the payload names no single one. Measured against
 * the installed recharts 3.10.1 for bar, line and area, clicking a mark and
 * empty plot area alike: the key is absent in every shared-cursor case.
 *
 * So take the payload's answer when it has one; failing that, the only click
 * with an unambiguous answer is on a chart plotting exactly ONE series, where
 * the clicked column can belong to nothing else. A multi-series chart under
 * the shared cursor is left UNRESOLVED rather than guessed: naming a series
 * the user did not click drills to the wrong records, which is worse than the
 * dead click. Resolving that half needs a different mechanism (an item-level
 * handler, which changes what a cartesian drill means) — it is the open half
 * of objectui#4672, deliberately not answered here.
 */
const resolveClickedSeriesKey = (
  activeDataKey: unknown,
  plotted: NormalizedSeries[],
): string | undefined => {
  if (typeof activeDataKey === 'string' || typeof activeDataKey === 'number') {
    const fromPayload = String(activeDataKey);
    if (fromPayload !== '') return fromPayload;
  }
  if (plotted.length === 1) {
    const only = plotted[0]?.dataKey;
    if (only != null && String(only) !== '') return String(only);
  }
  return undefined;
};

/**
 * The DOM event behind a React synthetic one — the IDENTITY of a single user
 * gesture (objectui#4672).
 *
 * Load-bearing rather than incidental: a click on a mark reaches the item-level
 * handler and the chart-level handler as two separate callbacks, and the only
 * thing that says they are ONE click is that both were handed the same
 * `nativeEvent` object. Measured on recharts 3.10.1 for bar, line and area
 * alike: identical object, item first, chart second. Matching on that object
 * rather than on a flag-and-timeout means a stale record can never be adopted
 * by a later click — a different gesture is a different object, always.
 */
const gestureIdOf = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'nativeEvent' in value) {
    return (value as { nativeEvent: unknown }).nativeEvent;
  }
  return undefined;
};

/**
 * The gesture identity out of an ITEM handler's arguments, whose shape differs
 * per mark family — measured, because recharts does not type two of the three.
 *
 *  - `Bar`:  `(item: BarRectangleItem, index: number, event)` — three args, and
 *    the item carries the row and the value.
 *  - `Line` / `Area`: `(curveProps, event)` — TWO args, and the first is the
 *    rendered curve's props, not a datum. A line/area mark click therefore
 *    knows WHICH SERIES it is (this component rendered it) and nothing about
 *    which category, which is exactly why the series is recorded here and the
 *    event is still composed by the chart-level handler, which does know.
 *
 * Scanning from the end takes the event in both shapes without branching on the
 * mark family, and returns `undefined` for any shape carrying no event at all —
 * an argument list this code has never seen cannot be mistaken for a gesture.
 */
const gestureIdOfArgs = (args: unknown[]): unknown => {
  for (let i = args.length - 1; i >= 0; i -= 1) {
    const id = gestureIdOf(args[i]);
    if (id !== undefined) return id;
  }
  return undefined;
};

/**
 * The DISPLAY LABEL of a plotted series, given the key a click resolved to
 * (objectui#4682).
 *
 * A series key is a `dataKey` — what the renderer binds and what the drill
 * lookup resolves back to a group. Its label is what the legend paints. For
 * every ordinary group those are the same string, which is why reading the key
 * as a title has passed unnoticed; they part company exactly when a group keys
 * by its IDENTITY because its label cannot name it (objectui#4673's
 * `pivotSeriesBuckets`, over objectui#4508's collision) — and then the drawer
 * title reads `[null]` at a segment the user saw labelled `(None)`.
 *
 * Keys are unique within a chart's series (`buildChartSeries` assigns them
 * injectively; the measure branch keys by measure name), so this lookup is
 * unambiguous and both arms — the clicked mark and the axis fallback — resolve
 * their label through this one path.
 */
const seriesLabelForKey = (
  key: string | undefined,
  plotted: NormalizedSeries[],
): string | undefined => {
  if (key == null) return undefined;
  const found = plotted.find((s) => String(s.dataKey) === key);
  return typeof found?.label === 'string' ? found.label : undefined;
};

export interface AdvancedChartImplProps {
  /**
   * Chart family. `combo` is renderer-local and rarely needs to be passed:
   * series declaring different families derive it (`effectiveChartFamily`),
   * which is how `@objectstack/spec` expresses a combo chart.
   */
  chartType?: 'bar' | 'column' | 'horizontal-bar' | 'line' | 'area' | 'pie' | 'donut' | 'radar' | 'scatter' | 'funnel' | 'combo' | 'treemap' | 'sankey';
  data?: Array<Record<string, any>>;
  config?: ChartContainerConfig;
  xAxisKey?: string;
  /**
   * Plotted series, in the renderer's internal shape. Authors write the spec
   * `series: [{ name, stack, yAxis, … }]`; `normalizeChartSchema` translates.
   */
  series?: NormalizedSeries[];
  className?: string;
  /** Categorical/series colour palette. Overrides the theme's `--chart-1..n`
   *  defaults so a page/dashboard can brand its charts (data-screens). */
  colors?: string[];
  /**
   * Per-category colour map keyed by the category value OR its display label
   * (e.g. `{ green: '#10B981', Green: '#10B981' }`). When the chart's category
   * dimension is a select/lookup field, ObjectChart resolves the field's option
   * colours into this map so a "Red" health slice paints red instead of taking
   * the next positional palette slot. A category found here WINS over `colors`;
   * categories absent here fall back to the positional palette, then the theme.
   */
  categoryColors?: Record<string, string>;
  /**
   * Declared category order for ordered-sequence charts (funnel / pyramid),
   * keyed like {@link categoryColors} by the category VALUE or its display
   * LABEL, listed in domain order.
   *
   * A funnel's shape asserts a sequence, so without this the renderer can only
   * guess at one and sorts by value descending. That is right for a generic
   * "biggest first" funnel and wrong for a sales pipeline, where the stages
   * have a declared order (Qualification → Needs Analysis → Proposal →
   * Negotiation) that a healthy pipeline happens to narrow along — and an
   * unhealthy one does not. When supplied, this order wins; categories not
   * listed keep their incoming relative order after the listed ones.
   */
  categoryOrder?: string[];
  /**
   * Optional drill-down click handler. Fires when a chart segment is clicked
   * with `{ category, categoryId, series, value }`. Wired for
   * bar/horizontal-bar/line/area/pie/donut/funnel/scatter/treemap/sankey —
   * each has its own click handler attached to its mark(s) below — and for
   * `combo`, whose `Bar`/`Line`/`Area` marks are the same components the plain
   * cartesian branch renders and now emit the same event with the same
   * semantics (ruled on objectui#4692).
   *
   * `combo` differs from the plain cartesian branch in exactly ONE way, and
   * deliberately: **only its marks drill.** A click on the plot surface or an
   * axis stays silent there, where the plain branch would fall back to its
   * axis-level answer. A combo plots several measures on one plot, so a
   * surface click has no single series answer to give — the same reasoning
   * objectui#4672's ruling used for the pivoted case. The plain branch keeps
   * that fallback because its own marks share one measure, so its axis answer
   * is either unambiguous or explicitly named by recharts.
   *
   * That combo drills at all is what keeps its DERIVATION from costing an
   * interaction. The branch is reachable without authoring
   * `chartType: 'combo'`: `effectiveChartFamily` derives it whenever a series'
   * own family disagrees with the chart's own (see its doc comment), so giving
   * one series of a drillable chart a different `type` used to turn that
   * chart's drill off with nothing in the authored spec saying drill was
   * touched. It now changes the mark and nothing else.
   *
   * Radar is the one remaining no-op in L1 — its branch attaches no click
   * handler anywhere.
   */
  onChartClick?: (event: ChartSegmentClickEvent) => void;
  /**
   * Spec `ChartAxis` presentation for the category axis — `format` (tick
   * formatter), `title`, `showGridLines`. Its `field` already arrived as
   * {@link AdvancedChartImplProps.xAxisKey}. Resolved by
   * `normalizeChartSchema`, so the renderer never parses the author shape.
   */
  xAxis?: NormalizedAxis;
  /**
   * Spec `ChartConfig.yAxis` — one entry per value axis, in declaration order.
   * Index 0 is the primary axis; a second entry (or one with
   * `position: 'right'`) turns on the secondary axis that `series[].yAxis`
   * binds to. Carries `min`/`max` (domain), `format` (ticks), `logarithmic`
   * (scale) and `title`.
   */
  yAxes?: NormalizedAxis[];
  /** Spec `ChartConfig.showLegend`. Omitted → shown (the schema default). */
  showLegend?: boolean;
  /** Spec `ChartConfig.showDataLabels` — print each point's value on the mark. */
  showDataLabels?: boolean;
  /** Spec `ChartConfig.title` / `.subtitle`, rendered above the plot. */
  title?: string;
  subtitle?: string;
  /**
   * Spec `ChartConfig.description` — the accessibility description. A chart is
   * a picture to a screen reader; without this it announces as an unlabelled
   * graphic, so the container carries it as `role="img"` + `aria-label`.
   */
  description?: string;
  /** Spec `ChartConfig.height` — fixed plot height in pixels. */
  height?: number;
  /** Spec `ChartConfig.annotations` — reference lines / bands. */
  annotations?: Array<Record<string, any>>;
  /** Spec `ChartConfig.interaction` — `tooltips`, `brush`. */
  interaction?: Record<string, any>;
  /**
   * Disable Recharts' entrance animation when `false`. Animations drive the
   * reveal via `requestAnimationFrame`, which browsers throttle/pause in
   * hidden/background tabs — so a chart rendered off-screen (analytics export,
   * a report opened in an inactive tab, headless capture) can freeze at frame 0
   * and look empty (esp. pie/donut: sectors at angle 0 = no ring, legend only).
   * Reports pass `false` for a deterministic, instant, export-safe render.
   * Omitted/true preserves the animated default everywhere else (dashboards).
   */
  isAnimationActive?: boolean;
}

/**
 * Chart types that plot a CATEGORY axis keyed by `xAxisKey`, and are therefore
 * unreadable when no row carries that key (see the guard in the component).
 *
 * `scatter` is excluded on purpose: both of its axes are numeric measures, so a
 * missing `xAxisKey` there is a different question. `treemap` and `sankey` are
 * excluded because they read hierarchy/link fields, not a category axis — a
 * guard that fired on them would be a false alarm on a working chart.
 */
const CATEGORY_AXIS_CHART_TYPES: ReadonlySet<string> = new Set([
  'bar', 'horizontal-bar', 'line', 'area', 'pie', 'donut', 'radar', 'funnel', 'combo',
]);

/**
 * Bucket count at or below which a CATEGORICAL x axis draws EVERY label
 * (objectui#7247).
 *
 * On a band axis a tick is the bar's NAME, not a sample of a continuum: drop it
 * and the reader cannot recover it — there is nothing to interpolate between
 * neighbours, and a single-series bar chart has no legend to fall back on. On a
 * time axis the opposite holds (a reader reconstructs the skipped dates), which
 * is why `xAxisCommonProps`' thinning is right there and wrong here. Measured
 * in the dashboard shape — a 3-column grid in an ~800px console, so a widget
 * ≈200px wide: 3 bars drew 1 label, 5 bars drew 2, and the bars had no names.
 *
 * Where the bound comes from, so it is a derivation and not a taste:
 *
 *   plot width at the narrowest shipped widget
 *     = 200 (widget) − 48 (the `YAxis width` this file sets) − 5 − 5 (recharts'
 *       default left/right chart margin) = 142px
 *   rotated tick labels are PARALLEL lines, so two adjacent ones collide only
 *   once their PERPENDICULAR separation drops below one line box:
 *     separation = bandWidth · sin(35°) = 0.574 · (142 / buckets)
 *   a 12px line box ≈ 14px tall  ⇒  buckets ≤ 5.8
 *
 * At 5 buckets or fewer every label therefore fits at the narrowest width the
 * product ships, with nothing measured at runtime — which is what makes
 * `interval={0}` safe HERE though it was not safe as the blanket setting it
 * used to be (a hundreds-of-points series painted a dense black bar). Above the
 * bound nothing changes: recharts goes on thinning against its own measured
 * text widths, using the real rendered width rather than this worst case.
 */
const X_AXIS_ALL_LABELS_MAX_BUCKETS = 5;

/**
 * Longest rotated x-axis label kept before it is ellipsised, so a label the
 * bound above newly forces into view cannot overrun the 60px the axis reserves:
 * 12 chars ≈ 78px of text, × sin(35°) ≈ 45px of height, inside 60 − 10
 * (`tickMargin`). Deliberately scoped to that branch — charts above the bound
 * render their labels exactly as they did before.
 */
const ROTATED_X_LABEL_MAX_CHARS = 12;

/**
 * Treemap leaf cell — paints each leaf rect with its palette fill + label.
 * Hoisted to module scope so it is a stable component reference rather than one
 * re-created on every AdvancedChartImpl render (react-hooks/static-components).
 * It is purely props-driven: Recharts injects the cell geometry (x/y/width/
 * height) and datum (name/fill) as props, so no render-scope closure is needed.
 */
function TreemapCell(props: any) {
  const { x, y, width, height, name, fill } = props;
  if (width <= 0 || height <= 0) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="hsl(var(--background))" strokeWidth={2} />
      {width > 48 && height > 18 ? (
        <text x={x + 6} y={y + 18} fill="#fff" fontSize={12} className="pointer-events-none">{name}</text>
      ) : null}
    </g>
  );
}

/**
 * Renders the spec's `ChartConfig.title` / `.subtitle` above the plot.
 *
 * Both were previously accepted by the contract and drawn by nothing — `title`
 * only ever reached the drill-down drawer's heading. With neither set this
 * returns the chart untouched, so no existing caller gains a wrapper element.
 */
function ChartFrame({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  if (!title && !subtitle) return <>{children}</>;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-2 shrink-0">
        {title ? <div className="text-sm font-medium leading-tight text-foreground">{title}</div> : null}
        {subtitle ? <div className="text-xs leading-tight text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * `ChartFrame`'s mirror image: chrome BELOW the plot, for a chart that drew
 * something but did not draw all of it (objectui#7148).
 *
 * Same construction, and deliberately so, because the construction is the whole
 * difficulty. A footnote cannot simply be rendered as a SIBLING of
 * `ChartContainer`: measured in Chromium in the dashboard shape — a fixed,
 * clipping card whose chart carries `h-full` — the container takes the card's
 * full height and a following `<p>` lands at y=327 in a box that ends at y=316,
 * i.e. entirely outside the clip. A note invisible in dashboards is no note at
 * all, and dashboards are where these charts live.
 *
 * Nor can it be a plain wrapper `<div className={className}>` around the
 * container: the consumer's className is the chart's height contract and it has
 * to keep reaching the element Recharts measures (see `CHART_MIN_HEIGHT` in
 * `ChartContainerImpl` for the measurement of what happens when it does not —
 * a permanently zero box and an invisible chart, with no refusal and no empty
 * state).
 *
 * So the plot keeps its own `className` and gains a definite height through the
 * flex chain instead: `h-full` outer, `min-h-0 flex-1` around the plot,
 * `shrink-0` under it. With no footnote this returns the chart untouched, so no
 * existing caller gains a wrapper element — the same gate `ChartFrame` uses.
 */
function ChartFootnote({ note, children }: { note?: React.ReactNode; children: React.ReactNode }) {
  if (!note) return <>{children}</>;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      <div className="mt-1 shrink-0">{note}</div>
    </div>
  );
}

/**
 * How many rows a MAGNITUDE chart can actually give area to (objectui#7147).
 *
 * ## The third mechanism, and why neither landed answer reaches it
 *
 * Three distinct mechanisms on this surface produce ONE reader-facing symptom —
 * a tile that says nothing, or says something false, about rows it was handed:
 *
 *   - an early return that emits a bare `div`  — objectui#7140 / objectui#7146
 *   - a silent row DROP before the plot        — objectui#7148
 *   - DEGENERATE GEOMETRY, which is this one   — objectui#7147
 *
 * The rows here are never filtered. `data` reaches `<Pie>`, `<Funnel>` and
 * `<Treemap>` whole — the sankey arm's is the only row-dropping filter in this
 * file — and what happens instead is that a row whose measure is not above zero
 * is given no area. objectui#7148's count (`data.length - rows.length`) is
 * therefore exactly ZERO against these three families, so hoisting that
 * footnote here would render nothing at all while looking like coverage. Zero
 * area is not zero elements, and neither is a dropped row.
 *
 * ## The measurement that decided fix-over-decline, per family
 *
 * 56 tiles in real Chromium (`/opt/pw-browsers/chromium`) at `origin/main`
 * 40c4711d6 — six families x nine datasets — each tile screenshotted, MD5'd,
 * and pixel-diffed against a literally empty `div` of the same 520x240 box.
 * `measured-and-declined` was genuinely on the table for all three families,
 * as the card says, and survived for none of them:
 *
 *   - pie / donut, all-zero, all-null, all-negative: ZERO non-white pixels out
 *     of 124,800. Not blank-LOOKING — byte-identical to the empty div, while
 *     the DOM carried 31 descendants and a real `svg`.
 *   - pie / donut, `40` beside a `null`: a FULL circle in the first category's
 *     colour, 99.35% pixel-identical to a legitimately one-row dataset (diff
 *     0.654%, and that residue is the `paddingAngle` hairline, not
 *     information). The picture asserts "Alpha is 100%" of a dataset in which
 *     Beta was never measured at all.
 *   - funnel, `40` beside a `null`: 178 ink pixels — ZERO segments and ONE
 *     label, and the label is "Beta", the row with NO value. The row carrying
 *     40 draws nothing whatsoever.
 *   - funnel, all-negative: a large, healthy-looking two-band funnel whose mark
 *     area (220,320) EXCEEDS the all-positive control's (111,881).
 *   - treemap, `40` beside a `null`, `40` beside a `0`, and mixed-sign
 *     `40 / -25 / -12`: all three BYTE-IDENTICAL (diff 0.000%) to a genuinely
 *     one-row treemap — one full-bleed leaf labelled "Alpha". Four datasets,
 *     one image.
 *   - treemap, all-zero: one full-bleed leaf labelled "Beta" — the LAST
 *     category — asserting that one of two equal-zero categories is the entire
 *     composition.
 *
 * The controls are what make those zeros readable. On the same instrument an
 * all-zero BAR drew 5,128 ink pixels of axes and ticks — which is why bar is
 * deliberately NOT touched here: its reader can already tell. A two-row pie
 * differed from a one-row pie by 9.683% of its pixels and a two-row treemap
 * from a one-row treemap by 38.301%, so the instrument separates these datasets
 * easily whenever the renderer does.
 *
 * ## Why the predicate is `> 0`, and why the copy names it
 *
 * The reason `no-positive-flow`'s docstring gives. Five shapes reach here — a
 * genuine zero, a negative, `null`, an unparseable string, and a missing key —
 * and naming any ONE of them is a sentence that is false for the other four.
 * A strictly positive, finite measure is the single test all three families'
 * layouts effectively apply, so the copy names THAT.
 *
 * `Number.isFinite(v) && v > 0` rather than the sankey arm's `Number(...) || 0`
 * idiom: this predicate must also reject `Infinity`, which has no finite area
 * to occupy anywhere and which `|| 0` lets straight through.
 */
function countSizableRows(rows: unknown[], dataKey: string): { sizable: number; total: number } {
  let sizable = 0;
  for (const row of rows) {
    const v = Number((row as Record<string, unknown> | null | undefined)?.[dataKey]);
    if (Number.isFinite(v) && v > 0) sizable += 1;
  }
  return { sizable, total: rows.length };
}

/**
 * The refusal a magnitude chart renders when NO row can be sized.
 *
 * The same shell and the same shape of sentence as `no-positive-flow`, and
 * deliberately a DIFFERENT code: that one is the sankey arm's and answers rows
 * being DROPPED, this one answers geometry that collapses with every row still
 * present. Sharing a code would make the two indistinguishable to the pins that
 * exist to keep them apart.
 *
 * Callers gate it on `total > 0`, for the reason objectui#7146 gives: handed NO
 * rows, "no row's measure is above zero" is a sentence about rows that do not
 * exist. That is the empty-RESULT question (objectui#7130), answered upstream in
 * `ObjectChart` where the query outcome is known — so every no-rows tile is left
 * byte-for-byte as it was.
 */
function MagnitudeRefusal({ dataKey, className }: { dataKey: string; className?: string }) {
  return (
    <ChartRefusal code="no-positive-magnitude" className={className}>
      This chart has nothing to size: no row&apos;s{' '}
      <code className="font-mono">{dataKey}</code> is above zero.
    </ChartRefusal>
  );
}

/**
 * The note a magnitude chart carries when SOME rows can be sized and some cannot.
 *
 * Returns `null` when every row is sizable, and that is the gate which keeps
 * healthy charts byte-identical: `ChartFootnote` with no note renders its
 * children untouched, so no existing caller gains a wrapper element.
 *
 * ## Why it does NOT say "showing N of M rows"
 *
 * objectui#7148's sankey note can say that, because there the missing rows are
 * genuinely absent from the plot. Here they are not. A mixed-sign pie PAINTS a
 * sector for every row — measured: `40 / -25 / -12` drew 3 sectors — it just
 * paints them at a scale that means nothing, and a funnel handed the same rows
 * drew 3 trapezoids. "Showing 1 of 3" would be a false statement about what is
 * on the screen. What IS true of every one of them is that the chart sizes by
 * value and these rows carry no value it can size, so that is what the copy
 * says.
 *
 * `rows` is an unconditional plural because the note cannot render with fewer
 * than two: reaching it at all means at least one row was sized (otherwise the
 * refusal returned first) and at least one was not.
 *
 * No console warning, matching the two sankey answers and unlike the two guards
 * at the bottom of this file: those carry a diagnostic PAIR that does not fit on
 * screen, whereas this sentence already names the key, the test it failed, and
 * how many rows failed it.
 */
function unsizedRowsNote(sizable: number, total: number, dataKey: string): React.ReactNode {
  const unsized = total - sizable;
  if (unsized <= 0) return null;
  return (
    <p role="note" data-chart-note="unsized-rows" className="px-1 text-xs text-muted-foreground">
      {unsized} of {total} rows {unsized === 1 ? 'has' : 'have'} no{' '}
      <code className="font-mono">{dataKey}</code> above zero &mdash; this chart sizes by value, so{' '}
      {unsized === 1 ? 'that row is' : 'those rows are'} not drawn to scale.
    </p>
  );
}

/**
 * Whether a value can be PLACED on one of scatter's two numeric axes
 * (objectui#7171).
 *
 * ## Why this is NOT `countSizableRows` with a different name
 *
 * Pie, funnel and treemap size a mark BY its measure, so `> 0` is the whole
 * test there. Scatter plots POSITION: a negative or zero coordinate is
 * perfectly ordinary data — temperatures, profit deltas, a variance around a
 * mean — and mechanically reusing objectui#7147's predicate here would REFUSE
 * correct charts, which is worse than the silence this card was opened about.
 * Measured on the sweep below rather than argued: an all-negative scatter drew
 * 3 of 3 marks, an all-zero scatter drew 2 of 2, and a mixed-sign scatter drew
 * 3 of 3 — three datasets `no-positive-magnitude` would have blanked outright.
 *
 * ## Every clause here was forced by a measurement, not by `Number()`
 *
 * `Number(v)` alone gets three of these WRONG, in both directions, which is why
 * the two rejections below are spelled out and the acceptance is not:
 *
 *   - `null` — `Number(null) === 0`, which is finite, so `Number()` alone calls
 *     it plottable. Recharts draws NOTHING for it (measured: 0 of 2 marks, and
 *     the axis renders no scale at all). REJECTED here.
 *   - `''` — the mirror-image trap. It LOOKS like a null and reads like one,
 *     and `Number('') === 0`. Recharts DOES plot it, at zero (measured: 2 of 2
 *     marks, x ticks `0,1,2,3,4`). So it stays PLOTTABLE: rejecting it would
 *     blank a chart that draws, which is the failure mode this whole guard
 *     exists to avoid.
 *
 * `Number.isFinite` covers the rest as measured: `'10'` plots (2 of 2 marks),
 * `'n/a'` and `'Infinity'` and an absent key do not (0 of 2 each).
 *
 * ## The one shape this predicate deliberately does NOT reject, and why
 *
 * A BOOLEAN coordinate was rejected in the first draft of this function — the
 * browser sweep had measured an all-boolean x drawing 0 of 2 marks, so it
 * looked like a sibling of `null`. Pinning it turned that red: a boolean beside
 * a genuinely numeric row draws EVERY mark (measured: 3 of 3). Recharts needs
 * one real number to build the scale and then coerces the booleans onto it, so
 * whether a boolean places depends on the OTHER rows.
 *
 * Rejecting it is therefore the worse error of the two available. The all-
 * boolean tile would gain a correct refusal, but the mixed tile would gain a
 * footnote reading "2 of 3 rows ... are not drawn" while all three are on
 * screen — a sentence that is simply false about the picture, which is the
 * failure this whole family of answers exists to remove. Accepting it leaves
 * the all-boolean case exactly as silent as it is today: a narrow hole, not a
 * regression, and one whose real answer belongs upstream where a boolean column
 * bound to a numeric measure could be refused at authoring time.
 */
function isPlottableCoord(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  return Number.isFinite(Number(v));
}

/**
 * How many rows scatter can actually PLACE — a point needs BOTH coordinates
 * (objectui#7171).
 *
 * ## The fourth mechanism on this surface
 *
 * Four distinct mechanisms now produce one reader-facing symptom, a tile that
 * says nothing or says something false about the rows it was handed:
 *
 *   - an early return emitting a bare `div`  — objectui#7140 / objectui#7146
 *   - a silent row DROP before the plot      — objectui#7148
 *   - degenerate GEOMETRY, magnitude         — objectui#7147
 *   - an unplaceable POINT, position         — this one
 *
 * It is genuinely a fourth. objectui#7147's rows are never filtered and are
 * painted at a meaningless scale; scatter's unplaceable rows are simply ABSENT
 * from the picture — measured, a 3-row dataset with one plottable pair emitted
 * exactly ONE `path.recharts-symbols`. That difference is why this note can
 * honestly say the points are "not drawn" where objectui#7147's deliberately
 * cannot.
 *
 * ## The measurement that decided fix-over-decline
 *
 * 33 tiles in real Chromium (`/opt/pw-browsers/chromium`) at `origin/main`
 * 899730e0a, one page load each, screenshotted, MD5'd and pixel-diffed against
 * a literally empty `div` of the same 520x360 box — a box above the chart's own
 * `CHART_MIN_HEIGHT` floor of 280, without which no footnote is visible at all.
 * The whole reason this card exists is that objectui#7147's sweep read scatter
 * through a SINGLE-measure fixture, so its all-positive control drew zero marks
 * and none of its zeros carried information. This fixture binds both axes and
 * its control DREW: 3 of 3 marks, 245px of mark area. What it then found:
 *
 *   - rows whose x AND y are both unplaceable render BYTE-IDENTICALLY (diff
 *     0.000%) to a scatter handed NO ROWS AT ALL. The reader is shown the
 *     empty-result picture for a query that returned rows.
 *   - `null` x, absent x, `'n/a'` x, `'Infinity'` x, boolean x, and
 *     objectui#7147's own category-column fixture — SIX datasets, ONE image
 *     (`51957063d9c2`): an axis frame with a confident y scale and no marks.
 *     Five of those six are answered below; the boolean one deliberately is
 *     not, for the reason `isPlottableCoord` gives.
 *   - one plottable row among three is 99.75% pixel-identical to a genuinely
 *     one-row scatter (diff 0.250%), the same shape of collision that decided
 *     pie in objectui#7147. Two rows vanish and the picture says "one point".
 *
 * ## Measured and DECLINED, so it is not guarded here
 *
 *   - ZERO VARIANCE — three rows at the same coordinate. A2.3 expected axis
 *     domain collapse; there is none. Recharts pads the domain exactly as it
 *     does for one row (x ticks `0,3,6,9,12` in both), draws 3 symbols, and the
 *     tile is 99.98% identical to a one-row scatter because three coincident
 *     points ARE one dot. That is overplotting, a property of the form itself,
 *     and the picture is TRUE — so there is nothing here to refuse.
 *   - a CONSTANT x or a constant y with the other varying: both draw every
 *     mark, with full scales on both axes.
 */
function countPlottablePoints(
  rows: unknown[],
  xKey: string,
  yKey: string,
): { plottable: number; total: number } {
  let plottable = 0;
  for (const row of rows) {
    const r = row as Record<string, unknown> | null | undefined;
    if (isPlottableCoord(r?.[xKey]) && isPlottableCoord(r?.[yKey])) plottable += 1;
  }
  return { plottable, total: rows.length };
}

/**
 * The refusal scatter renders when NO row can be placed.
 *
 * Its OWN code, for the reason objectui#7147 gives about its own: sharing one
 * with the magnitude families would make the two indistinguishable to the pins
 * that exist to keep them apart, and they answer different questions — that one
 * is about area, this one about position.
 *
 * It names BOTH keys because a point needs both, and it names the PREDICATE
 * rather than a cause: five shapes reach here (a `null`, an absent key, an
 * unparseable string, `Infinity`, and a category column on a numeric axis) and
 * naming any one of them is a sentence false for the other four.
 *
 * The caller gates it on `total > 0` — handed no rows, "no row carries a
 * number" is a sentence about rows that do not exist. That is the empty-RESULT
 * question (objectui#7130), answered upstream in `ObjectChart`.
 *
 * No console warning, matching all three landed answers in this file.
 */
function PositionRefusal({
  xKey,
  yKey,
  className,
}: { xKey: string; yKey: string; className?: string }) {
  return (
    <ChartRefusal code="no-plottable-points" className={className}>
      This chart has nothing to place: no row carries a number for both{' '}
      <code className="font-mono">{xKey}</code> and{' '}
      <code className="font-mono">{yKey}</code>.
    </ChartRefusal>
  );
}

/**
 * The note scatter carries when SOME rows can be placed and some cannot.
 *
 * Returns `null` when every row is plottable, and that gate is what keeps
 * healthy charts byte-identical: `ChartFootnote` with no note renders its
 * children untouched, so no existing caller gains a wrapper element.
 *
 * ## Why this one CAN say the points are not drawn
 *
 * objectui#7147's note deliberately does not, because a mixed-sign pie PAINTS a
 * sector for every row and only scales them meaninglessly. Scatter is the other
 * case and it was measured: a 3-row dataset with one plottable pair emitted
 * exactly ONE `path.recharts-symbols`, and the resulting tile was 99.75%
 * pixel-identical to a genuinely one-row scatter. The rows really are absent
 * from the picture, so saying so is a true statement about what is on screen —
 * and the COUNT is the half a reader cannot recover from it.
 */
function unplottedPointsNote(
  plottable: number,
  total: number,
  xKey: string,
  yKey: string,
): React.ReactNode {
  const unplotted = total - plottable;
  if (unplotted <= 0) return null;
  return (
    <p role="note" data-chart-note="unplotted-points" className="px-1 text-xs text-muted-foreground">
      {unplotted} of {total} rows {unplotted === 1 ? 'has' : 'have'} no number for both{' '}
      <code className="font-mono">{xKey}</code> and{' '}
      <code className="font-mono">{yKey}</code> &mdash; this chart plots by position, so{' '}
      {unplotted === 1 ? 'that point is' : 'those points are'} not drawn.
    </p>
  );
}

/**
 * AdvancedChartImpl - The heavy implementation that imports Recharts with full features
 * This component is lazy-loaded to avoid including Recharts in the initial bundle
 */
function AdvancedChartImplInner({
  chartType: rawChartType = 'bar',
  data: rawData = [],
  config = {},
  xAxisKey = 'name',
  series = [],
  className = '',
  colors,
  categoryColors,
  categoryOrder,
  onChartClick,
  isAnimationActive,
  xAxis: xAxisSpec,
  yAxes,
  showLegend,
  showDataLabels,
  title,
  subtitle,
  description,
  height,
  annotations,
  interaction,
}: AdvancedChartImplProps) {
  // Normalize 'column' → 'bar' (Recharts BarChart is already vertical).
  // 'column' is the spec-level alias for vertical bars; 'horizontal-bar' stays as-is.
  const baseChartType = rawChartType === 'column' ? 'bar' : rawChartType;
  // A chart whose series declare more than one family IS a combo, whatever its
  // own family says — `ChartSeries.type` is how the spec expresses that, and
  // reading it only under an explicit `combo` drew the overridden series as the
  // base family instead (#2945). `comboSeriesBase` is what an un-annotated
  // series draws, and `undefined` marks an explicitly-authored combo.
  const chartType = effectiveChartFamily(baseChartType, series);
  const comboSeriesBase = comboBaseFamily(baseChartType);
  const data = Array.isArray(rawData) ? rawData : [];

  // Only emit the prop when explicitly disabled, so the default (animated)
  // behavior is byte-for-byte unchanged for every existing caller.
  const animProps = isAnimationActive === false ? { isAnimationActive: false as const } : {};
  // When the entrance animation is off there is no stuck-at-0 tween to heal, so
  // tell ChartContainer to skip its settle re-mount — avoids a needless 1-frame
  // reflow on the dashboard's first paint (#2756). Animated callers keep the
  // heal; this object is empty for them, leaving their markup unchanged.
  // Everything every ChartContainer call site needs, so a new container-level
  // spec prop lands on all eight chart families at once instead of one branch.
  const containerProps = {
    ...(isAnimationActive === false ? { disableSettleRemount: true as const } : {}),
    // An explicit height beats the container's default `h-[350px]` class
    // because an inline style wins over a utility class.
    ...(height ? { style: { height } } : {}),
    ...(description ? { role: 'img' as const, 'aria-label': description } : {}),
  };
  const [isMobile, setIsMobile] = React.useState(false);

  // Recharts' top-level onClick payload: { activeLabel, activeTooltipIndex, … }
  // — `MouseHandlerDataParam`, which carries an INDEX into this chart's `data`
  // and no row of its own. So the clicked bucket's row (and with it the
  // objectui#4508 identity) is read out of OUR OWN array rather than out of the
  // event: nothing in the payload can be stale or copied, because none of it
  // came from recharts.
  //
  // The measure VALUE is read the same way, off that row — for the same reason,
  // and because the payload has no value either. (recharts 2 carried both in an
  // `activePayload` array; recharts 3 dropped the field, so the objectui#4672
  // read of it was `undefined` on every click and every cartesian drill lost
  // its series and its value.)
  //
  // WHICH SERIES was clicked is the one thing the payload cannot always answer
  // — see `resolveClickedSeriesKey`, and the mark handler below it.
  //
  // ── The clicked mark (objectui#4672's ruled Option A) ──────────────────────
  // A chart-level cartesian click is an AXIS interaction, and recharts names no
  // series in one: several series sit under one shared cursor at a tick, so the
  // payload cannot say which of them the pointer was over. That left every
  // PIVOTED drill dead, because its lookup matches on the second dimension.
  //
  // The mark itself knows. This component renders the series, so a `Bar` /
  // `Line` / `Area` item handler closes over the very `dataKey` it was rendered
  // with — the answer is statically known, not inferred from tooltip state.
  //
  // Both handlers fire for one click (item first, chart second — measured), so
  // the item handler does NOT emit: it RECORDS its series, stamped with the
  // gesture, and the chart-level handler below emits the single event. That is
  // the double-fire answer and the additive property at once —
  //
  //  - exactly one `onChartClick` per gesture, because there is exactly one
  //    emit site, rather than a second event suppressed after the fact;
  //  - a click that lands on NO mark records nothing, so it falls through to
  //    the axis answer this handler already gave (category + identity, series
  //    when unambiguous) with not one byte changed. Nothing that resolved
  //    before stops resolving; a line's `dot={false}` stroke simply gains the
  //    exact series where the stroke itself is hit.
  //
  // It also has to be this way round for line and area, whose item handlers are
  // handed the curve's props and no datum: the mark knows its series and only
  // the chart-level payload knows the category. Each contributes what it has.
  const clickedMark = React.useRef<{ gesture: unknown; dataKey: string } | null>(null);

  const handleMarkClick = React.useCallback(
    (s: NormalizedSeries) => (...args: unknown[]) => {
      const gesture = gestureIdOfArgs(args);
      if (gesture === undefined) return;
      // Recorded EXACTLY as rendered, `''` included. The empty string is a real
      // second-dimension group as of objectui#4673 — it draws its own bar and
      // its key is its own label — and `''` is falsy, so any truthiness test on
      // the way out would send `series: undefined` and hand that bar's click to
      // whichever group an absent key happens to coerce to.
      clickedMark.current = { gesture, dataKey: String(s.dataKey) };
    },
    [],
  );

  const markClickProps = onChartClick
    ? (s: NormalizedSeries) => ({ onClick: handleMarkClick(s) })
    : () => ({});

  // Compose-and-emit for a chart-level cartesian click. TWO branches reach it,
  // and they differ in one rule only — `requireMark` (objectui#4692):
  //
  //  - the plain branch (bar / horizontal-bar / line / area) emits for EVERY
  //    click, falling back to the axis answer described above when the gesture
  //    landed on no mark;
  //  - `combo` emits ONLY for a gesture that landed on a mark. Its plot carries
  //    several measures, so a surface/axis click there has no single series to
  //    report and the fallback would have to invent one — the same reasoning
  //    objectui#4672's ruling gave the pivoted case.
  //
  // Sharing the composer rather than writing combo its own is the point: a
  // combo mark's click IS a cartesian mark's click (same components, same
  // recorded series identity), so there is one event shape and one emit site,
  // and the two branches disagree about reachability alone.
  const emitCartesianClick = React.useCallback((payload: any, event: any, requireMark: boolean) => {
    if (!onChartClick || !payload) return;
    // A click with no active tick (the plot margins, an axis label) reports a
    // NULL index, not an absent one — and `Number(null)` is 0, which would
    // resolve to bucket ZERO and drill the wrong bucket. Only a real index
    // selects a row.
    const rawIdx = payload.activeTooltipIndex ?? payload.activeIndex;
    const idx = rawIdx == null ? Number.NaN : Number(rawIdx);
    const row = Number.isInteger(idx) && idx >= 0 ? data[idx] : undefined;
    // The mark handler runs first and only for THIS gesture; anything left over
    // from a click that never reached here belongs to a different DOM event and
    // can never be adopted by this one.
    const mark = clickedMark.current;
    clickedMark.current = null;
    const gesture = gestureIdOf(event);
    const onMark = mark != null && gesture !== undefined && mark.gesture === gesture;
    // The record is cleared above whether or not it is used, so a combo's
    // silent surface click cannot leave a stale series behind for the next one.
    if (requireMark && !onMark) return;
    const clickedKey = onMark
      ? mark!.dataKey
      : resolveClickedSeriesKey(payload.activeDataKey, series);
    const cell = clickedKey != null && row ? (row as Record<string, any>)[clickedKey] : undefined;
    onChartClick({
      category: payload.activeLabel != null ? String(payload.activeLabel) : undefined,
      categoryId: chartRowBucketId(row),
      series: clickedKey,
      // The KEY stays the lookup's answer; the LABEL rides alongside it so the
      // drill title can read what the segment actually said (objectui#4682).
      seriesLabel: seriesLabelForKey(clickedKey, series),
      value: typeof cell === 'number' ? cell : undefined,
    });
  }, [onChartClick, data, series]);

  const handleCartesianClick = React.useCallback((payload: any, event?: any) => {
    emitCartesianClick(payload, event, false);
  }, [emitCartesianClick]);

  const handleComboClick = React.useCallback((payload: any, event?: any) => {
    emitCartesianClick(payload, event, true);
  }, [emitCartesianClick]);

  // A pie sector's `payload` is a SPREAD COPY of the data row (recharts builds
  // it as `{...entry, ...cellProps}`), which is precisely why the bucket
  // identity is an ordinary enumerable property — see `CHART_BUCKET_ID_KEY`.
  const handlePieClick = React.useCallback((entry: any) => {
    if (!onChartClick || !entry) return;
    const cat = entry.payload?.[xAxisKey];
    const dk = series[0]?.dataKey || 'value';
    onChartClick({
      category: cat != null ? String(cat) : undefined,
      categoryId: chartRowBucketId(entry.payload),
      series: dk,
      // Measured for objectui#4682: this path sends only the KEY, so a pie over
      // a pivot whose first group keys by identity titles its drawer with that
      // identity. The funnel path is untouched — it sends no series at all.
      seriesLabel: seriesLabelForKey(dk, series),
      value: typeof entry.payload?.[dk] === 'number' ? entry.payload[dk] : undefined,
    });
  }, [onChartClick, xAxisKey, series]);

  const cartesianClickProps = onChartClick ? { onClick: handleCartesianClick, style: { cursor: 'pointer' as const } } : {};
  // Combo carries NO chart-wide pointer cursor, unlike every other wired
  // family: on this plot only the marks answer a click, and a surface-wide
  // pointer would promise a drill the axis deliberately does not perform. The
  // affordance rides on the marks instead — see `comboMarkClickProps`.
  const comboClickProps = onChartClick ? { onClick: handleComboClick } : {};
  const comboMarkClickProps = onChartClick
    ? (s: NormalizedSeries) => ({ ...markClickProps(s), cursor: 'pointer' as const })
    : () => ({});
  const pieClickProps = onChartClick ? { onClick: handlePieClick, style: { cursor: 'pointer' as const } } : {};

  // Per-category colour: a select/lookup dimension's option colour (passed via
  // `categoryColors`, keyed by value OR label) wins per slice/bar; categories
  // with no option colour fall back to their positional palette slot. Used by
  // pie/donut and single-series categorical bars so semantic colours (health
  // green/red/yellow) survive even when a generic brand palette is also set.
  const colorForCategory = React.useCallback((rawKey: any, index: number, palette: string[]): string => {
    const mapped = categoryColors && categoryColors[rawKey == null ? '' : String(rawKey)];
    return mapped || palette[index % palette.length];
  }, [categoryColors]);

  // Scatter / treemap / sankey element clicks map to the same
  // { category, series, value } drill event via pure mappers (see
  // chartDrillEvents). Each returns null for non-drillable targets (e.g. a
  // sankey link or root node), in which case we don't fire.
  const handleScatterClick = React.useCallback((node: any) => {
    if (!onChartClick) return;
    const ev = mapScatterClick(node, xAxisKey, series);
    if (ev) onChartClick(ev);
  }, [onChartClick, xAxisKey, series]);

  const handleTreemapClick = React.useCallback((node: any) => {
    if (!onChartClick) return;
    const ev = mapTreemapClick(node, series);
    if (ev) onChartClick(ev);
  }, [onChartClick, series]);

  const handleSankeyClick = React.useCallback((payload: any) => {
    if (!onChartClick) return;
    const ev = mapSankeyClick(payload, series);
    if (ev) onChartClick(ev);
  }, [onChartClick, series]);

  const scatterClickProps = onChartClick ? { onClick: handleScatterClick, cursor: 'pointer' } : {};
  const treemapClickProps = onChartClick ? { onClick: handleTreemapClick, style: { cursor: 'pointer' as const } } : {};
  const sankeyClickProps = onChartClick ? { onClick: handleSankeyClick, style: { cursor: 'pointer' as const } } : {};

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const ChartComponent = {
    bar: BarChart,
    'horizontal-bar': BarChart,
    line: LineChart,
    area: AreaChart,
    pie: PieChart,
    donut: PieChart,
    radar: RadarChart,
    scatter: ScatterChart,
    funnel: FunnelChart as any,
    // combo/treemap/sankey return from their own branches above; mapped here
    // only so the index type stays exhaustive.
    combo: ComposedChart,
    treemap: BarChart,
    sankey: BarChart,
  }[chartType] || BarChart;

  // Format ISO date strings into compact "MMM D" / "MMM YYYY" labels for X-axis ticks.
  // Falls back to the raw value when not parseable as a date.
  const formatTick = React.useCallback((value: any): string => {
    if (value == null || value === '') return '';
    // A resolved display label for this exact category value — the same
    // `config[key]?.label` convention already used for series names (below)
    // and pie/donut legend entries. Wins over the raw value so an
    // analytics-response-shaped `config` (value → { label }) reaches the
    // axis too, not just series/legend text.
    const resolved = config?.[String(value)]?.label;
    if (resolved != null) return String(resolved);
    const str = typeof value === 'string' ? value : String(value);
    // Detect ISO 8601 date / datetime strings (YYYY-MM-DD or with time component)
    const isoLike = /^\d{4}-\d{2}-\d{2}/.test(str);
    if (isoLike) {
      const d = new Date(str);
      if (!Number.isNaN(d.getTime())) {
        // Choose granularity based on data span: <= 31 days → MMM D, otherwise MMM YYYY
        const span = data.length > 1
          ? Math.abs(new Date(String(data[data.length - 1][xAxisKey] ?? '')).getTime() -
                     new Date(String(data[0][xAxisKey] ?? '')).getTime())
          : 0;
        const days = span / (1000 * 60 * 60 * 24);
        try {
          if (days <= 62) {
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }
          return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        } catch {
          return d.toISOString().slice(0, 10);
        }
      }
    }
    if (isMobile && str.length > 8) return str.slice(0, 8) + '…';
    return str;
  }, [data, xAxisKey, isMobile, config]);

  // Memoize whether any X-axis label is long enough to warrant angle rotation
  const hasLongLabels = React.useMemo(
    () => data.some((d: any) => String(d[xAxisKey] || '').length > 5),
    [data, xAxisKey],
  );

  // objectui#7247 — see X_AXIS_ALL_LABELS_MAX_BUCKETS for why a short
  // categorical axis draws every label instead of thinning like a time axis.
  const labelEveryBucket = data.length > 0 && data.length <= X_AXIS_ALL_LABELS_MAX_BUCKETS;

  // Rotation is what BUYS the complete axis, so in the forced branch it applies
  // on mobile too: drawing every label without rotating is the horizontal
  // overlap the old thinning avoided. Above the bound the trigger is unchanged.
  const rotateXLabels = labelEveryBucket ? hasLongLabels : (!isMobile && hasLongLabels);

  // Helper function to get color palette. An explicit `colors` prop (set by the
  // page/dashboard) wins; otherwise fall back to the theme's --chart-1..5 vars.
  const getPalette = () => (Array.isArray(colors) && colors.length > 0 ? colors : [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
  ]);

  // Compact numeric formatter for Y-axis ticks (1,200,000 → 1.2M).
  // Keeps the axis readable when bar/area series have large values.
  const formatYTick = React.useCallback((value: any): string => {
    if (value == null || value === '') return '';
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return String(value);
    try {
      return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(num);
    } catch {
      return String(num);
    }
  }, []);

  // ── Spec ChartAxis presentation (objectui#2880 S2) ──────────────────────
  // The author's `format` wins over the compact default; `min`/`max` pin the
  // domain; `logarithmic` swaps the scale; `title` labels the axis. All three
  // arrive already parsed from `normalizeChartSchema`, so nothing here has to
  // know the author-facing shape.
  const primaryY: NormalizedAxis | undefined = yAxes?.[0];
  // A secondary axis exists when a second entry is declared, or the only entry
  // asks to sit on the right.
  const secondaryY: NormalizedAxis | undefined =
    yAxes && yAxes.length > 1
      ? yAxes[1]
      : primaryY?.position === 'right'
        ? primaryY
        : undefined;
  const hasDualAxis = !!yAxes && (yAxes.length > 1);

  const xTickFormatter = React.useMemo(
    () => formatterFor(xAxisSpec?.format) ?? formatTick,
    [xAxisSpec?.format, formatTick],
  );

  /**
   * The x-axis formatter, plus the ellipsis step objectui#7247's label policy
   * owes: once every bucket is drawn, a long rotated name would run past the
   * 60px the axis reserves and be clipped mid-word. A shortened name is still
   * a name; a clipped one reads as a different category.
   *
   * Kept separate from `xTickFormatter` on purpose — that one also formats the
   * horizontal-bar family's CATEGORY axis, which is the y axis, sizes its own
   * width from the longest label, and already draws all of them.
   */
  const xAxisTickFormatter = React.useMemo(() => {
    if (!labelEveryBucket || !rotateXLabels) return xTickFormatter;
    return (value: any): string => {
      const label = String(xTickFormatter(value) ?? '');
      return label.length > ROTATED_X_LABEL_MAX_CHARS
        ? `${label.slice(0, ROTATED_X_LABEL_MAX_CHARS - 1)}…`
        : label;
    };
  }, [labelEveryBucket, rotateXLabels, xTickFormatter]);
  const yTickFormatter = React.useMemo(
    () => formatterFor(primaryY?.format) ?? formatYTick,
    [primaryY?.format, formatYTick],
  );
  const y2TickFormatter = React.useMemo(
    () => formatterFor(secondaryY?.format) ?? formatYTick,
    [secondaryY?.format, formatYTick],
  );

  /**
   * Every number plotted on one side of a dual axis (or on the only axis) —
   * the range `stepSize` lays its ticks over.
   */
  const axisValues = React.useCallback((side: 'left' | 'right') => {
    const keys = series
      .filter((s: any) => (hasDualAxis ? (s.yAxis === 'right' ? 'right' : 'left') === side : side === 'left'))
      .map((s: any) => s.dataKey);
    const out: number[] = [];
    for (const row of data) {
      for (const k of keys) {
        const n = Number(row?.[k]);
        if (Number.isFinite(n)) out.push(n);
      }
    }
    return out;
  }, [data, series, hasDualAxis]);

  /** Recharts props derived from one spec y-axis (domain / scale / ticks / label). */
  const yAxisSpecProps = React.useCallback((axis: NormalizedAxis | undefined, side: 'left' | 'right' = 'left') => {
    if (!axis) return {};
    const domain = domainFor(axis);
    const ticks = ticksFor(axis, axisValues(side));
    return {
      ...(ticks ? { ticks } : {}),
      ...(domain ? { domain } : {}),
      // `allowDataOverflow` is what makes an explicit domain actually clip
      // rather than being silently widened to fit the data.
      ...(domain ? { allowDataOverflow: true } : {}),
      ...(axis.logarithmic ? { scale: 'log' as const, domain: domain ?? ([1, 'auto'] as any) } : {}),
      ...(axis.title ? { label: { value: axis.title, angle: -90, position: 'insideLeft' as const } } : {}),
    };
  }, [axisValues]);

  // `showGridLines` is per-axis in the spec; the renderer draws one grid, so
  // an explicit `false` on EITHER axis turns off that axis's lines.
  const showYGrid = primaryY?.showGridLines !== false;
  // The default grid draws horizontal lines only (`vertical={false}`), which is
  // the right default for a categorical x-axis; honour an explicit opt-in.
  const gridProps = {
    vertical: xAxisSpec?.showGridLines === true,
    horizontal: showYGrid,
  };

  // Legend is on unless the author turned it off (spec default `true`).
  const legendVisible = showLegend !== false;

  // ── Spec ChartConfig.annotations (objectui#2880 S3) ─────────────────────
  // `type: 'line'` → ReferenceLine at `value`; `type: 'region'` → ReferenceArea
  // spanning `value`..`endValue`. `axis` picks which axis the value belongs to.
  const annotationEls = React.useMemo(() => {
    if (!Array.isArray(annotations) || annotations.length === 0) return null;
    const DASH: Record<string, string | undefined> = { solid: undefined, dashed: '4 4', dotted: '1 4' };
    return annotations.map((a, i) => {
      const onX = a?.axis === 'x';
      const stroke = resolveColor(String(a?.color || 'hsl(var(--muted-foreground))'));
      const strokeDasharray = DASH[String(a?.style ?? 'dashed')];
      const text = typeof a?.label === 'string' ? a.label : undefined;
      const labelProp = text ? { label: { value: text, position: 'insideTopRight' as const, fill: stroke, fontSize: 11 } } : {};
      if (a?.type === 'region') {
        const range = onX ? { x1: a.value, x2: a.endValue } : { y1: a.value, y2: a.endValue };
        return (
          <ReferenceArea
            key={`ann-${i}`}
            {...range}
            {...(hasDualAxis && !onX ? { yAxisId: 'left' } : {})}
            fill={stroke}
            fillOpacity={0.12}
            stroke={stroke}
            strokeOpacity={0.35}
            {...labelProp}
          />
        );
      }
      return (
        <ReferenceLine
          key={`ann-${i}`}
          {...(onX ? { x: a?.value } : { y: a?.value })}
          {...(hasDualAxis && !onX ? { yAxisId: 'left' } : {})}
          stroke={stroke}
          strokeDasharray={strokeDasharray}
          {...labelProp}
        />
      );
    });
  }, [annotations, hasDualAxis]);

  // ── Spec ChartConfig.interaction (objectui#2880 S3) ─────────────────────
  // `tooltips: false` suppresses the hover card; `brush: true` adds the range
  // selector under the plot. `zoom` has no Recharts primitive behind it and is
  // deliberately not faked — see the note in ChartConfigSchema.
  const tooltipsEnabled = interaction?.tooltips !== false;
  const brushEnabled = interaction?.brush === true;
  const brushEl = brushEnabled
    ? <Brush dataKey={xAxisKey} height={24} travellerWidth={8} stroke="hsl(var(--muted-foreground))" />
    : null;

  /** `showDataLabels` prints each point's value on the mark itself. */
  const dataLabel = (formatter?: (v: any) => string) =>
    showDataLabels
      ? <LabelList position="top" className="fill-foreground" fontSize={11} {...(formatter ? { formatter } : {})} />
      : null;

  // Shared X-axis props for time/categorical axes, in two branches.
  //
  // Above X_AXIS_ALL_LABELS_MAX_BUCKETS, recharts' `minTickGap` thins ticks
  // that would otherwise overlap — `interval={0}` is NOT hard-coded there,
  // because forcing every label painted a dense black bar when the data spanned
  // hundreds of points. At or below the bound the reverse is true and thinning
  // is the bug (objectui#7247): the axis is short enough that every label is
  // provably drawable, and each one is a bar's only name.
  const xAxisCommonProps = React.useMemo(() => ({
    tickLine: false as const,
    tickMargin: 10,
    axisLine: false as const,
    // A short categorical axis names every bucket; everything above the bound
    // keeps the time-series thinning, which is what `minTickGap` is for.
    ...(labelEveryBucket
      ? { interval: 0 as const }
      : { interval: 'preserveStartEnd' as const, minTickGap: isMobile ? 32 : 48 }),
    tickFormatter: xAxisTickFormatter,
    ...(xAxisSpec?.title ? { label: { value: xAxisSpec.title, position: 'insideBottom' as const, offset: -4 } } : {}),
    ...(rotateXLabels && { angle: -35, textAnchor: 'end' as const, height: 60 }),
  }), [isMobile, labelEveryBucket, rotateXLabels, xAxisTickFormatter, xAxisSpec?.title]);

  // #2942 — the non-series spec families used to fall through the component
  // map's `|| BarChart` into a bar shell whose series marks all returned
  // null: grid, axes, tooltip and legend rendered with NO data marks,
  // indistinguishable from an empty dataset. Reachable because ChartRenderer
  // resolves `schema.chartType ?? spec.chartType` without going through
  // `normalizeChartSchema`'s RENDERABLE gate. Single-value families render
  // the measure as a number (the spec's own framing for them); tabular ones
  // say which component owns the rendering; unknown values are named instead
  // of guessed at.
  if (chartType && SINGLE_VALUE_CHART_TYPES.has(chartType)) {
    const dataKey = series[0]?.dataKey || 'value';
    const raw = data[0]?.[dataKey];
    const num = typeof raw === 'number' ? raw : Number(raw);
    const label = series[0]?.label ?? (config?.[dataKey] as { label?: unknown } | undefined)?.label ?? dataKey;
    return (
      <div className={className} data-testid="advanced-chart-single-value">
        <div className="flex flex-col gap-1 py-4">
          <span className="text-3xl font-semibold tabular-nums">
            {Number.isFinite(num) ? new Intl.NumberFormat().format(num) : String(raw ?? '—')}
          </span>
          <span className="text-xs text-muted-foreground">{String(label)}</span>
        </div>
      </div>
    );
  }
  if (chartType && TABULAR_CHART_TYPES.has(chartType)) {
    return (
      <div
        className={`rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground ${className ?? ''}`}
        data-testid="advanced-chart-tabular-notice"
        role="note"
      >
        Chart type &ldquo;{chartType}&rdquo; is tabular — render it with the data-table / pivot components; a chart block draws series charts.
      </div>
    );
  }
  if (chartType && !RENDERABLE.has(chartType)) {
    return (
      <div
        className={`rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground ${className ?? ''}`}
        data-testid="advanced-chart-unknown-type"
        role="note"
      >
        Chart type &ldquo;{chartType}&rdquo; is not a spec chart type — nothing was drawn.
      </div>
    );
  }

  // Pie and Donut charts
  if (chartType === 'pie' || chartType === 'donut') {
    const innerRadius = chartType === 'donut' ? '52%' : 0;
    const palette = getPalette();
    // objectui#7147 — see `countSizableRows`. A slice's angle is its share of
    // the positive total, so a row that is zero, negative, null or unparseable
    // is drawn as nothing at all while staying in `data`. Measured: all-zero,
    // all-null and all-negative pies each put ZERO non-white pixels on a
    // 520x240 tile, byte-identical to an empty div.
    const pieDataKey = series[0]?.dataKey || 'value';
    const pieSizable = countSizableRows(data, pieDataKey);
    if (pieSizable.total > 0 && pieSizable.sizable === 0) {
      return <MagnitudeRefusal dataKey={pieDataKey} className={className} />;
    }
    // Augment the chart config with one entry per category value so that
    // `ChartLegendContent` (which resolves item labels via `config[key]`)
    // can render the slice labels next to the color swatches. Without
    // this the legend showed colored dots with no text, because the
    // upstream config only contained entries for series dataKeys.
    const pieConfig: ChartContainerConfig = { ...(config as ChartContainerConfig) };
    data.forEach((entry, index) => {
      const rawKey = entry?.[xAxisKey];
      if (rawKey == null || rawKey === '') return;
      const key = String(rawKey);
      if (!pieConfig[key]) {
        pieConfig[key] = {
          label: key,
          color: colorForCategory(rawKey, index, palette),
        };
      }
    });
    const pieChart = (
      <ChartContainer config={pieConfig} className={className} {...containerProps}>
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey={pieDataKey}
            nameKey={xAxisKey || 'name'}
            innerRadius={innerRadius}
            strokeWidth={5}
            paddingAngle={2}
            outerRadius="85%"
            {...animProps}
            {...pieClickProps}
          >
             {data.map((entry, index) => {
                // Per-category option colour wins; otherwise the positional
                // palette slot (kept identical to the legend swatch above).
                const c = colorForCategory(entry?.[xAxisKey], index, palette);
                return <Cell key={`cell-${index}`} fill={resolveColor(c)} />;
             })}
          </Pie>
          {legendVisible ? (
            <ChartLegend
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: isMobile ? '11px' : '12px', paddingTop: '8px' }}
              content={<ChartLegendContent nameKey={xAxisKey} className="flex-wrap" />}
            />
          ) : null}
        </PieChart>
      </ChartContainer>
    );
    // A pie that drew SOME of its rows says how many it could not size. With
    // every row sizable the note is `null` and `ChartFootnote` returns the
    // container untouched, so healthy pies keep their exact DOM.
    return (
      <ChartFootnote note={unsizedRowsNote(pieSizable.sizable, pieSizable.total, pieDataKey)}>
        {pieChart}
      </ChartFootnote>
    );
  }

  // Funnel chart — uses recharts FunnelChart (single series only)
  if (chartType === 'funnel') {
    const dataKey = series[0]?.dataKey || 'value';
    const palette = getPalette();
    // objectui#7147 — see `countSizableRows`. Recharts derives each segment's
    // upper and lower width from ITS value and the NEXT one, so a single
    // unsizable row does not merely omit itself: measured, `40` beside a `null`
    // drew ZERO segments and one label reading "Beta" — the row with no value —
    // while the row carrying 40 drew nothing at all. All-negative is the mirror
    // image: a confident two-band funnel with MORE mark area than the
    // all-positive control.
    const funnelSizable = countSizableRows(data, dataKey);
    if (funnelSizable.total > 0 && funnelSizable.sizable === 0) {
      return <MagnitudeRefusal dataKey={dataKey} className={className} />;
    }
    const handleFunnelClick = onChartClick
      ? (entry: any) => {
          if (!entry) return;
          onChartClick({
            category: entry?.payload?.[xAxisKey] ?? entry?.[xAxisKey],
            categoryId: chartRowBucketId(entry?.payload) ?? chartRowBucketId(entry),
            value: entry?.payload?.[dataKey] ?? entry?.[dataKey],
          });
        }
      : undefined;
    const funnelClickProps = handleFunnelClick
      ? { onClick: handleFunnelClick, style: { cursor: 'pointer' as const } }
      : {};
    // Recharts <Funnel> draws segments in source order, so this decides the
    // sequence the funnel asserts.
    //
    // With a DECLARED order (framework#3588) — a stage picklist's own option
    // order, or an explicit `stageOrder` — that order wins: a sales funnel must
    // read Qualification → Needs Analysis → Proposal → Negotiation whether or
    // not each stage happens to hold more value than the next. Sorting such a
    // pipeline by value would manufacture a tidy narrowing shape and hide the
    // very anomaly (a bulge at Proposal) the chart exists to reveal. Categories
    // missing from the declared order keep their incoming relative order,
    // after the declared ones — never dropped.
    //
    // Without one, keep the long-standing default: descending by value, so a
    // generic funnel still narrows downward without authors pre-sorting.
    const categoryRank = buildCategoryRank(categoryOrder);
    const funnelData = categoryRank
      ? [...data].sort((a, b) => {
          const ar = categoryRank.get(String(a?.[xAxisKey] ?? '')) ?? Number.MAX_SAFE_INTEGER;
          const br = categoryRank.get(String(b?.[xAxisKey] ?? '')) ?? Number.MAX_SAFE_INTEGER;
          return ar - br;
        })
      : [...data].sort((a, b) => {
          const av = Number(a?.[dataKey] ?? 0);
          const bv = Number(b?.[dataKey] ?? 0);
          return bv - av;
        });
    const funnelChart = (
      <ChartContainer config={config} className={className} {...containerProps}>
        <FunnelChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Funnel
            dataKey={dataKey}
            data={funnelData}
            nameKey={xAxisKey}
            {...animProps}
            {...funnelClickProps}
          >
            <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey={xAxisKey} />
            {funnelData.map((_entry, idx) => (
              <Cell key={`funnel-cell-${idx}`} fill={resolveColor(palette[idx % palette.length])} />
            ))}
          </Funnel>
        </FunnelChart>
      </ChartContainer>
    );
    return (
      <ChartFootnote note={unsizedRowsNote(funnelSizable.sizable, funnelSizable.total, dataKey)}>
        {funnelChart}
      </ChartFootnote>
    );
  }

  // Treemap — composition by relative size. Recharts <Treemap> is itself the
  // chart root (no wrapping cartesian chart); a custom content paints each
  // leaf with a palette color + label.
  if (chartType === 'treemap') {
    const dataKey = series[0]?.dataKey || 'value';
    const palette = getPalette();
    // objectui#7147 — see `countSizableRows`. A treemap's leaf area IS its
    // value, so an unsizable row collapses to nothing and its neighbours expand
    // to fill the box. Measured: `40 / null`, `40 / 0` and `40 / -25 / -12` all
    // rendered ONE full-bleed leaf labelled "Alpha", byte-identical to each
    // other AND to a genuinely one-row treemap. All-zero rows paint one
    // full-bleed leaf labelled with the LAST category.
    const treemapSizable = countSizableRows(data, dataKey);
    if (treemapSizable.total > 0 && treemapSizable.sizable === 0) {
      return <MagnitudeRefusal dataKey={dataKey} className={className} />;
    }
    const tmData = data.map((row, idx) => ({
      name: String(row?.[xAxisKey] ?? ''),
      size: Number(row?.[dataKey]) || 0,
      fill: resolveColor(palette[idx % palette.length]),
    }));
    const treemapChart = (
      <ChartContainer config={config} className={className} {...containerProps}>
        <Treemap data={tmData} dataKey="size" nameKey="name" {...animProps} content={<TreemapCell />} {...treemapClickProps}>
          <Tooltip />
        </Treemap>
      </ChartContainer>
    );
    return (
      <ChartFootnote note={unsizedRowsNote(treemapSizable.sizable, treemapSizable.total, dataKey)}>
        {treemapChart}
      </ChartFootnote>
    );
  }

  // Sankey — flow from a single root node to each category, weighted by value.
  // (The dashboard aggregate yields one value per category; a real multi-stage
  // flow needs richer data, but this honestly renders the sankey family.)
  if (chartType === 'sankey') {
    const dataKey = series[0]?.dataKey || 'value';
    const rootName = series[0]?.label || dataKey;
    const rows = data.filter((r) => (Number(r?.[dataKey]) || 0) > 0);
    const nodes = [{ name: rootName }, ...rows.map((r) => ({ name: String(r?.[xAxisKey] ?? '') }))];
    const links = rows.map((r, i) => ({ source: 0, target: i + 1, value: Number(r?.[dataKey]) || 0 }));
    if (links.length === 0) {
      // Rows ARRIVED and the filter above kept none of them, so there is no
      // flow to draw. This used to return a bare `<div>` — objectui#7140.
      //
      // Measured in Chromium before it was changed, against a populated
      // control that drew 1 `<svg>` / 7 `<path>`: the all-zero, all-null,
      // all-negative and unparseable-measure tiles each rendered ONE element
      // and nothing else (`descendantCount: 1`, `svg: 0`, `textContent: ''`),
      // and their screenshots were byte-identical to each other. No marks, no
      // text, no `role` — the one path in this file that put nothing at all on
      // the page, and pixel-identical to a render that crashed. A reader could
      // not tell a genuinely all-zero flow from a broken widget, which is the
      // distinction every other refusal here exists to make.
      //
      // Gated on rows being present for the same reason `hasNoCategoryKey` and
      // `hasNoPlottableSeries` are: handed NO rows the sentence below would be
      // false — there is no row whose measure could be anything. That is the
      // empty-RESULT question (objectui#7130), answered upstream in
      // `ObjectChart` where the query outcome is known, so this arm leaves the
      // no-rows case byte-for-byte as it was.
      //
      // ONE code and ONE sentence, for the reason `hasNoPlottableSeries`'
      // docstring gives: three causes reach here — a genuinely all-zero flow,
      // values a flow cannot represent because they are negative, and
      // unparseable measures that `Number(…) || 0` folds to zero — and naming
      // any ONE of them is a sentence that is false for the other two. The
      // predicate the filter actually applies is true for all three, so the
      // copy names THAT. No console warning either, unlike the two refusals
      // below: those carry a diagnostic pair that does not fit on screen,
      // whereas this message already names the key and the exact test it
      // failed.
      if (data.length === 0) {
        return <div className={className} />;
      }
      return (
        <ChartRefusal code="no-positive-flow" className={className}>
          This chart has no flow to draw: no row&apos;s{' '}
          <code className="font-mono">{dataKey}</code> is above zero.
        </ChartRefusal>
      );
    }
    // A PARTIAL flow SAYS it is partial — objectui#7148, the branch next door
    // to the refusal above.
    //
    // The filter is unconditional, so a dataset where only SOME rows survive it
    // draws a normal, healthy, confident sankey of a fraction of itself, and
    // nothing in the output carried that fact. Measured in Chromium at
    // origin/main fd11e1644 across 27 tiles: the card's own dataset
    // (`New business 40 / Refunds -25 / Chargebacks -12`) rendered `svg: 1`,
    // `path: 3`, 18 descendants, no `role`, no text, and — against a live
    // console control that did fire on the same instrument — ZERO console
    // output. Its screenshot hashed `13237e6e19a7072a`, BYTE-IDENTICAL to a
    // genuinely one-row dataset `[{ New business: 40 }]` and to three other
    // thinned shapes (one positive among zeros, positive + nulls, positive +
    // unparseable). Six datasets, one image. A reader had no bit of information
    // distinguishing a complete flow from a third of one, and nobody re-reads a
    // dataset that renders fine.
    //
    // ## Why a note beside the chart, and not a refusal
    //
    // Not a style preference — a refusal is unavailable here. objectui#7146
    // pins "one positive row among zeros still draws", and that fixture
    // (`0 / 7 / 0`) is ITSELF a thinned dataset: it lands in this branch, and
    // hashes identical to the mixed-sign tile above. Refusing on a thinned flow
    // would blank the chart that pin requires drawn.
    //
    // The drop is also not the defect. A flow has no negative width, so
    // discarding those rows is the only thing this arm CAN do with them. What
    // was missing was saying so — which is the whole change: the plot is the
    // element this arm already returned, unchanged, with one line of prose
    // under it.
    //
    // ## Why the copy names the PREDICATE and a COUNT, not a cause
    //
    // The reason the refusal above gives, and this branch is where that family
    // actually lives: `Number(…) || 0` folds negatives, zeros, `null`,
    // unparseable strings and a missing key into ONE discard, and all five were
    // measured reaching here beside a survivor. Naming any one of them is a
    // sentence that is false for the other four, so the copy names the
    // predicate the filter actually applies, which is true of all of them.
    //
    // The COUNT is the half a reader cannot recover from the picture. "Some
    // rows were dropped" still leaves a thinned flow indistinguishable from a
    // complete one; `1 of 3` is the bit that was missing.
    //
    // No console warning, matching the refusal above and unlike the two guards
    // at the bottom of this file: those carry a diagnostic PAIR that does not
    // fit on screen, whereas this sentence already names the key, the test it
    // failed, and how many rows failed it.
    const omittedRowCount = data.length - rows.length;
    return (
      <ChartFootnote
        note={
          omittedRowCount > 0 ? (
            <p
              role="note"
              data-chart-note="omitted-rows"
              className="px-1 text-xs text-muted-foreground"
            >
              Showing {rows.length} of {data.length} rows &mdash; {omittedRowCount}{' '}
              {omittedRowCount === 1 ? 'row has' : 'rows have'} no{' '}
              <code className="font-mono">{dataKey}</code> above zero, which a flow cannot
              draw.
            </p>
          ) : null
        }
      >
        <ChartContainer config={config} className={className} {...containerProps}>
          <Sankey
            data={{ nodes, links }}
            nodePadding={24}
            link={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.25 }}
            node={{ fill: 'hsl(var(--chart-1))' } as any}
            {...sankeyClickProps}
          >
            <Tooltip />
          </Sankey>
        </ChartContainer>
      </ChartFootnote>
    );
  }

  // Radar chart
  if (chartType === 'radar') {
    return (
      <ChartContainer config={config} className={className} {...containerProps}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey={xAxisKey} />
          <PolarRadiusAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend
            content={<ChartLegendContent />}
            {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
          />
          {series.map((s: any) => {
            const color = resolveColor(config[s.dataKey]?.color || DEFAULT_CHART_COLOR);
            return (
              <Radar
                key={s.dataKey}
                dataKey={s.dataKey}
                stroke={color}
                fill={color}
                fillOpacity={0.6}
                {...animProps}
              />
            );
          })}
        </RadarChart>
      </ChartContainer>
    );
  }

  // Scatter chart
  if (chartType === 'scatter') {
    // objectui#7171 — see `countPlottablePoints`. Scatter is the file's only
    // two-measure POSITIONAL family: `xAxisKey` feeds a `type="number"` XAxis
    // and `series[0]` a `type="number"` YAxis, so a point exists only if BOTH
    // are numbers. The y key is bound once here and handed to both the
    // predicate and the axis below, so the two cannot drift apart.
    const scatterYKey = series[0]?.dataKey || 'value';
    const points = countPlottablePoints(data, xAxisKey, scatterYKey);
    if (points.total > 0 && points.plottable === 0) {
      return <PositionRefusal xKey={xAxisKey} yKey={scatterYKey} className={className} />;
    }
    return (
      <ChartFootnote
        note={unplottedPointsNote(points.plottable, points.total, xAxisKey, scatterYKey)}
      >
      <ChartContainer config={config} className={className} {...containerProps}>
        <ScatterChart>
          <CartesianGrid vertical={false} />
          <XAxis 
            type="number" 
            dataKey={xAxisKey}
            name={String(config[xAxisKey]?.label || xAxisKey)}
            tickLine={false}
            axisLine={false}
            minTickGap={isMobile ? 32 : 48}
          />
          <YAxis 
            type="number"
            dataKey={scatterYKey}
            name={String(config[series[0]?.dataKey]?.label || series[0]?.dataKey)}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYTick}
            width={48}
          />
          <ZAxis type="number" range={[60, 400]} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {/* `nameKey` is REQUIRED here, for a reason unique to scatter
              (objectui#7248). `ChartLegendContent` resolves a label as
              `config[nameKey || item.dataKey || 'value']`, and a `<Scatter>`
              carries NO `dataKey` — scatter's keys live on the two axes, not on
              the mark. So the key collapsed to the literal `'value'`, missed a
              config keyed by measure name, and the entry rendered its colour
              swatch with NO TEXT beside it.

              What that looks like on screen is the whole card: an 8x8 dot in
              `--chart-1` — the SAME colour as the marks — sitting under the
              x-axis, which reads as a seventh data point plotted outside the
              plot area. Measured on the showcase Chart Gallery in real
              Chromium: swatch at cy 341 against a plot area ending at cy 295,
              on a y scale of 4.835 px per unit, i.e. y = -9.5 — which is
              exactly the "x≈40, y≈-10" the card reported as a stray point.

              The y DOMAIN was never the defect and is deliberately not touched:
              the same run measured all six marks inside the plot area, and
              mixed-sign and all-negative fixtures draw every mark inside too,
              because recharts extends the domain to cover negatives. */}
          <ChartLegend
            content={<ChartLegendContent nameKey={scatterYKey} />}
            {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
          />
          {series.map((s: any, index: number) => {
            const palette = getPalette();
            const color = resolveColor(config[s.dataKey]?.color || palette[index % palette.length]);
            const cmp = comparisonStyle(s, 'scatter');
            return (
              <Scatter
                key={s.dataKey}
                name={config[s.dataKey]?.label || s.dataKey}
                data={data}
                fill={color}
                fillOpacity={cmp?.fillOpacity}
                {...animProps}
                {...scatterClickProps}
              />
            );
          })}
        </ScatterChart>
      </ChartContainer>
      </ChartFootnote>
    );
  }

  // Combo chart (mixed families on one plot). Reached either by an explicit
  // `chartType: 'combo'` or by series that declare different families — see
  // `effectiveChartFamily`.
  if (chartType === 'combo') {
    return (
      <ChartFrame title={title} subtitle={subtitle}>
      <ChartContainer config={config} className={className} {...containerProps}>
        {/* `ComposedChart`, not `BarChart`, is the Recharts container built to
            host mixed marks. Under `BarChart` an `<Area>` child renders nothing
            at all, so the `seriesType === 'area'` arm below was unreachable —
            an authored combo with an `area` series drew a blank series. */}
        {/* `comboClickProps`, not `cartesianClickProps`: the chart-level
            handler here emits ONLY for a gesture a mark recorded, so an axis /
            surface click stays silent (objectui#4692's ruling). The emit still
            happens at chart level because that is the only place the CATEGORY
            is known — a line/area item handler is handed the curve's props and
            no datum. */}
        <ComposedChart data={data} {...comboClickProps}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xAxisKey} {...xAxisCommonProps} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={yTickFormatter} width={48} {...yAxisSpecProps(primaryY)} />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={y2TickFormatter} width={48} {...yAxisSpecProps(secondaryY, 'right')} />
          {tooltipsEnabled ? <ChartTooltip content={<ChartTooltipContent />} /> : null}
          {legendVisible ? (
            <ChartLegend
              content={<ChartLegendContent />}
              {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
            />
          ) : null}
          {annotationEls}
          {brushEl}
          {series.map((s: any, index: number) => {
            const color = resolveColor(config[s.dataKey]?.color || DEFAULT_CHART_COLOR);
            // A derived combo knows what an un-annotated series is: the chart's
            // own family. Only an explicitly-authored `combo` has no base, and
            // there the index heuristic stands so those charts are unchanged.
            const seriesType = s.chartType || comboSeriesBase || (index === 0 ? 'bar' : 'line');
            // An explicit spec `series[].yAxis` wins over any default. Where
            // there is no `yAxis`, a DERIVED combo follows the spec, which
            // defaults `ChartSeries.yAxis` to 'left' — so widening a bar chart
            // into a combo changes the series' mark and nothing else. The
            // bar→left / line→right guess is kept only for an authored `combo`,
            // where historically it was the sole way to reach a second axis.
            const yAxisId = s.yAxis === 'right' || s.yAxis === 'left'
              ? s.yAxis
              : comboSeriesBase
                ? 'left'
                : (seriesType === 'bar' ? 'left' : 'right');
            const cmp = comparisonStyle(s, seriesType as any);
            const stackProps = s.stack ? { stackId: String(s.stack) } : {};
            const valueFormatter = formatterFor((yAxisId === 'right' ? secondaryY : primaryY)?.format);

            if (seriesType === 'line') {
              return (
                <Line key={s.dataKey} yAxisId={yAxisId} type="monotone" dataKey={s.dataKey} stroke={color} strokeWidth={2} dot={false} strokeOpacity={cmp?.strokeOpacity} strokeDasharray={cmp?.strokeDasharray} {...animProps} {...comboMarkClickProps(s)}>
                  {dataLabel(valueFormatter)}
                </Line>
              );
            }
            if (seriesType === 'area') {
              return (
                <Area key={s.dataKey} yAxisId={yAxisId} type="monotone" dataKey={s.dataKey} fill={color} stroke={color} fillOpacity={cmp?.fillOpacity ?? 0.4} strokeOpacity={cmp?.strokeOpacity} strokeDasharray={cmp?.strokeDasharray} {...stackProps} {...animProps} {...comboMarkClickProps(s)}>
                  {dataLabel(valueFormatter)}
                </Area>
              );
            }
            return (
              <Bar key={s.dataKey} yAxisId={yAxisId} dataKey={s.dataKey} fill={color} radius={4} fillOpacity={cmp?.fillOpacity} {...stackProps} {...animProps} {...comboMarkClickProps(s)}>
                {dataLabel(valueFormatter)}
              </Bar>
            );
          })}
        </ComposedChart>
      </ChartContainer>
      </ChartFrame>
    );
  }

  // Horizontal bar — swap X/Y axis types and orientation.
  const isHorizontal = chartType === 'horizontal-bar';

  // Build vertical fill gradients (bar + area) for every colour in play, so
  // fills read as a polished ramp instead of flat blocks (大屏 look). Inline
  // `style` on the stops makes the `--chart-*` CSS vars resolve.
  const _gpal = getPalette();
  // Per-category bars fill from a gradient keyed by the resolved colour, so any
  // semantic option colour (categoryColors) needs its own gradient def too.
  const _catColors = categoryColors ? Object.values(categoryColors).map((c) => resolveColor(String(c))) : [];
  const gradColors = Array.from(new Set<string>([
    ..._gpal,
    ..._catColors,
    ...series.map((s: any, i: number) => resolveColor(((config[s.dataKey] as any)?.color) || _gpal[i % _gpal.length] || DEFAULT_CHART_COLOR)),
  ]));
  const gslug = (c: string) => 'g' + c.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <ChartFrame title={title} subtitle={subtitle}>
    <ChartContainer config={config} className={className} {...containerProps}>
      <ChartComponent data={data} layout={isHorizontal ? 'vertical' : 'horizontal'} {...cartesianClickProps}>
        <defs>
          {gradColors.map((c) => (
            <React.Fragment key={gslug(c)}>
              <linearGradient id={`bg-${gslug(c)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: c }} stopOpacity={0.95} />
                <stop offset="100%" style={{ stopColor: c }} stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id={`ag-${gslug(c)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: c }} stopOpacity={0.5} />
                <stop offset="95%" style={{ stopColor: c }} stopOpacity={0.05} />
              </linearGradient>
            </React.Fragment>
          ))}
        </defs>
        <CartesianGrid {...gridProps} />
        {isHorizontal ? (
          <>
            {/* Horizontal bars swap the axis roles: the VALUE axis is x, so the
                spec y-axis config (domain/format/scale) applies to it. */}
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={yTickFormatter} {...yAxisSpecProps(primaryY)} />
            <YAxis
              type="category"
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              width={Math.min(140, Math.max(60, Math.max(...data.map(d => String(d[xAxisKey] ?? '').length)) * 7))}
              tickFormatter={xTickFormatter}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xAxisKey} {...xAxisCommonProps} />
            <YAxis
              {...(hasDualAxis ? { yAxisId: 'left' as const } : {})}
              tickLine={false}
              axisLine={false}
              tickFormatter={yTickFormatter}
              width={48}
              {...yAxisSpecProps(primaryY)}
            />
            {hasDualAxis ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={y2TickFormatter}
                width={48}
                {...yAxisSpecProps(secondaryY, 'right')}
              />
            ) : null}
          </>
        )}
        {tooltipsEnabled ? <ChartTooltip content={<ChartTooltipContent />} /> : null}
        {legendVisible ? (
          <ChartLegend
            content={<ChartLegendContent />}
            {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
          />
        ) : null}
        {annotationEls}
        {brushEl}
        {series.map((s: any, sIdx: number) => {
          const palette = getPalette();
          // Comparison series should mirror the color of the primary series
          // they overlay, not be assigned a fresh palette color. Find the
          // first non-comparison series above this one and reuse its color.
          const isComparison = s.variant === 'comparison';
          const baseSeries = isComparison
            ? (series.slice(0, sIdx).find((p: any) => p.variant !== 'comparison') || series[0])
            : s;
          const baseIdx = isComparison ? series.indexOf(baseSeries) : sIdx;
          const seriesColor = resolveColor(config[baseSeries.dataKey]?.color || palette[baseIdx % palette.length] || DEFAULT_CHART_COLOR);

          // Spec `series[].yAxis` binds this series to the secondary axis.
          // Only meaningful once a second axis is declared.
          const axisProps = hasDualAxis ? { yAxisId: s.yAxis === 'right' ? 'right' : 'left' } : {};
          // Spec `series[].stack` — series sharing a group id stack together.
          // Recharts keys stacking off `stackId`, so the author's group name
          // passes through unchanged.
          const stackProps = s.stack ? { stackId: String(s.stack) } : {};
          const valueFormatter = formatterFor(
            (s.yAxis === 'right' ? secondaryY : primaryY)?.format,
          );

          if (chartType === 'bar' || chartType === 'horizontal-bar') {
            // For categorical bar charts with a single primary series,
            // color each bar distinctly. With a comparison overlay the
            // chart effectively has two series, so revert to one color
            // per series for visual consistency.
            const primaryCount = series.filter((p: any) => p.variant !== 'comparison').length;
            const colorPerCategory = primaryCount === 1 && !isComparison && series.length === 1 && data.length > 1;
            const cmp = comparisonStyle(s, 'bar');
            return (
              <Bar key={s.dataKey} dataKey={s.dataKey} fill={`url(#bg-${gslug(seriesColor)})`} radius={4} fillOpacity={cmp?.fillOpacity} {...stackProps} {...axisProps} {...animProps} {...markClickProps(s)}>
                {colorPerCategory && data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={`url(#bg-${gslug(resolveColor(colorForCategory(entry?.[xAxisKey], idx, palette)))})`} />
                ))}
                {dataLabel(valueFormatter)}
              </Bar>
            );
          }
          if (chartType === 'line') {
            const cmp = comparisonStyle(s, 'line');
            return (
              <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} stroke={seriesColor} strokeWidth={2} dot={false} strokeOpacity={cmp?.strokeOpacity} strokeDasharray={cmp?.strokeDasharray} {...axisProps} {...animProps} {...markClickProps(s)}>
                {dataLabel(valueFormatter)}
              </Line>
            );
          }
          if (chartType === 'area') {
            const cmp = comparisonStyle(s, 'area');
            return (
              <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} fill={`url(#ag-${gslug(seriesColor)})`} stroke={seriesColor} strokeWidth={2} fillOpacity={cmp?.fillOpacity ?? 1} strokeOpacity={cmp?.strokeOpacity} strokeDasharray={cmp?.strokeDasharray} {...stackProps} {...axisProps} {...animProps} {...markClickProps(s)}>
                {dataLabel(valueFormatter)}
              </Area>
            );
          }
          return null;
        })}
      </ChartComponent>
    </ChartContainer>
    </ChartFrame>
  );
}


/**
 * Detect the framework#4033 shape from props alone: rows are present, the chart
 * plots a category axis, and NOT ONE row carries the key it was told to plot.
 *
 * **Key ABSENT is what this asks, and only that** — `key in row` — which is the
 * line dividing it from objectui#4466's null bucket. The two failures look
 * identical on screen (an axis frame with no marks) and have different causes
 * and different answers:
 *
 *   - **key absent** — the dataset query grouped by a dimension it never
 *     PROJECTED, so no value for it exists anywhere. Nothing can be plotted and
 *     nothing can be labelled; this guard says so, naming the missing key.
 *   - **key present, value null** — a real group whose key happens to be NULL
 *     (`{user_id: null, event_count: 50}`, the shipped first-boot state of
 *     System Overview's "Events by User"). The data IS there, so it is drawn:
 *     `buildChartSeries` maps it to an explicit bucket label upstream of this
 *     component, and that guard never fires because `'user_id' in row` is true.
 *
 * That upstream mapping deliberately does not ADD the key to a row that lacks
 * it (see `bucketNullCategories` in `@object-ui/core`), which is what keeps this
 * predicate meaning what it says.
 */
function hasNoCategoryKey(props: AdvancedChartImplProps): boolean {
  const chartType = props.chartType === 'column' ? 'bar' : (props.chartType ?? 'bar');
  const rows = Array.isArray(props.data) ? props.data : [];
  const key = props.xAxisKey ?? 'name';
  return (
    CATEGORY_AXIS_CHART_TYPES.has(chartType) &&
    rows.length > 0 &&
    !rows.some((row) => row != null && typeof row === 'object' && key in row)
  );
}

/**
 * Chart families whose marks come from `series` AND NOTHING ELSE — the set the
 * series-axis guard below is allowed to refuse for.
 *
 * MEASURED in this file, not assumed, and deliberately NARROWER than
 * {@link CATEGORY_AXIS_CHART_TYPES}: `bar` / `horizontal-bar` / `line` / `area`
 * share one cartesian tail that renders `series.map(…)` and nothing else, and
 * `combo`'s `ComposedChart` does the same. Every other family reads
 * `series[0]?.dataKey || 'value'` — pie, donut, funnel, radar, scatter,
 * treemap, sankey all fall back to a `value` column and draw a perfectly good
 * chart with no series declared at all, so a refusal there would blank a
 * WORKING chart rather than explain a broken one.
 */
const SERIES_ONLY_CHART_TYPES: ReadonlySet<string> = new Set([
  'bar', 'horizontal-bar', 'line', 'area', 'combo',
]);

/**
 * The series-axis half of the same doctrine — objectui#4683.
 *
 * `hasNoCategoryKey` above answers "cannot know refuses loudly" for the FIRST
 * dimension. A pivoted chart has a second one, and it had no answer at all: a
 * pivot whose SECOND dimension was never projected produces
 * `series: []` with one bucket row per category, so the renderer drew axes,
 * grid, tooltip and legend around ZERO marks and said nothing. To the author
 * that reads as "no data matched", when what happened is that a dimension they
 * grouped BY never arrived.
 *
 * ## What this reads, and what it deliberately does NOT read
 *
 * The signal is `series: []` — {@link buildChartSeries}' own output — plus rows
 * to draw it against. NOT `groupKey in row`, which is the objectui#4507 trap
 * INVERTED: this component is handed the PIVOTED bucket rows, whose columns are
 * the group's VALUES, so the second dimension's own key is a column of no pivot
 * ever, ordinary ones included. A `key in row` test here would refuse every
 * grouped chart in the product.
 *
 * That keeps the three-way distinction intact, and each arm is pinned by a test:
 *
 *   - **null / `''` group values DRAW** (objectui#4673) — they are real groups,
 *     they get real buckets, so `series` is non-empty and this never fires;
 *   - **an unprojected group key REFUSES** — no row carries it, so no bucket
 *     exists, so `series` is `[]`: this fires;
 *   - **an ordinary pivot renders unchanged**, and so does a PARTIALLY
 *     projected one. That last is the mirror of `hasNoCategoryKey`'s own
 *     `!rows.some(…)`: the first dimension refuses only when NOT ONE row
 *     carries the key, and draws what projects otherwise. A pivot where some
 *     rows carry the group key yields those groups' series, so this stays
 *     silent and the chart draws what projected.
 *
 * ## Why the message cannot name the group key, and why that is honest
 *
 * `hasNoCategoryKey` names the key it could not find. This cannot, because the
 * renderer is not told which dimension the pivot grouped by — and the two
 * upstream shapes that reach it are byte-identical. Measured:
 * `buildChartSeries(rows, ['status','priority'], ['est_hours'])` with `priority`
 * unprojected and `buildChartSeries(rows, ['status'], [])` with no measure
 * selected BOTH return `{data:[{status:'Backlog'},…], xAxisKey:'status',
 * series:[]}`. Naming one cause would be a sentence that is false half the time,
 * which is worse than the silence this replaces — so the copy names the failure
 * and BOTH authoring causes, and the console warning carries the diagnostic pair
 * (`xAxisKey` + the keys the rows actually carry) exactly as the model does.
 *
 * ## Why `[]` and not "no series at all"
 *
 * `Array.isArray(series) && series.length === 0` — a binding that was COMPUTED
 * and came out empty, which is what both `buildChartSeries` call paths hand
 * over. `series === undefined` means no binding was ever computed (a caller that
 * never went through the helper); those charts are left byte-for-byte as they
 * were.
 */
function hasNoPlottableSeries(props: AdvancedChartImplProps): boolean {
  const chartType = props.chartType === 'column' ? 'bar' : (props.chartType ?? 'bar');
  const rows = Array.isArray(props.data) ? props.data : [];
  return (
    SERIES_ONLY_CHART_TYPES.has(chartType) &&
    rows.length > 0 &&
    Array.isArray(props.series) &&
    props.series.length === 0
  );
}

/**
 * The shell both refusals render — one placeholder, two diagnoses.
 *
 * Stated once so the series-axis guard cannot drift from the framework#4033 one
 * it mirrors: same box, same `role="status"` (a refusal is a state, not an
 * alert), same muted centred type, and a `data-chart-error` code naming WHICH
 * refusal fired.
 */
function ChartRefusal({
  code,
  className,
  children,
}: {
  code: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex h-full min-h-[120px] w-full items-center justify-center p-4 text-center text-sm text-muted-foreground ${className ?? ''}`}
      role="status"
      data-chart-error={code}
    >
      <span>{children}</span>
    </div>
  );
}

/**
 * Public entry point. A THIN wrapper purely so the unreadable-data guard can
 * short-circuit without breaking the rules of hooks: the condition depends on
 * `data`, which arrives asynchronously, so an early return inside the renderer
 * would change its hook count between renders. The wrapper's own hook list is
 * fixed, and the renderer below is reached with data it can actually plot.
 */
export default function AdvancedChartImpl(props: AdvancedChartImplProps) {
  const missingCategoryKey = hasNoCategoryKey(props);
  // The x-axis refusal WINS when both apply: a chart whose rows carry no
  // category key at all cannot plot an axis, which is the more fundamental
  // failure and the more specific message. Without this gate such a chart would
  // also warn about its series, printing two diagnoses for one cause.
  const noPlottableSeries = !missingCategoryKey && hasNoPlottableSeries(props);
  const xAxisKey = props.xAxisKey ?? 'name';
  const firstRowKeys = React.useMemo(
    () => Object.keys((Array.isArray(props.data) ? props.data[0] : undefined) ?? {}),
    [props.data],
  );

  React.useEffect(() => {
    if (!missingCategoryKey) return;
    // Names BOTH halves of the mismatch — the key the chart was told to plot and
    // the keys the rows actually carry. That pair is the whole diagnosis;
    // without it an author is left diffing a dataset against a chart spec by
    // hand, which is exactly what made framework#4033 expensive to find.
    console.warn(
      `[chart] no row has the category key "${xAxisKey}" — rendering an explanatory ` +
      `placeholder instead of an empty axis. Row keys: ${JSON.stringify(firstRowKeys)}. ` +
      `A dataset query must PROJECT the dimension it groups by (framework#4033).`,
    );
  }, [missingCategoryKey, xAxisKey, firstRowKeys]);

  React.useEffect(() => {
    if (!noPlottableSeries) return;
    // The same diagnostic PAIR the guard above prints, for the same reason: the
    // axis the chart did plot, and the keys its rows actually carry. In the
    // objectui#4683 shape that second half is the tell — bucket rows carrying
    // the category and NOTHING else say the group column was never written.
    console.warn(
      `[chart] no series to plot against the category axis "${xAxisKey}" — rendering an ` +
      `explanatory placeholder instead of an empty frame. Row keys: ${JSON.stringify(firstRowKeys)}. ` +
      `A grouped chart's SECOND dimension must be PROJECTED by the dataset query, and a ` +
      `chart with no measure selected has nothing to draw either (objectui#4683, framework#4033).`,
    );
  }, [noPlottableSeries, xAxisKey, firstRowKeys]);

  if (missingCategoryKey) {
    return (
      <ChartRefusal code="missing-category-key" className={props.className}>
        This chart cannot plot its category axis: no row has a{' '}
        <code className="font-mono">{xAxisKey}</code> field.
      </ChartRefusal>
    );
  }

  if (noPlottableSeries) {
    return (
      <ChartRefusal code="no-plottable-series" className={props.className}>
        This chart cannot plot any series: no measure or group reached its{' '}
        <code className="font-mono">{xAxisKey}</code> axis.
      </ChartRefusal>
    );
  }

  return <AdvancedChartImplInner {...props} />;
}
