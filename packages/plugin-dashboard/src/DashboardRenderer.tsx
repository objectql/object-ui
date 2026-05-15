/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DashboardSchema, DashboardWidgetSchema } from '@object-ui/types';
import { SchemaRenderer, useActionEngine, useObjectLabel } from '@object-ui/react';
import type { ActionDef, ActionResult, ActionContext, ModalHandler } from '@object-ui/core';
import { cn, Card, CardHeader, CardTitle, CardContent, Button, getLazyIcon } from '@object-ui/components';
import { forwardRef, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { isObjectProvider } from './utils';

/**
 * Resolve a Lucide icon by name (PascalCase or kebab-case).
 * Delegates to the shared lazy resolver so each icon ships as its own
 * micro-chunk instead of pulling in the full lucide-react namespace.
 */
function resolveLucideIcon(name?: string): React.ElementType | null {
  if (!name) return null;
  return getLazyIcon(name);
}

/** Resolve an I18nLabel (string or {key, defaultValue}) to a plain string. */
function resolveLabel(label: string | { key?: string; defaultValue?: string } | undefined): string | undefined {
  if (label === undefined || label === null) return undefined;
  if (typeof label === 'string') return label;
  return label.defaultValue || label.key;
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
 * Chart sub-types that have a meaningful drill-down interaction.
 * Mirrors WidgetConfigPanel.DRILL_DOWN_TYPES and the click-handler wiring
 * in plugin-charts/AdvancedChartImpl. Scatter and funnel are excluded
 * because no onChartClick is wired for them today.
 */
const DRILLABLE_CHART_TYPES = new Set([
  'bar', 'horizontal-bar', 'line', 'area', 'pie', 'donut', 'funnel',
]);

/**
 * Default-on policy for charts: object-backed widgets get drill-down
 * enabled by default when the chart type supports it. Authors can
 * disable explicitly with `drillDown: { enabled: false }`.
 */
function defaultChartDrill(chartType: string): { enabled: true } | undefined {
  return DRILLABLE_CHART_TYPES.has(chartType) ? { enabled: true } : undefined;
}

export interface DashboardRendererProps {
  schema: DashboardSchema;
  className?: string;
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
  /** Optional handler for actionType="modal" header actions. Receives a schema and ActionContext. */
  modalHandler?: ModalHandler;
  /** Optional named handlers for actionType="script" header actions, keyed by action name (actionUrl). */
  scriptHandlers?: Record<string, (action: ActionDef, context: ActionContext) => Promise<ActionResult> | ActionResult>;
  [key: string]: any;
}

export const DashboardRenderer = forwardRef<HTMLDivElement, DashboardRendererProps>(
  ({ schema, className, dataSource, onRefresh, recordCount, userActions, designMode, selectedWidgetId, onWidgetClick, modalHandler, scriptHandlers, ...props }, ref) => {
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
    const [refreshing, setRefreshing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const { dashboardLabel, dashboardDescription, dashboardActionLabel, widgetTitle, widgetDescription, fieldLabel } = useObjectLabel();
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
     */
    const tWidgetTitle = useCallback(
      (widget: DashboardWidgetSchema): string | undefined => {
        const fallback = resolveLabel(widget.title);
        if (!dashName || !widget.id || fallback === undefined) return fallback;
        return widgetTitle(dashName, widget.id, fallback);
      },
      [dashName, widgetTitle],
    );

    const tWidgetDescription = useCallback(
      (widget: DashboardWidgetSchema): string | undefined => {
        const fallback = resolveLabel(widget.description);
        if (!dashName || !widget.id) return fallback;
        return widgetDescription(dashName, widget.id, fallback);
      },
      [dashName, widgetDescription],
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

    const renderWidget = (widget: DashboardWidgetSchema, index: number, forceMobileFullWidth?: boolean) => {
        // Clamp widget span to grid columns to prevent overflow
        const clampedLayout = widget.layout
          ? { ...widget.layout, w: Math.min(widget.layout.w, columns) }
          : undefined;

        const getComponentSchema = () => {
            if (widget.component) return widget.component;

            // Handle Shorthand Registry Mappings
            const widgetType = widget.type;
            const options = (widget.options || {}) as Record<string, any>;

            // Metric widgets with object binding — delegate to ObjectMetricWidget
            // for async data loading with proper error/loading states.
            // Static metric options (label, value, trend, icon) are passed as
            // fallback values that render only when no dataSource is available.
            if (widgetType === 'metric' && widget.object) {
                const widgetData = options.data;
                const aggregate = isObjectProvider(widgetData) && widgetData.aggregate
                    ? {
                        field: widget.valueField || widgetData.aggregate.field,
                        function: widget.aggregate || widgetData.aggregate.function,
                        // Prefer explicit categoryField or aggregate.groupBy; otherwise, default to a single bucket.
                        groupBy: widget.categoryField ?? widgetData.aggregate.groupBy ?? '_all',
                    }
                    : widget.aggregate ? {
                        field: widget.valueField || 'value',
                        function: widget.aggregate,
                        // Default to a single group unless the user explicitly configures a categoryField.
                        groupBy: widget.categoryField || '_all',
                    } : undefined;

                return {
                    type: 'object-metric',
                    objectName: widget.object || (isObjectProvider(widgetData) ? widgetData.object : undefined),
                    aggregate,
                    filter: (isObjectProvider(widgetData) ? widgetData.filter : undefined) || widget.filter,
                    label: options.label || tWidgetTitle(widget) || '',
                    fallbackValue: options.value,
                    trend: options.trend,
                    icon: options.icon,
                    description: options.description,
                    colorVariant: (widget as any).colorVariant,
                    format: options.format,
                    currency: options.currency,
                    prefix: options.prefix,
                    suffix: options.suffix,
                    drillDown: options.drillDown ?? { enabled: true },
                    title: options.label || tWidgetTitle(widget) || '',
                };
            }

            // gauge / solid-gauge with object binding → render as object-metric
            if ((widgetType === 'gauge' || widgetType === 'solid-gauge') && widget.object) {
                const aggregate = widget.aggregate ? {
                    field: widget.valueField || 'value',
                    function: widget.aggregate,
                    groupBy: widget.categoryField || '_all',
                } : undefined;
                return {
                    type: 'object-metric',
                    objectName: widget.object,
                    aggregate,
                    filter: widget.filter,
                    label: options.label || tWidgetTitle(widget) || '',
                    fallbackValue: options.fallbackValue ?? options.value,
                    icon: options.icon,
                    description: options.description,
                };
            }

            // 'horizontal-bar' uses BarChart with vertical layout; 'funnel' has its own renderer.
            const chartTypeMap: Record<string, string> = {};
            const resolvedWidgetType = chartTypeMap[widgetType] || widgetType;

            if (resolvedWidgetType === 'bar' || resolvedWidgetType === 'horizontal-bar' || resolvedWidgetType === 'line' || resolvedWidgetType === 'area' || resolvedWidgetType === 'pie' || resolvedWidgetType === 'donut' || resolvedWidgetType === 'scatter' || resolvedWidgetType === 'funnel') {
                // Support data at widget level or nested inside options
                const widgetData = (widget as any).data || options.data;
                // Widget-level fields (from config panel) override options-level fields
                const xAxisKey = widget.categoryField || options.xField || 'name';
                const yField = widget.valueField || options.yField || 'value';

                // provider: 'object' — delegate to ObjectChart for async data loading
                if (isObjectProvider(widgetData)) {
                    // Merge widget-level fields with data provider config.
                    // Widget-level fields take precedence so that config panel
                    // edits are immediately reflected in the live preview.
                    const providerAgg = widgetData.aggregate;
                    const effectiveAggregate = providerAgg ? {
                        field: widget.valueField || providerAgg.field,
                        function: widget.aggregate || providerAgg.function,
                        groupBy: widget.categoryField || providerAgg.groupBy,
                    } : undefined;
                    const effectiveYField = effectiveAggregate?.field || yField;
                    const objectForLabel = widget.object || widgetData.object;
                    return {
                        type: 'object-chart',
                        chartType: resolvedWidgetType,
                        objectName: objectForLabel,
                        aggregate: effectiveAggregate,
                        xAxisKey: xAxisKey,
                        series: [{
                            dataKey: effectiveYField,
                            label: objectForLabel ? fieldLabel(objectForLabel, effectiveYField, effectiveYField) : effectiveYField,
                        }],
                        colors: CHART_COLORS,
                        drillDown: options.drillDown ?? defaultChartDrill(resolvedWidgetType),
                        className: "h-[200px] sm:h-[250px] md:h-[300px]"
                    };
                }

                // No explicit data provider but widget has object binding
                // (e.g. newly created widget via config panel) — build object-chart
                if (!widgetData && widget.object) {
                    const aggregate = widget.aggregate ? {
                        field: widget.valueField || 'value',
                        function: widget.aggregate,
                        groupBy: widget.categoryField || 'name',
                    } : undefined;
                    const yKey = widget.valueField || 'value';
                    return {
                        type: 'object-chart',
                        chartType: resolvedWidgetType,
                        objectName: widget.object,
                        aggregate,
                        xAxisKey: xAxisKey,
                        series: [{ dataKey: yKey, label: fieldLabel(widget.object, yKey, yKey) }],
                        colors: CHART_COLORS,
                        drillDown: options.drillDown ?? defaultChartDrill(resolvedWidgetType),
                        className: "h-[200px] sm:h-[250px] md:h-[300px]"
                    };
                }

                const dataItems = Array.isArray(widgetData) ? widgetData : widgetData?.items || [];
                
                return {
                    type: 'chart',
                    chartType: resolvedWidgetType,
                    data: dataItems,
                    xAxisKey: xAxisKey,
                    series: [{
                        dataKey: yField,
                        label: widget.object ? fieldLabel(widget.object, yField, yField) : yField,
                    }],
                    colors: CHART_COLORS,
                    className: "h-[200px] sm:h-[250px] md:h-[300px]"
                };
            }

            if (widgetType === 'table') {
                // Support data at widget level or nested inside options
                const widgetData = (widget as any).data || options.data;

                // provider: 'object' — use ObjectDataTable for async data loading
                if (isObjectProvider(widgetData)) {
                    const { data: _data, ...restOptions } = options;
                    return {
                        type: 'object-data-table',
                        ...restOptions,
                        objectName: widget.object || widgetData.object,
                        dataProvider: widgetData,
                        filter: widgetData.filter || widget.filter,
                        searchable: widget.searchable ?? false,
                        pagination: widget.pagination ?? false,
                        className: "border-0"
                    };
                }

                // No explicit data provider but widget has object binding
                if (!widgetData && widget.object) {
                    return {
                        type: 'object-data-table',
                        ...options,
                        objectName: widget.object,
                        filter: widget.filter,
                        searchable: widget.searchable ?? false,
                        pagination: widget.pagination ?? false,
                        className: "border-0"
                    };
                }

                return {
                    type: 'data-table',
                    ...options,
                    data: widgetData?.items || [],
                    searchable: false,
                    pagination: false,
                    className: "border-0"
                };
            }

            if (widgetType === 'pivot') {
                const widgetData = (widget as any).data || options.data;
                // Pivot config can live either at widget top-level (when edited
                // through WidgetConfigPanel) or under widget.options (static
                // metadata).  Top-level wins so live edits are reflected.
                const w = widget as any;
                const pivotProps = {
                    rowField: w.rowField ?? options.rowField,
                    columnField: w.columnField ?? options.columnField,
                    valueField: w.valueField ?? options.valueField,
                    aggregation: w.aggregation ?? options.aggregation ?? 'sum',
                    showRowTotals: w.showRowTotals ?? options.showRowTotals,
                    showColumnTotals: w.showColumnTotals ?? options.showColumnTotals,
                    format: w.format ?? options.format,
                };

                // Phase-1 default-on policy: object-backed pivot tables enable
                // drill-down by default. Authors can disable explicitly with
                // `drillDown: { enabled: false }` on widget options. Static
                // (data-array) pivots stay opt-in because we cannot derive a
                // server-side filter for them.
                const isObjectPivot = isObjectProvider(widgetData) || (!widgetData && !!widget.object);
                const pivotOptions = (isObjectPivot && options.drillDown === undefined)
                    ? { ...options, drillDown: { enabled: true } }
                    : options;

                // provider: 'object' — use ObjectPivotTable for async data loading
                if (isObjectProvider(widgetData)) {
                    const { data: _data, ...restOptions } = pivotOptions;
                    return {
                        type: 'object-pivot',
                        ...restOptions,
                        ...pivotProps,
                        objectName: widget.object || widgetData.object,
                        dataProvider: widgetData,
                        filter: widgetData.filter || widget.filter,
                    };
                }

                // No explicit data provider but widget has object binding
                if (!widgetData && widget.object) {
                    return {
                        type: 'object-pivot',
                        ...pivotOptions,
                        ...pivotProps,
                        objectName: widget.object,
                        filter: widget.filter,
                    };
                }

                return {
                    type: 'pivot',
                    ...options,
                    ...pivotProps,
                    data: Array.isArray(widgetData) ? widgetData : widgetData?.items || [],
                };
            }

            // List widget — render as a compact rows-only data table.
            // List shares table semantics (raw records) but typically without
            // search / pagination chrome.
            if (widgetType === 'list') {
                const widgetData = (widget as any).data || options.data;

                if (isObjectProvider(widgetData)) {
                    const { data: _data, ...restOptions } = options;
                    return {
                        type: 'object-data-table',
                        ...restOptions,
                        objectName: widget.object || widgetData.object,
                        dataProvider: widgetData,
                        filter: widgetData.filter || widget.filter,
                        searchable: false,
                        pagination: false,
                        className: "border-0",
                    };
                }

                if (!widgetData && widget.object) {
                    return {
                        type: 'object-data-table',
                        ...options,
                        objectName: widget.object,
                        filter: widget.filter,
                        searchable: false,
                        pagination: false,
                        className: "border-0",
                    };
                }

                return {
                    type: 'data-table',
                    ...options,
                    data: Array.isArray(widgetData) ? widgetData : widgetData?.items || [],
                    searchable: false,
                    pagination: false,
                    className: "border-0",
                };
            }

            // Custom widget — caller must supply `widget.component` (a full
            // UIComponent schema).  When missing, render a friendly placeholder
            // instead of falling through (which produced 0×0 chart errors).
            if (widgetType === 'custom') {
                return {
                    type: 'text',
                    value: 'Custom widget — set `component` to a UIComponent schema.',
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
        
        const componentSchema = getComponentSchema();
        const isSelfContained = widget.type === 'metric';
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

        if (isSelfContained) {
            return (
                <div 
                    key={widgetKey}
                    className={cn("h-full w-full", designMode && "relative", selectionClasses)}
                    style={!isMobile && clampedLayout ? {
                        gridColumn: `span ${clampedLayout.w}`,
                        gridRow: `span ${clampedLayout.h}`
                    }: undefined}
                    {...designModeProps}
                >
                     <SchemaRenderer schema={componentSchema} className={cn("h-full w-full", designMode && "pointer-events-none")} dataSource={dataSource} />
                     {designMode && <div className="absolute inset-0 z-10" aria-hidden="true" data-testid="widget-click-overlay" />}
                </div>
            );
        }

        return (
            <Card
                key={widgetKey}
                className={cn(
                    "overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md",
                    "bg-card/50 backdrop-blur-sm",
                    forceMobileFullWidth && "w-full",
                    designMode && "relative",
                    selectionClasses
                )}
                style={!isMobile && clampedLayout ? {
                    gridColumn: `span ${clampedLayout.w}`,
                    gridRow: `span ${clampedLayout.h}`
                }: undefined}
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
                        <SchemaRenderer schema={componentSchema} dataSource={dataSource} />
                    </div>
                </CardContent>
                {designMode && <div className="absolute inset-0 z-10" aria-hidden="true" data-testid="widget-click-overlay" />}
            </Card>
        );
    };

    const headerSection = schema.header && (
      <div className="col-span-full mb-4">
        {schema.header.showTitle !== false && schema.title && (
          <h2 className="text-lg font-semibold tracking-tight">
            {dashName
              ? dashboardLabel({ name: dashName, label: resolveLabel(schema.title) })
              : resolveLabel(schema.title)}
          </h2>
        )}
        {schema.header.showDescription !== false && schema.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {dashName
              ? dashboardDescription({ name: dashName, description: resolveLabel(schema.description) })
              : resolveLabel(schema.description)}
          </p>
        )}
        {schema.header.actions && schema.header.actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {schema.header.actions.map((action: { label: string; actionUrl?: string; actionType?: string; icon?: string }, i: number) => {
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
                if (actionType === 'modal' || actionType === 'script') {
                  const result = await executeAction(actionUrl || label);
                  if (!result?.success) console.warn('[DashboardRenderer] action failed', result?.error);
                  return;
                }
                console.warn(`[DashboardRenderer] Unknown header actionType="${actionType}" for "${label}"`);
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

    const recordCountBadge = recordCount !== undefined && (
      <span className="text-xs text-muted-foreground">
        {recordCount.toLocaleString()} records
      </span>
    );

    const userActionsAttr = userActions ? JSON.stringify(userActions) : undefined;

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

    if (isMobile) {
      // Separate metric widgets from other widgets for better mobile layout
      const metricWidgets = schema.widgets?.filter((w: DashboardWidgetSchema) => w.type === 'metric') || [];
      const otherWidgets = schema.widgets?.filter((w: DashboardWidgetSchema) => w.type !== 'metric') || [];
      
      return (
        <div ref={ref} className={cn("flex flex-col gap-4 px-4", className)} data-user-actions={userActionsAttr} onClick={handleBackgroundClick} {...props}>
          {headerSection}
          {refreshButton}
          
          {/* Metric cards: 2-column grid */}
          {metricWidgets.length > 0 && (
            <div className="grid grid-cols-2 gap-3" onClick={handleBackgroundClick}>
              {metricWidgets.map((widget: DashboardWidgetSchema, index: number) => renderWidget(widget, index))}
            </div>
          )}
          
          {/* Other widgets (charts, tables): full-width vertical stack */}
          {otherWidgets.length > 0 && (
            <div className="flex flex-col gap-4" onClick={handleBackgroundClick}>
              {otherWidgets.map((widget: DashboardWidgetSchema, index: number) => renderWidget(widget, index, true))}
            </div>
          )}
        </div>
      );
    }

    const hasExplicitColumns = schema.columns != null || inferredColumns !== 4;

    return (
      <div
        ref={ref}
        className={cn(
          "grid auto-rows-min",
          !hasExplicitColumns && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          className
        )}
        style={{
            ...(hasExplicitColumns && { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }),
            gap: `${gap * 0.25}rem`
        }}
        data-user-actions={userActionsAttr}
        onClick={handleBackgroundClick}
        {...props}
      >
        {headerSection}
        {refreshButton}
        {schema.widgets?.map((widget: DashboardWidgetSchema, index: number) => renderWidget(widget, index))}
      </div>
    );
  }
);
