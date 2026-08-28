/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BaseSchema, DashboardComponentSchema, DashboardWidgetSchema } from '@object-ui/types';
import { SchemaRenderer, useActionEngine, useObjectLabel, PageVariablesProvider, usePageVariables } from '@object-ui/react';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import type { ActionDef, ActionResult, ActionContext, ModalHandler, SduiDomPassThroughKey } from '@object-ui/core';
import {
  resolveDashboardFilterDefs,
  dashboardFilterVariableDefs,
  buildWidgetScopedFilter,
  mergeFilters,
  toDomProps,
} from '@object-ui/core';
import { cn, Card, CardHeader, CardTitle, CardContent, Button, getLazyIcon } from '@object-ui/components';
import { forwardRef, useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import type { HTMLAttributes } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isObjectProvider, deriveStaticTableColumns } from './utils';
import { classifyWidgetType, METRIC_LIKE_TYPES } from './widgetDispatch';
import { LEGACY_RETIRED_WIDGET_SCHEMA, isLegacyRetiredWidget } from './legacyRetiredWidget';
import { DatasetWidget } from './DatasetWidget';
import { DashboardFilterBar } from './DashboardFilterBar';

interface SortableWidgetWrapperProps {
  id: string;
  disabled?: boolean;
  gridSpan?: { w: number; h: number };
  className?: string;
  children: React.ReactNode;
}

function SortableWidgetWrapper({ id, disabled, gridSpan, className, children }: SortableWidgetWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...(gridSpan ? { gridColumn: `span ${gridSpan.w}`, gridRow: `span ${gridSpan.h}` } : {}),
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'h-full w-full',
        className,
        !disabled && 'cursor-grab active:cursor-grabbing',
        isOver && !isDragging && 'ring-2 ring-primary ring-offset-2 rounded-lg'
      )}
      data-sortable-widget-id={id}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

/**
 * Resolve a Lucide icon by name (PascalCase or kebab-case).
 * Delegates to the shared lazy resolver so each icon ships as its own
 * micro-chunk instead of pulling in the full lucide-react namespace.
 */
function resolveLucideIcon(name?: string): React.ElementType | null {
  if (!name) return null;
  return getLazyIcon(name);
}

// Color palette for charts
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

/**
 * Chart-family vocabularies live in `./widgetDispatch`, shared with
 * `DashboardGridLayout` and asserted against `ChartTypeSchema` — the three
 * dashboard surfaces used to restate them independently and disagree (#2943).
 */

/**
 * Chart sub-types that have a meaningful drill-down interaction.
 * Mirrors WidgetConfigPanel.DRILL_DOWN_TYPES and the click-handler wiring
 * in plugin-charts/AdvancedChartImpl. Radar is excluded because a polar
 * polygon has no single clickable category point (the interaction would be
 * ambiguous); every cartesian / part-to-whole / flow family is covered.
 */
const DRILLABLE_CHART_TYPES = new Set([
  'bar', 'horizontal-bar', 'line', 'area', 'pie', 'donut', 'funnel',
  'scatter', 'treemap', 'sankey',
]);

/**
 * Default-on policy for charts: object-backed widgets get drill-down
 * enabled by default when the chart type supports it. Authors can
 * disable explicitly with `drillDown: { enabled: false }`.
 */
function defaultChartDrill(chartType: string): { enabled: true } | undefined {
  return DRILLABLE_CHART_TYPES.has(chartType) ? { enabled: true } : undefined;
}

/**
 * Object-backed child schema types whose `filter` reaches the data source —
 * the injection surface for dashboard-level filters. Static-data widgets
 * (`chart`, `data-table` with inline `data`) have no query to scope and are
 * intentionally not filtered.
 */
const FILTERABLE_COMPONENT_TYPES = new Set([
  'object-chart',
  'object-metric',
  'object-data-table',
]);

/*
 * The retired-widget placeholder and its detector used to be declared right
 * here, private to this file — and that is the whole reason objectui#4612
 * existed: the sibling surface `DashboardGridLayout` could not consume what it
 * could not see, so the graceful fallback covered one of the two surfaces and
 * the other rendered a silent blank chart for the identical stored metadata.
 * Both now import the single declaration from `./legacyRetiredWidget`; the
 * behaviour on this surface is unchanged (pinned by
 * `__tests__/DashboardRenderer.legacyRetired.test.tsx`).
 */

/**
 * The dashboard renderer's props.
 *
 * ## Why there is no `[key: string]: any` here (objectui#4528)
 *
 * There used to be one, and it erased this entire interface. A string index
 * signature puts `string` into `keyof Props`, so `'ref' extends keyof Props` is
 * always true and React's `PropsWithoutRef` takes its `Omit` branch —  and
 * `Omit` over a type carrying a string index signature keeps ONLY the index
 * signature. Every declared property above was dropped from the resolved type:
 * `keyof React.ComponentProps< typeof DashboardRenderer >` measured as
 * `string | number`, and `onWidgetClick` measured as `any` at every JSX call
 * site, while this interface went on declaring
 * `(widgetId: string | null) => void`. The declaration was right and no
 * consumer was held to it — a prop typo or a wrong-arity handler type-checked.
 *
 * The same trap, in `packages/components`, is objectui#4422 / PR #4438; this is
 * the sweep of the two packages that issue left unswept.
 *
 * ## How the DOM pass-through survives without it
 *
 * `SchemaRenderer` hands this component the authored node's own keys, so the
 * render function still collects an open rest object — but what may reach the
 * element is decided by `toDomProps`' WHITELIST (objectui#4432), not by this
 * type. The keys that whitelist forwards are therefore declared here BY NAME,
 * derived from the whitelist constant itself so the two cannot drift, which is
 * exactly what `@object-ui/core`'s `dom-props` doctrine asks for: "Deliberate
 * DOM pass-through beyond this set stays available the objectui#4435 way —
 * DECLARE it and forward it by name. Do not reopen the spread."
 */
export interface DashboardRendererProps
  extends Pick<HTMLAttributes<HTMLDivElement>, SduiDomPassThroughKey> {
  schema: DashboardComponentSchema;
  className?: string;
  /**
   * Data-source adapter for the widgets this dashboard renders.
   *
   * Destructured by the render function and handed to `DatasetWidget` /
   * `SchemaRenderer`, and passed by both in-repo hosts (`DashboardView`,
   * `DashboardPreview`) — but never declared until objectui#4528, because the
   * index signature above was answering for it. Typed `any` deliberately: that
   * is precisely what it resolved to before, so declaring it changes what is
   * DECLARED without changing what any call site is held to. Narrowing it to a
   * real adapter type is a separate change with its own consumer sweep.
   */
  dataSource?: any;
  /** Callback invoked when dashboard refresh is triggered (manual or auto) */
  onRefresh?: () => void;
  /** Total record count to display */
  recordCount?: number;
  /** User actions configuration */
  userActions?: { sort?: boolean; search?: boolean; filter?: boolean };
  /** Enable design mode — shows selection affordances on widgets */
  designMode?: boolean;
  /** Currently selected widget ID (controlled) */
  selectedWidgetId?: string | null;
  /** Callback when a widget is clicked in design mode */
  onWidgetClick?: (widgetId: string | null) => void;
  /**
   * Callback when widgets are reordered via drag-and-drop in design mode.
   * Receives the next widgets array (with positions swapped). The parent
   * is expected to persist via its data adapter. When omitted, drag-and-
   * drop affordances are disabled even in design mode.
   */
  onWidgetsReorder?: (widgets: DashboardWidgetSchema[]) => void;
  /** Optional handler for actionType="modal" header actions. Receives a schema and ActionContext. */
  modalHandler?: ModalHandler;
  /** Optional named handlers for actionType="script" header actions, keyed by action name (actionUrl). */
  scriptHandlers?: Record<string, (action: ActionDef, context: ActionContext) => Promise<ActionResult> | ActionResult>;
  /**
   * When true, suppress the built-in header title and description blocks.
   * Header actions (if any) are still rendered. Use this when the parent
   * page chrome (e.g. `DashboardView`) already renders the dashboard's
   * title/subtitle so we don't display them twice.
   */
  hideHeaderText?: boolean;
}

const DashboardRendererInner = forwardRef<HTMLDivElement, DashboardRendererProps>(
  ({ schema, className, dataSource, onRefresh, recordCount, userActions, designMode, selectedWidgetId, onWidgetClick, onWidgetsReorder, modalHandler, scriptHandlers, hideHeaderText, ...props }: DashboardRendererProps & { [key: string]: any }, ref) => {
    // Auto-infer the grid column count when the dashboard schema doesn't
    // specify one. Spec convention is a 12-column grid (widgets use w: 3 for
    // quarter-row KPIs, w: 6 for half-row charts, etc.). If we always default
    // to 4 columns, a widget with `w: 3` claims 75% of a row and KPI rows
    // collapse into a vertical stack. Expand to fit the largest widget span.
    const inferredColumns = (() => {
      if (schema.columns != null) return schema.columns;
      const widgets = schema.widgets ?? [];
      let maxSpan = 0;
      for (const w of widgets) {
        const span = (w.layout?.x ?? 0) + (w.layout?.w ?? 0);
        if (span > maxSpan) maxSpan = span;
        if ((w.layout?.w ?? 0) > maxSpan) maxSpan = w.layout!.w;
      }
      if (maxSpan > 4) return 12;
      return 4;
    })();
    const columns = inferredColumns;
    const gap = schema.gap || 4;
    // Positioned (explicit-columns) grid vs responsive auto-flow grid.
    // Defined here (not just above desktopBody) so renderWidget can give
    // layout-less widgets a sensible default span in the positioned grid.
    const hasExplicitColumns = schema.columns != null || inferredColumns !== 4;
    const [refreshing, setRefreshing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Dashboard-level filters (framework#2501). Filter values live as
    // dashboard variables — the outer DashboardRenderer mounts a
    // PageVariablesProvider when the schema declares filters, so
    // usePageVariables() resolves them here (and gracefully no-ops when the
    // dashboard has no filters and no provider is mounted).
    const filterDefs = useMemo(
      () => resolveDashboardFilterDefs(schema),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [schema.globalFilters, schema.dateRange]
    );
    const { variables: filterValues, setVariable: setFilterValue, resetVariables: resetFilterValues } = usePageVariables();

    // Build ActionDef[] from header actions so useActionEngine can dispatch by name.
    const headerActionDefs = useMemo<ActionDef[]>(() => {
      const actions = schema.header?.actions ?? [];
      return actions.map((a: { label: string; actionUrl?: string; actionType?: string; icon?: string }) => ({
        name: a.actionUrl || a.label,
        type: (a.actionType as ActionDef['type']) || 'url',
        target: a.actionUrl,
        label: a.label,
      }));
    }, [schema.header?.actions]);

    const { executeAction, engine } = useActionEngine({ actions: headerActionDefs });

    // ── i18n: convention-based label resolution for dashboard / widget /
    // action text. The dashboard name (`schema.name`) keys all lookups; when
    // it's missing we silently degrade to the raw English fallbacks.
    const { dashboardLabel, dashboardDescription, dashboardActionLabel, widgetTitle, widgetDescription, widgetSubCaption, fieldLabel } = useObjectLabel();
    const { t, language } = useObjectTranslation();

    /**
     * Collapse an authored `I18nLabel` to the active UI language.
     *
     * This replaces a private `resolveLabel` copy that read the RETIRED
     * `{ key, defaultValue }` key-reference form (objectstack#5055) and ended
     * `return label.defaultValue || label.key`. Handed the vocabulary the spec
     * actually admits today — an inline per-locale map — that copy answered
     * `undefined`, so the metric dispatch's `|| widgetType` fallback took over
     * and KPI cards rendered the literal string `"metric"` (objectui#4032).
     *
     * `pickLocalized` is the seam #4208 already landed for this vocabulary on
     * the sibling surface (`DashboardGridLayout`), pinned limb-for-limb against
     * the spec's own `resolveI18nLabel`. Reused rather than re-implemented: a
     * fourth dialect is what objectstack#4115 exists to prevent.
     */
    const resolveLabel = useCallback(
      (label: unknown): string | undefined => {
        if (label === undefined || label === null) return undefined;
        return pickLocalized(label, language) || undefined;
      },
      [language],
    );
    /**
     * Resolve a chart series label. When the y-field defaults to a synthetic
     * key like 'value' (used by count aggregations that have no real field),
     * fall back to an i18n'd aggregate name (Count / Sum / Average …) instead
     * of leaking the placeholder 'value' string into the legend / tooltip.
     */
    const resolveSeriesLabel = useCallback((objectName: string | undefined, yField: string, aggFn: string | undefined) => {
      const isSynthetic = !yField || yField === 'value' || yField === 'count';
      if (aggFn && (isSynthetic || aggFn === 'count')) {
        return t(`report.aggregate.${aggFn}`, { defaultValue: aggFn });
      }
      if (objectName) {
        return fieldLabel(objectName, yField, yField);
      }
      return yField;
    }, [t, fieldLabel]);
    const dashName = (schema as any).name as string | undefined;

    /**
     * Translate a header-action label using the
     * `{ns}.dashboards.{dashName}.actions.{actionKey}.label` convention.
     * Falls back to the action's English label when no translation exists or
     * the dashboard schema has no `name`.
     */
    const tActionLabel = useCallback(
      (action: { label: string; actionUrl?: string }): string => {
        if (!dashName) return action.label;
        const key = action.actionUrl || action.label;
        return dashboardActionLabel(dashName, key, action.label);
      },
      [dashName, dashboardActionLabel],
    );

    /**
     * Translate a widget title / description using the
     * `{ns}.dashboards.{dashName}.widgets.{widgetId}.title|description`
     * convention. Falls back to the metadata-supplied string.
     *
     * The two channels compose in a fixed order, the same one
     * `useActionTextLocalizer` (objectui#4265) applies to declared actions: the
     * authored value is collapsed to the active language FIRST, and the plain
     * string that falls out is what the bundle receives as its fallback. So a
     * per-locale literal and a bundle entry can never disagree about what "the
     * authored title" is, and a bundle entry always wins over an inline map.
     */
    const tWidgetTitle = useCallback(
      (widget: DashboardWidgetSchema): string | undefined => {
        const fallback = resolveLabel(widget.title);
        if (!dashName || !widget.id || fallback === undefined) return fallback;
        return widgetTitle(dashName, widget.id, fallback);
      },
      [dashName, widgetTitle, resolveLabel],
    );

    const tWidgetDescription = useCallback(
      (widget: DashboardWidgetSchema): string | undefined => {
        const fallback = resolveLabel(widget.description);
        if (!dashName || !widget.id) return fallback;
        return widgetDescription(dashName, widget.id, fallback);
      },
      [dashName, widgetDescription, resolveLabel],
    );

    /**
     * Translate a metric card's SUB-CAPTION — the line under the big number —
     * using the `{ns}.dashboards.{dashName}.widgets.{widgetId}.subCaption`
     * convention (objectui#4032 item 4).
     *
     * The authored field is `widget.options.description`, NOT
     * `widget.description`. They are two different authored fields with two
     * different keys (objectstack#5428 item-4 ruling: 「两个作者字段两个
     * key」), which is why PR #4358 stopped here instead of routing the
     * sub-caption through `tWidgetDescription`: `widget.description` feeds the
     * shared Card header, and on a `kpi` / `gauge` / `bullet` widget BOTH are
     * on screen at once, so one shared key would make a single translation
     * entry overwrite the other field's text.
     *
     * `subCaption` is the widget-translation-node member objectstack#8056
     * added, shipped in `@objectstack/spec@17.0.0` (the version this repo
     * pins). The server already reads the same key on the `/meta` path —
     * `translateDashboard` overlays it onto `options.description` — so a served
     * document needs no client work; this is the same key path resolved for the
     * app bundles objectui loads into `I18nProvider` itself.
     *
     * Composition order is the one `tWidgetTitle` fixed: the authored value is
     * collapsed to the active language FIRST (an inline per-locale map — the
     * #4208 `pickLocalized` seam), and the plain string that falls out is
     * offered to the bundle as its fallback, so a bundle entry always wins over
     * an inline map and the two channels can never disagree about what "the
     * authored sub-caption" is.
     *
     * A translation with no authored counterpart is legitimate and matches the
     * server: `translateDashboard` writes `options.description` whenever the
     * bundle carries a non-empty `subCaption`, whether or not the author wrote
     * one. Absent both, this answers `undefined` rather than `''` —
     * `MetricWidget` gates its whole caption row on the value's truthiness.
     */
    const tWidgetSubCaption = useCallback(
      (widget: DashboardWidgetSchema): string | undefined => {
        const authored = (widget.options as Record<string, unknown> | undefined)?.description;
        const fallback = resolveLabel(authored);
        if (!dashName || !widget.id) return fallback;
        return widgetSubCaption(dashName, widget.id, fallback);
      },
      [dashName, widgetSubCaption, resolveLabel],
    );

    // Install host-supplied modal/script handlers on the underlying ActionRunner.
    useEffect(() => {
      const runner = engine.getRunner();
      if (modalHandler) runner.setModalHandler(modalHandler);
      if (scriptHandlers) {
        for (const [name, fn] of Object.entries(scriptHandlers)) {
          runner.registerScript(name, fn as any);
        }
      }
    }, [engine, modalHandler, scriptHandlers]);

    useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleRefresh = useCallback(() => {
      if (!onRefresh) return;
      setRefreshing(true);
      onRefresh();
      // Reset refreshing indicator after a short delay
      setTimeout(() => setRefreshing(false), 600);
    }, [onRefresh]);

    // Auto-refresh interval
    useEffect(() => {
      if (!schema.refreshInterval || schema.refreshInterval <= 0 || !onRefresh) return;
      intervalRef.current = setInterval(handleRefresh, schema.refreshInterval * 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [schema.refreshInterval, onRefresh, handleRefresh]);

    const handleWidgetClick = useCallback((e: React.MouseEvent, widgetId: string | undefined) => {
      if (!designMode || !onWidgetClick || !widgetId) return;
      e.stopPropagation();
      onWidgetClick(widgetId);
    }, [designMode, onWidgetClick]);

    const handleWidgetKeyDown = useCallback((e: React.KeyboardEvent, widgetId: string | undefined, index: number) => {
      if (!designMode || !onWidgetClick) return;
      const widgets = schema.widgets || [];
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onWidgetClick(widgetId ?? null);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = index + 1 < widgets.length ? widgets[index + 1] : null;
        if (next?.id) onWidgetClick(next.id);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = index - 1 >= 0 ? widgets[index - 1] : null;
        if (prev?.id) onWidgetClick(prev.id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onWidgetClick(null);
      }
    }, [designMode, onWidgetClick, schema.widgets]);

    const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
      if (!designMode || !onWidgetClick) return;
      if (e.target === e.currentTarget) {
        onWidgetClick(null);
      }
    }, [designMode, onWidgetClick]);

    /**
     * The click channel of the host element, with ONE carrier (objectui#4432).
     *
     * `onClick` is a declared DOM pass-through key of the SDUI widget contract,
     * and this container also computes its own background handler — so both
     * have a legitimate claim on the same prop. The old trailing `{...props}`
     * spread resolved that by letting the incoming handler REPLACE
     * `handleBackgroundClick` outright, which silently switched design-mode
     * background deselection off for any host that passed one. Dropping the
     * incoming handler instead would be the mirror failure: a whitelisted key
     * that type-checks, reads as supported, and never arrives.
     *
     * Both run, container affordance first. A non-function `onClick` (an
     * authored JSON string — SDUI spells click behaviour `events: { onClick }`,
     * which is DATA and is dropped by the whitelist) is ignored rather than
     * handed to React, which would throw on it.
     *
     * Deliberately NOT wrapped in `useCallback`: it closes over `props.onClick`
     * read out of the rest object, which the React Compiler cannot prove stable,
     * so a manual memo here is one it reports as unpreservable
     * (`Compilation Skipped: Existing memoization could not be preserved`) and
     * then declines to optimize the component around. It lands on a plain
     * element with no memoized child, so identity churn costs nothing.
     */
    const handleHostClick = (e: React.MouseEvent<HTMLDivElement>) => {
      handleBackgroundClick(e);
      if (typeof props.onClick === 'function') props.onClick(e);
    };

    // --- Drag-and-drop reordering (design mode only) ---------------------
    // Powered by @dnd-kit. Because each widget renders with
    // `gridColumn: span W` (no explicit x/y), array order *is* visual order,
    // so `arrayMove` on the widgets array yields an intuitive insertion-based
    // reorder (drop between widgets, not just swap).
    const dragEnabled = !!(designMode && onWidgetsReorder);

    const sensors = useSensors(
      useSensor(PointerSensor, {
        // Require a small drag distance so click-to-select still works.
        activationConstraint: { distance: 5 },
      })
    );

    const handleSortableDragEnd = useCallback(
      (event: DragEndEvent) => {
        if (!dragEnabled) return;
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const widgets = schema.widgets ?? [];
        const oldIndex = widgets.findIndex((w: DashboardWidgetSchema) => w.id === active.id);
        const newIndex = widgets.findIndex((w: DashboardWidgetSchema) => w.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onWidgetsReorder?.(arrayMove(widgets, oldIndex, newIndex));
      },
      [dragEnabled, schema.widgets, onWidgetsReorder]
    );

    const renderWidget = (widget: DashboardWidgetSchema, index: number, forceMobileFullWidth?: boolean) => {
        // Clamp widget span to grid columns to prevent overflow. A widget
        // with NO layout (e.g. authored in the Studio designer, which omits
        // it) would otherwise get a single column in the positioned grid and
        // cram the whole dashboard into one row (charts squeezed to a few px).
        // Give layout-less widgets a sensible default span so they auto-flow
        // into a readable grid — KPIs quarter-width, charts/tables half-width —
        // matching the editable DashboardGridLayout's auto-placement. Only the
        // positioned grid needs this; the responsive flow layout sizes each
        // widget as one cell.
        const isMetricSpan = widget.type === 'metric' || METRIC_LIKE_TYPES.has(widget.type || '');
        const fallbackSpan = hasExplicitColumns
          ? { w: Math.min(isMetricSpan ? 3 : 6, columns), h: isMetricSpan ? 2 : 4 }
          : undefined;
        const effectiveLayout = widget.layout ?? fallbackSpan;
        const clampedLayout = effectiveLayout
          ? { ...effectiveLayout, w: Math.min(effectiveLayout.w, columns) }
          : undefined;

        // ADR-0021 — a widget bound to a semantic-layer dataset renders through
        // the governed queryDataset path (DatasetWidget) instead of the inline
        // object-aggregate schema. No cast needed: `dataset` flows onto
        // `DashboardWidgetSchema` from `@objectstack/spec`'s `DashboardWidget`
        // (`packages/types/src/complex.ts`), so `widget.dataset` type-checks
        // directly.
        const datasetBound = !!widget.dataset;

        const getComponentSchema = () => {
            if (widget.component) return widget.component;

            // Handle Shorthand Registry Mappings
            const widgetType = widget.type;
            const options = (widget.options || {}) as Record<string, any>;
            // Renderer-internal data sources only (ADR-0021): the inline
            // `options.data` / `widget.data` array, or the `provider: 'object'`
            // async config (which carries its OWN nested `object`/`aggregate`).
            // The pre-ADR-0021 top-level analytics keys (`object`, `categoryField`,
            // `valueField`, `aggregate`, …) are no longer read — their renderer
            // branches were retired in framework#3320.
            const widgetData = (widget as any).data || options.data;

            // Retired legacy inline-analytics widget (framework#3320): still carries
            // the pre-ADR-0021 top-level `object` binding with no `dataset` and no
            // inline `options.data`. No authoring surface emits this anymore, so it
            // is stale stored metadata — render a visible error placeholder (not a
            // blank) prompting a rebind to a dataset. The condition itself lives in
            // `./legacyRetiredWidget` so `DashboardGridLayout` applies the SAME one
            // (objectui#4612) instead of a hand-copied twin.
            if (isLegacyRetiredWidget(widget)) {
                return LEGACY_RETIRED_WIDGET_SCHEMA;
            }

            // One shared classification (./widgetDispatch): resolves spec-level
            // aliases onto a renderer-supported base family (column→bar,
            // spline→line) and names the single-value / tabular / unsupported
            // families explicitly, so no widget type reaches the passthrough
            // return below and renders a red "Unknown component type" (#2943).
            const dispatch = classifyWidgetType(widgetType);
            const resolvedWidgetType = dispatch.chartType ?? widgetType;

            if (dispatch.family === 'series' && dispatch.chartType) {
                const xAxisKey = options.xField || 'name';
                const yField = options.yField || 'value';

                // provider: 'object' — delegate to ObjectChart for async data loading.
                // Field/aggregate config comes from the nested data provider.
                if (isObjectProvider(widgetData)) {
                    const providerAgg = widgetData.aggregate;
                    const effectiveAggregate = providerAgg ? {
                        field: providerAgg.field,
                        function: providerAgg.function,
                        groupBy: providerAgg.groupBy,
                    } : undefined;
                    const effectiveYField = effectiveAggregate?.field || yField;
                    return {
                        type: 'object-chart',
                        chartType: resolvedWidgetType,
                        objectName: widgetData.object,
                        aggregate: effectiveAggregate,
                        filter: widgetData.filter || widget.filter,
                        xAxisKey: xAxisKey,
                        series: [{
                            dataKey: effectiveYField,
                            label: resolveSeriesLabel(widgetData.object, effectiveYField, effectiveAggregate?.function),
                        }],
                        colors: CHART_COLORS,
                        // Deterministic first paint inside the grid — no entrance
                        // animation to freeze at height 0 (#2756).
                        isAnimationActive: false,
                        drillDown: options.drillDown ?? defaultChartDrill(dispatch.chartType),
                        // Passed through by value; its TYPE now comes from the
                        // spec's converged `{ kind, dimension? }` (objectstack#5011),
                        // which is what `CompareToConfig` projects — so the cast
                        // that used to bridge the skew is gone.
                        compareTo: widget.compareTo,
                        className: "h-[200px] sm:h-[250px] md:h-[300px]"
                    };
                }

                // Static inline data array.
                const dataItems = Array.isArray(widgetData) ? widgetData : widgetData?.items || [];

                return {
                    type: 'chart',
                    chartType: resolvedWidgetType,
                    data: dataItems,
                    xAxisKey: xAxisKey,
                    series: [{
                        dataKey: yField,
                        label: resolveSeriesLabel(undefined, yField, undefined),
                    }],
                    colors: CHART_COLORS,
                    // Deterministic first paint inside the grid (#2756).
                    isAnimationActive: false,
                    className: "h-[200px] sm:h-[250px] md:h-[300px]"
                };
            }

            // Single-value families (gauge / solid-gauge / kpi / bullet, and the
            // `metric` widget spelling) render as a metric card. The knowledge
            // was already here as METRIC_LIKE_TYPES — it just picked a grid span
            // and never routed the widget, so four spec chart types fell through
            // to a red error box (#2943).
            if (dispatch.family === 'metric') {
                // objectui#4032 — the KPI card's heading comes from the SAME
                // convention channel every other widget's header uses
                // (`{ns}.dashboards.{dash}.widgets.{id}.title`), not from the
                // raw authored `widget.title`.
                //
                // A self-contained metric renders no shared Card header, so
                // `resolvedTitle` was computed below and then thrown away while
                // this line built its own untranslated label — which is exactly
                // why a `type: 'metric'` tile showed raw English on a dashboard
                // whose every other widget showed the translation.
                //
                // `|| widgetType` is kept as the last resort for an untitled
                // widget, but it is now genuinely last: it used to swallow the
                // spec-valid inline map that `resolveLabel` could not read, so
                // an authored title silently became the string `"metric"`.
                const label = tWidgetTitle(widget) || widgetType;
                // objectui#4032 item 4 — and the card's SUB-CAPTION comes from
                // its own key, `…widgets.{id}.subCaption`, because it is a
                // different authored field (`options.description`) from the
                // shared header's `widget.description`. Assigned AFTER the
                // `...options` spread in both branches below: the spread is
                // what carries the raw authored `options.description` through,
                // and this is the resolved value that replaces it. When nothing
                // translates it, `tWidgetSubCaption` hands back exactly what the
                // spread would have — so an untranslated dashboard is byte-identical.
                const subCaption = tWidgetSubCaption(widget);
                // provider: 'object' — ObjectMetricWidget aggregates server-side.
                if (isObjectProvider(widgetData)) {
                    const providerAgg = widgetData.aggregate;
                    return {
                        type: 'object-metric',
                        ...options,
                        objectName: widgetData.object,
                        label,
                        description: subCaption,
                        aggregate: providerAgg ? {
                            field: providerAgg.field,
                            function: providerAgg.function,
                            groupBy: providerAgg.groupBy,
                        } : undefined,
                        filter: widgetData.filter || widget.filter,
                    };
                }
                // Static value: an inline `options.value`, else the first row's
                // measure from an inline data array.
                const rows = Array.isArray(widgetData) ? widgetData : widgetData?.items || [];
                const valueField = options.yField || 'value';
                return {
                    type: 'metric',
                    ...options,
                    label,
                    description: subCaption,
                    value: options.value ?? rows[0]?.[valueField] ?? '—',
                };
            }

            if (dispatch.family === 'table') {
                // `list` shares table semantics (raw records) but never carries
                // search / pagination chrome.
                const isList = widgetType === 'list';
                // provider: 'object' — use ObjectDataTable for async data loading.
                // Default-on drill-to-record: a click opens the record in a drawer.
                if (isObjectProvider(widgetData)) {
                    const { data: _data, ...restOptions } = options;
                    return {
                        type: 'object-data-table',
                        ...restOptions,
                        objectName: widgetData.object,
                        dataProvider: widgetData,
                        filter: widgetData.filter || widget.filter,
                        searchable: isList ? false : (widget.searchable ?? false),
                        pagination: isList ? false : (widget.pagination ?? false),
                        drillDown: options.drillDown ?? { enabled: true, mode: 'record' as const },
                        className: "border-0"
                    };
                }

                // Static (data-array) table — drill-to-record stays opt-in.
                const staticRows = Array.isArray(widgetData) ? widgetData : widgetData?.items || [];
                return {
                    type: 'data-table',
                    ...options,
                    data: staticRows,
                    // `columns` is a REQUIRED key of `DataTableSchema`, and this
                    // branch used to omit it whenever the author declared none —
                    // a table of empty rows, no headers, no cells (objectui#4618).
                    // Derive from the rows, as the `provider: 'object'` half of
                    // this same family already does. An explicit list always wins:
                    // a declared column set is a whitelist, never a starting point.
                    columns: Array.isArray(options.columns) && options.columns.length > 0
                        ? options.columns
                        : deriveStaticTableColumns(staticRows),
                    searchable: false,
                    pagination: false,
                    className: "border-0"
                };
            }

            // Pivot widgets are authored as dataset-bound (ADR-0021) and render via
            // DatasetWidget (a grouped table / cross-tab). The dashboard renderer no
            // longer emits the `object-pivot` / `pivot` blocks (framework#3320); the
            // ObjectPivotTable / PivotTable components remain public SDUI blocks for
            // other surfaces. A non-dataset pivot reaching here is stale metadata —
            // show the retired placeholder rather than a blank grid.
            //
            // This arm stays surface-LOCAL and is deliberately not part of the
            // shared detector (objectui#4612): it is a statement about what THIS
            // surface can draw — nothing here emits a pivot block — not about the
            // widget being legacy. `DashboardGridLayout` does still draw pivots from
            // static data and from the `provider: 'object'` config, so exporting
            // this family-wide arm would have retired two live branches over there.
            // The legacy pivot SHAPE is covered on both surfaces by the shared
            // sentinel above, which its top-level `object` matches.
            if (dispatch.family === 'pivot') {
                return LEGACY_RETIRED_WIDGET_SCHEMA;
            }

            // Custom widget — caller must supply `widget.component` (a full
            // UIComponent schema).  When missing, render a friendly placeholder
            // instead of falling through (which produced 0×0 chart errors).
            if (dispatch.family === 'custom') {
                return {
                    type: 'text',
                    value: 'Custom widget — set `component` to a UIComponent schema.',
                    variant: 'caption',
                    align: 'center',
                    className: 'flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-muted-foreground',
                };
            }

            // Known chart family with no dedicated renderer yet → clean labelled
            // placeholder instead of falling through to a raw "Unknown component
            // type" error box that dumps the widget JSON.
            if (dispatch.family === 'unsupported') {
                return {
                    type: 'text',
                    value: `「${widgetType}」chart type is not supported yet`,
                    variant: 'caption',
                    align: 'center',
                    className: 'flex h-full w-full items-center justify-center rounded border border-dashed bg-muted/20 p-4 text-muted-foreground',
                };
            }

            return {
                ...widget,
                ...options
            };
        };
        
        // Broadcast the dashboard filter values into this widget's inline
        // query: resolve the widget-scoped condition from the bindings and
        // AND-merge it with the widget's own filter. Object-backed child
        // schemas re-fetch on filter change, so no widget renderer changes
        // are needed downstream.
        const scopedFilter = filterDefs.length > 0
            ? buildWidgetScopedFilter(widget, filterDefs, filterValues)
            : undefined;
        const componentSchema = (() => {
            // `as BaseSchema`, not `as Record< string, any >` (objectui#4548):
            // the old cast dropped the `type` every branch of
            // `getComponentSchema` actually sets, so what reached
            // `SchemaRenderer` was a bag with no component descriptor as far as
            // the type system knew. Both spellings keep arbitrary key access
            // (BaseSchema carries an index signature); only this one keeps
            // `type`.
            const cs = getComponentSchema() as BaseSchema;
            if (scopedFilter && cs && FILTERABLE_COMPONENT_TYPES.has(cs.type)) {
                return { ...cs, filter: mergeFilters(cs.filter, scopedFilter) };
            }
            return cs;
        })();
        // Dataset-bound widgets render through DatasetWidget, which forwards
        // `widget.filter` to the dataset query as `runtimeFilter`.
        const effectiveWidget = scopedFilter && datasetBound
            ? { ...widget, filter: mergeFilters(widget.filter, scopedFilter) }
            : widget;
        // A `metric` widget renders its own card chrome ONLY in the inline
        // (object-metric) path. A dataset-bound metric uses DatasetWidget, which
        // renders just the value — so it must take the shared Card wrapper to get
        // a title + border like the kpi/gauge widgets (otherwise it shows as bare
        // text with no title, inconsistent with its neighbours).
        const isSelfContained = widget.type === 'metric' && !datasetBound;
        const resolvedTitle = tWidgetTitle(widget);
        const resolvedDescription = tWidgetDescription(widget);
        const widgetKey = widget.id || resolvedTitle || `widget-${index}`;
        const isSelected = designMode && selectedWidgetId === widget.id;

        const designModeProps = designMode ? {
            'data-testid': `dashboard-preview-widget-${widget.id}`,
            'data-widget-id': widget.id,
            role: 'button' as const,
            tabIndex: 0,
            'aria-selected': isSelected,
            'aria-label': `Widget: ${resolvedTitle || `Widget ${index + 1}`}`,
            onClick: (e: React.MouseEvent) => handleWidgetClick(e, widget.id),
            onKeyDown: (e: React.KeyboardEvent) => handleWidgetKeyDown(e, widget.id, index),
        } : {};

        const selectionClasses = designMode
          ? cn(
              "cursor-pointer rounded-lg transition-all outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected
                ? "ring-2 ring-primary shadow-md bg-primary/5 dark:bg-primary/10"
                : "hover:ring-2 hover:ring-primary/40 hover:shadow-sm"
            )
          : undefined;

        const innerGridSpanStyle = !isMobile && clampedLayout && !dragEnabled ? {
            gridColumn: `span ${clampedLayout.w}`,
            gridRow: `span ${clampedLayout.h}`,
        } : undefined;

        const renderedNode = isSelfContained ? (
            <div
                className={cn("h-full w-full", designMode && "relative", selectionClasses)}
                style={innerGridSpanStyle}
                {...designModeProps}
            >
                 {/* `isSelfContained` implies `!datasetBound` (see its definition above), so a
                     dataset-bound widget can never render here — it always takes the Card branch
                     below for its title + border chrome. Do not re-add a `datasetBound` fork
                     here: the arm is unreachable by construction (objectui#4620). */}
                 <SchemaRenderer schema={componentSchema} className={cn("h-full w-full", designMode && "pointer-events-none")} dataSource={dataSource} />
                 {designMode && <div className="absolute inset-0 z-10" aria-hidden="true" data-testid="widget-click-overlay" />}
            </div>
        ) : (
            <Card
                className={cn(
                    "overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md",
                    "bg-card/50 backdrop-blur-sm",
                    forceMobileFullWidth && "w-full",
                    designMode && "relative",
                    selectionClasses
                )}
                style={innerGridSpanStyle}
                {...designModeProps}
            >
                {resolvedTitle && (
                    <CardHeader className="pb-2 border-b border-border/40 bg-muted/20 px-3 sm:px-6">
                        <CardTitle className="text-sm sm:text-base font-medium tracking-tight truncate" title={resolvedTitle}>
                            {resolvedTitle}
                        </CardTitle>
                        {resolvedDescription && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{resolvedDescription}</p>
                        )}
                    </CardHeader>
                )}
                <CardContent className="p-0">
                    <div className={cn("h-full w-full", "p-3 sm:p-4 md:p-6", designMode && "pointer-events-none")}>
                        {datasetBound
                          ? <DatasetWidget widget={effectiveWidget} dataSource={dataSource} />
                          : <SchemaRenderer schema={componentSchema} dataSource={dataSource} />}
                    </div>
                </CardContent>
                {designMode && <div className="absolute inset-0 z-10" aria-hidden="true" data-testid="widget-click-overlay" />}
            </Card>
        );

        if (dragEnabled && widget.id) {
            return (
                <SortableWidgetWrapper
                    key={widgetKey}
                    id={widget.id}
                    gridSpan={!isMobile && clampedLayout ? { w: clampedLayout.w, h: clampedLayout.h } : undefined}
                >
                    {renderedNode}
                </SortableWidgetWrapper>
            );
        }

        return <Fragment key={widgetKey}>{renderedNode}</Fragment>;
    };

    // The spec-canonical dashboard display name is `label` (@objectstack/spec
    // DashboardSchema); `title` is the legacy objectui spelling. Read both so
    // spec-compliant dashboards get their header title (framework#1878/#1891;
    // mirrors the DashboardGridLayout fallback from #2666).
    const headerTitle = schema.title || schema.label;
    /**
     * Decide what the header would actually SHOW before deciding whether to
     * render its wrapper at all.
     *
     * Every child here is independently suppressible: the console page chrome
     * passes `hideHeaderText` because it already renders the dashboard's title
     * and description itself, and `showTitle` / `showDescription` can be
     * authored off. The wrapper, however, used to render whenever `header` was
     * merely *declared* — so with the chrome present and no `header.actions`,
     * every child evaluated falsy and the DOM still got
     * `<div class="col-span-full mb-4"></div>`: an empty node that claims a
     * full grid row (measured 64px) plus `mb-4`, opening every console
     * dashboard page with a blank band above the filter bar (objectui#5812,
     * measured on HotCRM 17.1.0). Authors had no lever — dropping `header`
     * would have traded this for the standalone embed's lost title, which is
     * the very thing `header` is for.
     *
     * So the contract is: the header costs zero pixels when it has nothing to
     * show, and is otherwise untouched. `header.actions` keep it alive even
     * under the chrome, since the chrome renders text only, not actions.
     */
    const header = schema.header;
    const showHeaderTitle = !hideHeaderText && header?.showTitle !== false && !!headerTitle;
    const showHeaderDescription = !hideHeaderText && header?.showDescription !== false && !!schema.description;
    const headerActions = header?.actions ?? [];
    const headerSection = header && (showHeaderTitle || showHeaderDescription || headerActions.length > 0) && (
      <div className="col-span-full mb-4">
        {showHeaderTitle && (
          <h2 className="text-lg font-semibold tracking-tight">
            {dashName
              ? dashboardLabel({ name: dashName, label: resolveLabel(headerTitle) })
              : resolveLabel(headerTitle)}
          </h2>
        )}
        {showHeaderDescription && (
          <p className="text-sm text-muted-foreground mt-1">
            {dashName
              ? dashboardDescription({ name: dashName, description: resolveLabel(schema.description) })
              : resolveLabel(schema.description)}
          </p>
        )}
        {headerActions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {headerActions.map((action: { label: string; actionUrl?: string; actionType?: string; icon?: string }, i: number) => {
              const Icon = resolveLucideIcon(action.icon);
              const handleClick = async () => {
                const { actionType, actionUrl, label } = action;
                if (!actionType || !actionUrl) {
                  console.warn('[DashboardRenderer] Header action missing actionType/actionUrl:', action);
                  return;
                }
                if (actionType === 'url') {
                  if (/^https?:\/\//.test(actionUrl) || actionUrl.startsWith('//')) {
                    window.location.assign(actionUrl);
                  } else {
                    // SPA-friendly navigation: use history API + popstate so React Router picks it up.
                    window.history.pushState({}, '', actionUrl);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
                  return;
                }
                // Everything that is not a raw navigation goes through the
                // ActionRunner, which owns the type registry. This used to
                // allow-list `modal` / `script` only, so a `flow` header action
                // (and `api` / `form` / `navigation`) fell through to a warn and
                // never dispatched — a screen flow could not even be launched
                // from a dashboard (framework#3528). The runner reports an
                // unknown type itself, so there is nothing to second-guess here.
                const result = await executeAction(actionUrl || label);
                if (!result?.success) console.warn('[DashboardRenderer] action failed', result?.error);
              };
              return (
                <Button key={i} variant="outline" size="sm" onClick={handleClick}>
                  {Icon && <Icon className="w-4 h-4 mr-1.5" />}
                  {tActionLabel(action)}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    );

    const filterBar = filterDefs.length > 0 && (
      <DashboardFilterBar
        defs={filterDefs}
        values={filterValues}
        onChange={setFilterValue}
        onReset={resetFilterValues}
        dataSource={dataSource}
        className="mb-2"
      />
    );

    const recordCountBadge = recordCount !== undefined && (
      <span className="text-xs text-muted-foreground">
        {recordCount.toLocaleString()} records
      </span>
    );

    const userActionsAttr = userActions ? JSON.stringify(userActions) : undefined;

    /**
     * What may legitimately become a DOM attribute on this container
     * (objectui#4432, migration step 2 of objectui#4425 phase 2).
     *
     * `view:dashboard` resolves to this component, so `SchemaRenderer` hands it
     * the dashboard node's OWN keys, the contents of the node's `props`
     * container, the ARIA it resolved, its evaluated `disabled` verdict and the
     * host's trailing props. Everything this component does not destructure
     * used to be spread raw onto the grid `<div>` below, and React writes
     * unknown lowercase attributes through in silence while stringifying object
     * values. Measured through the real SDUI path: **13 non-DOM attributes**,
     * including `events="[object Object]"`, `props="[object Object]"` and a
     * camelCase `arialabel` sitting next to the resolved `aria-label` — the same
     * value twice, one spelling of it meaningless to assistive technology.
     *
     * Per objectui#4425 phase 2 the answer is the whitelist, not another
     * deny-list: `toDomProps` keeps `id` / `className` / `role` / `tabIndex` /
     * `aria-*` / `data-*` and drops the rest. It is spread FIRST so this
     * component's own computed attributes (`className`, `style`,
     * `data-user-actions`, the click channel above) stay authoritative — the
     * old trailing spread let an incoming key overwrite each of them.
     *
     * `datasource` is absent from the 13 because this component destructures
     * the adapter and hands it to its own `SchemaRenderer` calls; that is the
     * one key objectui#4428 shipped a pass without, and it never reached this
     * spread.
     */
    const hostDomProps = toDomProps(props);

    const refreshButton = onRefresh && (
      <div className={cn("flex items-center justify-end gap-3 mb-2", !isMobile && "col-span-full")}>
        {recordCountBadge}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh dashboard"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          {refreshing ? 'Refreshing…' : 'Refresh All'}
        </Button>
      </div>
    );

    const widgetIds = useMemo(
      () => (schema.widgets ?? []).map((w: DashboardWidgetSchema) => w.id).filter((id: string | undefined): id is string => !!id),
      [schema.widgets]
    );

    const metricIds = useMemo(
      () => (schema.widgets ?? []).filter((w: DashboardWidgetSchema) => w.type === 'metric').map((w: DashboardWidgetSchema) => w.id).filter((id: string | undefined): id is string => !!id),
      [schema.widgets]
    );

    const otherIds = useMemo(
      () => (schema.widgets ?? []).filter((w: DashboardWidgetSchema) => w.type !== 'metric').map((w: DashboardWidgetSchema) => w.id).filter((id: string | undefined): id is string => !!id),
      [schema.widgets]
    );

    if (isMobile) {
      // Separate metric widgets from other widgets for better mobile layout
      const metricWidgets = schema.widgets?.filter((w: DashboardWidgetSchema) => w.type === 'metric') || [];
      const otherWidgets = schema.widgets?.filter((w: DashboardWidgetSchema) => w.type !== 'metric') || [];

      const mobileBody = (
        <div ref={ref} {...hostDomProps} className={cn("flex flex-col gap-4 px-4", className)} data-user-actions={userActionsAttr} onClick={handleHostClick}>
          {headerSection}
          {filterBar}
          {refreshButton}

          {/* Metric cards: 2-column grid */}
          {metricWidgets.length > 0 && (
            <div className="grid grid-cols-2 gap-3" onClick={handleBackgroundClick}>
              <SortableContext items={metricIds} strategy={rectSortingStrategy} disabled={!dragEnabled}>
                {metricWidgets.map((widget: DashboardWidgetSchema, index: number) => renderWidget(widget, index))}
              </SortableContext>
            </div>
          )}

          {/* Other widgets (charts, tables): full-width vertical stack */}
          {otherWidgets.length > 0 && (
            <div className="flex flex-col gap-4" onClick={handleBackgroundClick}>
              <SortableContext items={otherIds} strategy={verticalListSortingStrategy} disabled={!dragEnabled}>
                {otherWidgets.map((widget: DashboardWidgetSchema, index: number) => renderWidget(widget, index, true))}
              </SortableContext>
            </div>
          )}
        </div>
      );

      return dragEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortableDragEnd}>
          {mobileBody}
        </DndContext>
      ) : mobileBody;
    }

    const desktopBody = (
      <div
        ref={ref}
        {...hostDomProps}
        className={cn(
          "grid",
          // Content-sized rows only for the responsive flow layout. The
          // positioned grid (explicit columns + per-widget layout.h) needs a
          // baseline row height instead: `auto-rows-min` collapses any widget
          // whose content has no intrinsic height — notably charts, whose
          // recharts ResponsiveContainer fills its parent and so reports
          // width/height -1 and draws nothing. `minmax(5rem, auto)` gives each
          // spanned row a floor (so `gridRow: span 4` => a real ~20rem box)
          // while still letting taller widgets (tables) grow.
          !hasExplicitColumns && "auto-rows-min grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          className
        )}
        style={{
            ...(hasExplicitColumns && {
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridAutoRows: 'minmax(5rem, auto)',
            }),
            gap: `${gap * 0.25}rem`
        }}
        data-user-actions={userActionsAttr}
        onClick={handleHostClick}
      >
        {headerSection}
        {filterBar}
        {refreshButton}
        <SortableContext items={widgetIds} strategy={rectSortingStrategy} disabled={!dragEnabled}>
          {schema.widgets?.map((widget: DashboardWidgetSchema, index: number) => renderWidget(widget, index))}
        </SortableContext>
      </div>
    );

    return dragEnabled ? (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortableDragEnd}>
        {desktopBody}
      </DndContext>
    ) : desktopBody;
  }
);

DashboardRendererInner.displayName = 'DashboardRendererInner';

/**
 * DashboardRenderer — the public dashboard renderer.
 *
 * When the schema declares dashboard-level filters (`globalFilters` /
 * `dateRange`, framework#2501), their values are hosted as dashboard
 * variables in a `PageVariablesProvider` (the page/dashboard variables
 * primitive) so the filter bar can write them, the widget broadcast can read
 * them, and widget expressions can reference them as `page.<name>`.
 * Dashboards without filters render exactly as before — no provider mounted.
 *
 * When a filtered dashboard is embedded inside a Page with its own
 * variables, the nested providers MERGE (#2578 item 5): outer page variables
 * stay readable inside widget subtrees, and only a same-named filter shadows
 * the outer variable.
 */
export const DashboardRenderer = forwardRef<HTMLDivElement, DashboardRendererProps>(
  (props, ref) => {
    const { schema } = props;
    const filterDefs = useMemo(
      () => resolveDashboardFilterDefs(schema),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [schema.globalFilters, schema.dateRange]
    );
    if (filterDefs.length === 0) {
      return <DashboardRendererInner ref={ref} {...props} />;
    }
    return (
      <PageVariablesProvider definitions={dashboardFilterVariableDefs(filterDefs)}>
        <DashboardRendererInner ref={ref} {...props} />
      </PageVariablesProvider>
    );
  }
);

DashboardRenderer.displayName = 'DashboardRenderer';
