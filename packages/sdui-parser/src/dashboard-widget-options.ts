/**
 * ObjectUI — unconsumed dashboard-widget `options` keys (objectui#5709)
 *
 * `@objectstack/spec`'s `DashboardWidgetOptionsSchema` ends in `.passthrough()`
 * ("declared query keys + open renderer extras"), so ANY key parses, validates
 * and lints cleanly — including one no renderer reads. That is how a showcase
 * dashboard shipped `options: { invert: true }` on a gauge with a comment
 * saying what it was believed to do, and rendered the un-inverted measure with
 * no diagnostic anywhere (objectui#5709). The 2026-08-23 maintainer ruling:
 * open extras stay open — they just stop being SILENT. A key that reaches no
 * renderer draws a WARNING naming the consumed set. Not an error: no gate
 * weakening and no new red gates were ruled.
 *
 * ## The census (measured on origin/main @ 8689166f6, spec 17.1.0)
 *
 * The spec REQUIRES `dataset` on every widget (`DashboardWidgetSchema`), and
 * both dashboard surfaces route a dataset-bound widget to `DatasetWidget`
 * (`DashboardRenderer.tsx` renders `<DatasetWidget>` when `widget.dataset` is
 * set; `DashboardGridLayout.tsx` mirrors the fork, objectui#4614). On that —
 * the only spec-legal — path, the renderer-consumed `options` keys are exactly
 * the five the spec DECLARES, all read as direct `options.<key>` accesses in
 * `packages/plugin-dashboard/src/DatasetWidget.tsx`:
 *
 *   dateGranularity, sortBy, sortOrder, limit   (query-affecting, framework#3588)
 *   stageOrder                                  (funnel/pyramid stage order)
 *
 * plus ONE undeclared key with a real read site:
 *
 *   description — the metric-card sub-caption channel. Read at
 *   `DashboardRenderer.tsx` (`(widget.options as …)?.description`,
 *   objectui#4032 item 4); the server's `translateDashboard` OVERLAYS the
 *   `widgets.{id}.subCaption` translation onto this key (objectstack#8056,
 *   objectstack#5428 item-4: 「两个作者字段两个 key」). Warning on a key the
 *   platform's own translation pipeline writes would be a false positive on
 *   legal metadata, so it is in the accepted set even though the dataset-bound
 *   render path does not currently display it.
 *
 * Notably NOT consumed anywhere in this repository: `thresholds` (zero read
 *   sites repo-wide) and `format` — the dataset-bound value is formatted with
 *   the MEASURE's own metadata (`measureField(...).format`, from the dataset
 *   definition), not with `options.format`. Both were widely believed to work;
 *   both draw this warning, which is the point.
 *
 * ## Scope — where the warning deliberately does NOT fire
 *
 *   - Widgets WITHOUT `dataset`: the legacy inline forms (`options.data`
 *     arrays, `provider: 'object'` bags) consume a much larger, spread-shaped
 *     key set (`{ ...options }` into `metric` / `object-metric` /
 *     `data-table` / …), whose true reach is each child component's prop
 *     surface. That form is spec-illegal today (`dataset` is required) and its
 *     census would be the unmaintainable one; skipping it keeps every warning
 *     this module emits a statement about the path the widget actually renders
 *     through.
 *   - Widgets in the legacy COMPONENT format (`widget.component`): `options`
 *     is not part of that contract.
 *   - Widgets carrying the spec's own escape hatch
 *     `suppressWarnings: ['unconsumed-widget-option']` — the spec models
 *     per-widget diagnostic suppression (`DashboardWidgetSchema`), so an
 *     author with a genuine out-of-band consumer can say so in metadata.
 *
 * ## Maintenance — how this list stays true
 *
 * `__tests__/dashboard-widget-options-census.test.ts` re-runs the census on
 * every test run: it re-derives the five declared keys from the installed
 * `@objectstack/spec`, re-extracts the `options.<key>` reads from
 * `DatasetWidget.tsx` source text (and fails loudly if that file gains a
 * consumption shape the extractor cannot see — a spread, a destructuring, a
 * computed access), re-checks the sub-caption read site, and trips on any NEW
 * file in `packages/*\/src` or `apps/*\/src` that starts reading
 * `widget.options`. A renderer change that adds or removes a consumed key
 * fails that test until this list is updated — the cost of keeping this
 * warning honest is editing ONE array below plus re-reading the census notes.
 */
import type { Diagnostic, SchemaElement } from './types.js';

/** The diagnostic `code` — also the id `suppressWarnings` suppresses. */
export const UNCONSUMED_WIDGET_OPTION = 'unconsumed-widget-option';

/**
 * Component types that host a dashboard `widgets` array. Both resolve to the
 * surfaces measured by the census above (`DashboardRenderer`,
 * `DashboardGridLayout`), which share one dispatch (`widgetDispatch.ts`).
 */
export const DASHBOARD_WIDGET_HOST_TYPES: ReadonlySet<string> = new Set([
  'dashboard',
  'dashboard-grid',
]);

/**
 * The accepted set: every `options` key with a renderer read site on the
 * dataset-bound path, plus the sub-caption convention key. Alphabetical; the
 * warning message prints it verbatim. Derivation and evidence: file header.
 */
export const CONSUMED_WIDGET_OPTION_KEYS: readonly string[] = [
  'dateGranularity',
  'description',
  'limit',
  'sortBy',
  'sortOrder',
  'stageOrder',
];

const CONSUMED = new Set<string>(CONSUMED_WIDGET_OPTION_KEYS);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The parser's deferred-expression marker — opaque here, never evaluated. */
const isExpr = (v: unknown): boolean => isPlainObject(v) && '$expr' in v;

/**
 * Diagnostics for `options` keys no renderer consumes, over one dashboard-host
 * node's `widgets` array. Pure and shallow by design: it never descends into
 * `children` (the caller's walk owns that) and answers `[]` for every shape
 * outside its census — see the scope notes in the file header.
 */
export function checkDashboardWidgetOptions(node: SchemaElement): Diagnostic[] {
  if (!DASHBOARD_WIDGET_HOST_TYPES.has(node.type)) return [];
  const widgets = (node as Record<string, unknown>).widgets;
  if (!Array.isArray(widgets)) return [];

  const diagnostics: Diagnostic[] = [];
  widgets.forEach((widget, index) => {
    if (!isPlainObject(widget) || isExpr(widget)) return;
    // Legacy component format: `options` is not part of that contract.
    if (widget.component !== undefined) return;
    // Only the dataset-bound (spec-legal) path is censused — see file header.
    if (widget.dataset === undefined || widget.dataset === null || widget.dataset === '') return;
    const options = widget.options;
    if (!isPlainObject(options) || isExpr(options)) return;
    if (
      Array.isArray(widget.suppressWarnings) &&
      widget.suppressWarnings.includes(UNCONSUMED_WIDGET_OPTION)
    ) {
      return;
    }
    const label = typeof widget.id === 'string' && widget.id !== '' ? widget.id : `#${index}`;
    const widgetType = typeof widget.type === 'string' && widget.type !== '' ? widget.type : 'widget';
    for (const key of Object.keys(options)) {
      if (CONSUMED.has(key)) continue;
      diagnostics.push({
        severity: 'warning',
        code: UNCONSUMED_WIDGET_OPTION,
        message:
          `<${node.type}> widget "${label}" (${widgetType}): options.${key} reaches no renderer — ` +
          `dashboard widget renderers read only: ${CONSUMED_WIDGET_OPTION_KEYS.join(', ')}`,
        tag: node.type,
      });
    }
  });
  return diagnostics;
}
