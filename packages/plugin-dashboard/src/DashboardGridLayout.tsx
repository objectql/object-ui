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
  onLayoutChange?: (layout: RGLLayout[]) => void;
  persistLayoutKey?: string;
  /** Callback invoked when dashboard refresh is triggered (manual or auto) */
  onRefresh?: () => void;
}

export const DashboardGridLayout: React.FC<DashboardGridLayoutProps> = ({
  schema,
  className,
  onLayoutChange,
  persistLayoutKey = 'dashboard-layout',
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
  const [layouts, setLayouts] = React.useState<{ lg: RGLLayout[] }>(() => {
    // Try to load saved layout
    if (typeof window !== 'undefined' && persistLayoutKey) {
      const saved = localStorage.getItem(persistLayoutKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved layout:', e);
        }
      }
    }

    // Default layout from schema
    return {
      lg: schema.widgets?.map((widget: DashboardWidgetSchema, index: number) => ({
        i: widget.id || `widget-${index}`,
        x: widget.layout?.x || (index % 4) * 3,
        y: widget.layout?.y || Math.floor(index / 4) * 4,
        w: widget.layout?.w || 3,
        h: widget.layout?.h || 4,
      })) || [],
    };
  });

  const handleLayoutChange = React.useCallback(
    (layout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts as { lg: RGLLayout[] });
      onLayoutChange?.(layout as RGLLayout[]);
    },
    [onLayoutChange]
  );

  const handleSaveLayout = React.useCallback(() => {
    if (typeof window !== 'undefined' && persistLayoutKey) {
      localStorage.setItem(persistLayoutKey, JSON.stringify(layouts));
    }
    setEditMode(false);
  }, [layouts, persistLayoutKey]);

  const handleResetLayout = React.useCallback(() => {
    const defaultLayouts = {
      lg: schema.widgets?.map((widget: DashboardWidgetSchema, index: number) => ({
        i: widget.id || `widget-${index}`,
        x: widget.layout?.x || (index % 4) * 3,
        y: widget.layout?.y || Math.floor(index / 4) * 4,
        w: widget.layout?.w || 3,
        h: widget.layout?.h || 4,
      })) || [],
    };
    setLayouts(defaultLayouts);
    if (typeof window !== 'undefined' && persistLayoutKey) {
      localStorage.removeItem(persistLayoutKey);
    }
  }, [schema.widgets, persistLayoutKey]);

  const getComponentSchema = React.useCallback((widget: DashboardWidgetSchema) => {
    if (widget.component) return widget.component;

    const widgetType = widget.type;
    const options = (widget.options || {}) as Record<string, any>;
    if (widgetType === 'bar' || widgetType === 'line' || widgetType === 'area' || widgetType === 'pie' || widgetType === 'donut' || widgetType === 'scatter') {
      const widgetData = (widget as any).data || options.data;
      const xAxisKey = options.xField || 'name';
      const yField = options.yField || 'value';

      // provider: 'object' — delegate to ObjectChart for async data loading
      if (isObjectProvider(widgetData)) {
        const effectiveYField = widgetData.aggregate?.field || yField;
        return {
          type: 'object-chart',
          chartType: widgetType,
          objectName: widgetData.object || widget.object,
          aggregate: widgetData.aggregate,
          xAxisKey: xAxisKey,
          series: [{ dataKey: effectiveYField }],
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
          objectName: widgetData.object || widget.object,
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

    if (widgetType === 'pivot') {
      const widgetData = (widget as any).data || options.data;

      // provider: 'object' — pass through object config for async data loading
      if (isObjectProvider(widgetData)) {
        const { data: _data, ...restOptions } = options;
        return {
          type: 'pivot',
          ...restOptions,
          objectName: widgetData.object || widget.object,
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
        <h2 className="text-2xl font-bold">{schema.title || 'Dashboard'}</h2>
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
