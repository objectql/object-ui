import * as React from 'react';
import { ResponsiveGridLayout, useContainerWidth, type LayoutItem as RGLLayout, type Layout, type ResponsiveLayouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { cn, Card, CardHeader, CardTitle, CardContent, Button } from '@object-ui/components';
import { Edit, GripVertical, Save, X, RefreshCw } from 'lucide-react';
import { SchemaRenderer, useHasDndProvider, useDnd } from '@object-ui/react';
import type { DashboardSchema, DashboardWidgetSchema } from '@object-ui/types';
import { isObjectProvider } from './utils';

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
  schema: DashboardSchema;
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
  onSchemaChange?: (schema: DashboardSchema) => void;
  /** Callback invoked when dashboard refresh is triggered (manual or auto) */
  onRefresh?: () => void;
}

/** Merge react-grid-layout coordinates back into a DashboardSchema's widgets. */
export function mergeLayoutIntoSchema(
  schema: DashboardSchema,
  layout: RGLLayout[],
): DashboardSchema {
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

function buildDefaultLayouts(schema: DashboardSchema): { lg: RGLLayout[] } {
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
    if (widgetType === 'bar' || widgetType === 'horizontal-bar' || widgetType === 'line' || widgetType === 'area' || widgetType === 'pie' || widgetType === 'donut' || widgetType === 'scatter' || widgetType === 'funnel') {
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
        return {
          type: 'object-chart',
          chartType: widgetType,
          objectName: widget.object || widgetData.object,
          aggregate: effectiveAggregate,
          xAxisKey: xAxisKey,
          series: [{ dataKey: effectiveYField }],
          colors: CHART_COLORS,
          className: "h-full"
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
        return {
          type: 'object-chart',
          chartType: widgetType,
          objectName: widget.object,
          aggregate,
          xAxisKey: xAxisKey,
          series: [{ dataKey: widget.valueField || 'value' }],
          colors: CHART_COLORS,
          className: "h-full"
        };
      }

      const dataItems = Array.isArray(widgetData) ? widgetData : widgetData?.items || [];
      
      return {
        type: 'chart',
        chartType: widgetType,
        data: dataItems,
        xAxisKey: xAxisKey,
        series: [{ dataKey: yField }],
        colors: CHART_COLORS,
        className: "h-full"
      };
    }

    if (widgetType === 'table') {
      const widgetData = (widget as any).data || options.data;

      // provider: 'object' — pass through object config for async data loading
      if (isObjectProvider(widgetData)) {
        const { data: _data, ...restOptions } = options;
        return {
          type: 'data-table',
          ...restOptions,
          objectName: widget.object || widgetData.object,
          dataProvider: widgetData,
          data: [],
          searchable: false,
          pagination: false,
          className: "border-0"
        };
      }

      // No explicit data provider but widget has object binding
      if (!widgetData && widget.object) {
        return {
          type: 'data-table',
          ...options,
          objectName: widget.object,
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

    if (widgetType === 'pivot') {
      const widgetData = (widget as any).data || options.data;

      // provider: 'object' — pass through object config for async data loading
      if (isObjectProvider(widgetData)) {
        const { data: _data, ...restOptions } = options;
        return {
          type: 'pivot',
          ...restOptions,
          objectName: widget.object || widgetData.object,
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

    return {
      ...widget,
      ...options
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("w-full", className)} data-testid="grid-layout">
      {hasDndProvider && <DndEditModeBridge editMode={editMode} />}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{schema.title || schema.label || 'Dashboard'}</h2>
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
            const componentSchema = getComponentSchema(widget);
            const isSelfContained = widget.type === 'metric';

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
                    {widget.title && (
                      <CardHeader className="pb-2 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-medium tracking-tight truncate" title={widget.title}>
                          {widget.title}
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
