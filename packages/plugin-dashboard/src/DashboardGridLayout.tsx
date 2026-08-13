import * as React from 'react';
import { ResponsiveGridLayout, useContainerWidth, type LayoutItem as RGLLayout, type Layout, type ResponsiveLayouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { cn, Card, CardHeader, CardTitle, CardContent, Button } from '@object-ui/components';
import { Edit, GripVertical, Save, X, RefreshCw } from 'lucide-react';
import { SchemaRenderer, useHasDndProvider, useDnd } from '@object-ui/react';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import type { BaseSchema, DashboardComponentSchema, DashboardWidgetSchema } from '@object-ui/types';
import { isObjectProvider } from './utils';
import { classifyWidgetType } from './widgetDispatch';

/** Bridges editMode transitions to the ObjectUI DnD system when a DndProvider is present. */
function DndEditModeBridge({ editMode }: { editMode: boolean }) {
  const dnd = useDnd();

  React.useEffect(() => {
    if (editMode) {
      dnd.startDrag({ id: 'dashboard-layout', type: 'dashboard-widget', data: {} });
      return () => { dnd.endDrag(); };
    } else {
      dnd.endDrag('dashboard');
    }
  }, [editMode, dnd]);

  return null;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export interface DashboardGridLayoutProps {
  schema: DashboardComponentSchema;
  className?: string;
  /**
   * Fires on every drag/resize tick with the raw react-grid-layout payload.
   * Useful for live previews; NOT a persistence hook.
   */
  onLayoutChange?: (layout: RGLLayout[]) => void;
  /**
   * Canonical persistence hook. When the user clicks "Save Layout", the
   * grid coordinates are merged back into `schema.widgets[].layout` and the
   * resulting `DashboardSchema` is passed to this callback. The parent is
   * expected to forward it to its data adapter (e.g. `client.meta.saveItem`).
   *
   * If omitted, layout edits stay in memory only — the component does not
   * persist to localStorage or anywhere else (per Rule #1 Protocol Agnostic:
   * persistence is the parent's responsibility, not the renderer's).
   */
  onSchemaChange?: (schema: DashboardComponentSchema) => void;
  /** Callback invoked when dashboard refresh is triggered (manual or auto) */
  onRefresh?: () => void;
}

/** Merge react-grid-layout coordinates back into a DashboardSchema's widgets. */
export function mergeLayoutIntoSchema(
  schema: DashboardComponentSchema,
  layout: RGLLayout[],
): DashboardComponentSchema {
  if (!schema.widgets?.length) return schema;
  const byId = new Map(layout.map((l) => [l.i, l]));
  const widgets = schema.widgets.map((w, index) => {
    const id = w.id || `widget-${index}`;
    const l = byId.get(id);
    if (!l) return w;
    return {
      ...w,
      layout: { x: l.x, y: l.y, w: l.w, h: l.h },
    };
  });
  return { ...schema, widgets };
}

function buildDefaultLayouts(schema: DashboardComponentSchema): { lg: RGLLayout[] } {
  return {
    lg: schema.widgets?.map((widget: DashboardWidgetSchema, index: number) => ({
      i: widget.id || `widget-${index}`,
      x: widget.layout?.x ?? (index % 4) * 3,
      y: widget.layout?.y ?? Math.floor(index / 4) * 4,
      w: widget.layout?.w ?? 3,
      h: widget.layout?.h ?? 4,
    })) || [],
  };
}

export const DashboardGridLayout: React.FC<DashboardGridLayoutProps> = ({
  schema,
  className,
  onLayoutChange,
  onSchemaChange,
  onRefresh,
}) => {
  const { width, containerRef, mounted } = useContainerWidth();
  const [editMode, setEditMode] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const hasDndProvider = useHasDndProvider();
  // Active UI language, for resolving inline per-locale widget titles below.
  // `useObjectTranslation` is provider-safe (react-i18next falls back to its
  // global instance and never throws), so a standalone grid still renders.
  const { language } = useObjectTranslation();
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = React.useCallback(() => {
    if (!onRefresh) return;
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [onRefresh]);

  // Auto-refresh interval
  React.useEffect(() => {
    if (!schema.refreshInterval || schema.refreshInterval <= 0 || !onRefresh) return;
    intervalRef.current = setInterval(handleRefresh, schema.refreshInterval * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [schema.refreshInterval, onRefresh, handleRefresh]);
  const [layouts, setLayouts] = React.useState<{ lg: RGLLayout[] }>(
    () => buildDefaultLayouts(schema),
  );

  // Re-derive layouts whenever the underlying schema changes (e.g. parent
  // re-fetches after a save, widgets are added/removed). Previously the
  // useState initializer ran once and the grid drifted from the schema.
  const widgetsSignature = React.useMemo(
    () => JSON.stringify(schema.widgets?.map((w, i) => ({
      i: w.id || `widget-${i}`,
      x: w.layout?.x, y: w.layout?.y, w: w.layout?.w, h: w.layout?.h,
    })) ?? []),
    [schema.widgets],
  );
  React.useEffect(() => {
    setLayouts(buildDefaultLayouts(schema));
    // widgetsSignature captures the only fields we care about for re-sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetsSignature]);

  const handleLayoutChange = React.useCallback(
    (layout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts as { lg: RGLLayout[] });
      onLayoutChange?.(layout as RGLLayout[]);
    },
    [onLayoutChange]
  );

  const handleSaveLayout = React.useCallback(() => {
    // Hand the merged schema back to the parent so it can persist via its
    // injected data adapter (server / file / etc.). If no handler is wired,
    // edits live only in component state — warn in dev so the integrator
    // knows to wire `onSchemaChange`.
    if (onSchemaChange) {
      onSchemaChange(mergeLayoutIntoSchema(schema, layouts.lg));
    } else {
      // Dev-time hint (process may not exist in pure browser bundles, hence the guard).
      const g = globalThis as { process?: { env?: { NODE_ENV?: string } } };
      if (g.process?.env?.NODE_ENV !== 'production') {
        console.warn(
          '[DashboardGridLayout] Layout edits are in-memory only. ' +
          'Wire `onSchemaChange` to persist via your data adapter.'
        );
      }
    }
    setEditMode(false);
  }, [onSchemaChange, schema, layouts]);

  const handleResetLayout = React.useCallback(() => {
    setLayouts(buildDefaultLayouts(schema));
  }, [schema]);

  const getComponentSchema = React.useCallback((widget: DashboardWidgetSchema) => {
    if (widget.component) return widget.component;

    const widgetType = widget.type;
    const options = (widget.options || {}) as Record<string, any>;
    // One shared classification (./widgetDispatch) — this surface used to name
    // 8 chart families by hand while DatasetWidget covered all 19, so radar /
    // treemap / sankey and the single-value families fell through to a red
    // "Unknown component type" box (#2943).
    const dispatch = classifyWidgetType(widgetType);
    if (dispatch.family === 'series' && dispatch.chartType) {
      const widgetData = (widget as any).data || options.data;
      const xAxisKey = options.xField || 'name';
      const yField = options.yField || 'value';

      // provider: 'object' — delegate to ObjectChart for async data loading.
      // Field/aggregate config comes from the nested data provider (the
      // pre-ADR-0021 top-level analytics keys were retired in framework#3320).
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
          chartType: dispatch.chartType,
          objectName: widgetData.object,
          aggregate: effectiveAggregate,
          xAxisKey: xAxisKey,
          series: [{ dataKey: effectiveYField }],
          colors: CHART_COLORS,
          // Deterministic first paint inside the grid (#2756).
          isAnimationActive: false,
          className: "h-full"
        };
      }

      const dataItems = Array.isArray(widgetData) ? widgetData : widgetData?.items || [];

      return {
        type: 'chart',
        chartType: dispatch.chartType,
        data: dataItems,
        xAxisKey: xAxisKey,
        series: [{ dataKey: yField }],
        colors: CHART_COLORS,
        // Deterministic first paint inside the grid (#2756).
        isAnimationActive: false,
        className: "h-full"
      };
    }

    // Single-value families render as a metric card, not a chart (#2943).
    if (dispatch.family === 'metric') {
      const widgetData = (widget as any).data || options.data;
      const label = widget.title || widgetType;
      if (isObjectProvider(widgetData)) {
        const providerAgg = widgetData.aggregate;
        return {
          type: 'object-metric',
          ...options,
          objectName: widgetData.object,
          label,
          aggregate: providerAgg ? {
            field: providerAgg.field,
            function: providerAgg.function,
            groupBy: providerAgg.groupBy,
          } : undefined,
          filter: widgetData.filter || widget.filter,
        };
      }
      const rows = Array.isArray(widgetData) ? widgetData : widgetData?.items || [];
      const valueField = options.yField || 'value';
      return {
        type: 'metric',
        ...options,
        label,
        value: options.value ?? rows[0]?.[valueField] ?? '—',
      };
    }

    if (dispatch.family === 'table') {
      const widgetData = (widget as any).data || options.data;

      // provider: 'object' — pass through object config for async data loading
      if (isObjectProvider(widgetData)) {
        const { data: _data, ...restOptions } = options;
        return {
          type: 'data-table',
          ...restOptions,
          objectName: widgetData.object,
          dataProvider: widgetData,
          data: [],
          searchable: false,
          pagination: false,
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

    if (dispatch.family === 'pivot') {
      const widgetData = (widget as any).data || options.data;

      // provider: 'object' — pass through object config for async data loading
      if (isObjectProvider(widgetData)) {
        const { data: _data, ...restOptions } = options;
        return {
          type: 'pivot',
          ...restOptions,
          objectName: widgetData.object,
          dataProvider: widgetData,
          data: [],
        };
      }

      return {
        type: 'pivot',
        ...options,
        data: Array.isArray(widgetData) ? widgetData : widgetData?.items || [],
      };
    }

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
  }, []);

  return (
    <div ref={containerRef} className={cn("w-full", className)} data-testid="grid-layout">
      {hasDndProvider && <DndEditModeBridge editMode={editMode} />}
      <div className="mb-4 flex items-center justify-between">
        {/*
          `schema.label` accepts the spec's INLINE locale map since objectui#4580's
          revised Q1-A ruling, and rendering the map straight into this text node
          THREW "Objects are not valid as a React child (found: object with keys
          {en, zh-CN})". Resolved with `pickLocalized` against the ACTIVE UI
          LANGUAGE, matching the widget-title resolution ~70 lines below rather
          than introducing a second resolver and a second locale channel into one
          component: `pickLocalized` is objectui's limb-for-limb twin of the spec's
          `resolveI18nLabel` (objectstack#6765), differing only in how it spells a
          miss (`''` vs `undefined`) — pinned in
          `plugin-list/src/__tests__/i18nLabel-resolver-parity.test.ts`. The `||`
          chain is preserved exactly: a miss yields `''`, which is falsy, so
          `'Dashboard'` still backstops it.
        */}
        <h2 className="text-2xl font-bold">
          {schema.title || pickLocalized(schema.label, language) || 'Dashboard'}
        </h2>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button onClick={handleSaveLayout} size="sm" variant="default">
                <Save className="h-4 w-4 mr-2" />
                Save Layout
              </Button>
              <Button onClick={handleResetLayout} size="sm" variant="outline">
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={() => setEditMode(false)} size="sm" variant="ghost">
                Cancel
              </Button>
            </>
          ) : (
            <>
              {onRefresh && (
                <Button
                  onClick={handleRefresh}
                  size="sm"
                  variant="outline"
                  disabled={refreshing}
                  aria-label="Refresh dashboard"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                  {refreshing ? 'Refreshing…' : 'Refresh All'}
                </Button>
              )}
              <Button onClick={() => setEditMode(true)} size="sm" variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Layout
              </Button>
            </>
          )}
        </div>
      </div>

      {mounted && (
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          dragConfig={{ enabled: editMode, handle: ".drag-handle" }}
          resizeConfig={{ enabled: editMode }}
          onLayoutChange={handleLayoutChange}
        >
          {schema.widgets?.map((widget, index) => {
            const widgetId = widget.id || `widget-${index}`;
            // `getComponentSchema` builds a node for `SchemaRenderer` in every
            // branch, but its inferred union is wider than the renderer's
            // declared input: the passthrough fallback spreads a
            // `DashboardWidgetSchema` whose `type` is OPTIONAL, and the metric
            // branches carry `widget.title`'s `I18nLabel` where `BaseSchema`
            // declares a plain `string`. Both are pre-existing looseness in the
            // widget types rather than anything this call site can state
            // truthfully, so the narrowing is named here once (objectui#4548)
            // instead of being spread across the two render sites below.
            const componentSchema = getComponentSchema(widget) as BaseSchema | string | null | undefined;
            const isSelfContained = widget.type === 'metric';
            // `DashboardWidget.title` is the spec's `I18nLabel`: since
            // 17.0.0-rc.6 an author may inline a per-locale map
            // (`{ en: 'Pipeline', 'zh-CN': '销售漏斗' }`) instead of a string.
            // Resolve it for the active UI language before it reaches the
            // `title` attribute (a `string` slot) and the card heading (a text
            // node) — both of which stringify a map to `[object Object]`.
            const widgetTitle = pickLocalized(widget.title, language);

            return (
              <div key={widgetId} className="h-full">
                {isSelfContained ? (
                  <div className="h-full w-full relative">
                    {editMode && (
                      <div className="drag-handle absolute top-2 right-2 z-10 cursor-move p-1 bg-background/80 rounded border border-border">
                        <GripVertical className="h-4 w-4" />
                      </div>
                    )}
                    <SchemaRenderer schema={componentSchema} className="h-full w-full" />
                  </div>
                ) : (
                  <Card className={cn(
                    "h-full overflow-hidden border-border/50 shadow-sm transition-all",
                    "bg-card/50 backdrop-blur-sm",
                    editMode && "ring-2 ring-primary/20"
                  )}>
                    {widgetTitle && (
                      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-medium tracking-tight truncate" title={widgetTitle}>
                          {widgetTitle}
                        </CardTitle>
                        {editMode && (
                          <div className="drag-handle cursor-move p-1 hover:bg-muted/40 rounded">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        )}
                      </CardHeader>
                    )}
                    <CardContent className="p-0 h-full">
                      <div className={cn("h-full w-full overflow-auto p-4")}>
                        <SchemaRenderer schema={componentSchema} />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}
    </div>
  );
};
