import * as React from 'react';
import { ResponsiveGridLayout, useContainerWidth, type LayoutItem as RGLLayout, type Layout, type ResponsiveLayouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { cn, Card, CardHeader, CardTitle, CardContent, Button } from '@object-ui/components';
import { Edit, GripVertical, Save, X } from 'lucide-react';
import { SchemaRenderer } from '@object-ui/react';
import type { DashboardSchema, DashboardWidgetSchema } from '@object-ui/types';

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
}

export const DashboardGridLayout: React.FC<DashboardGridLayoutProps> = ({
  schema,
  className,
  onLayoutChange,
  persistLayoutKey = 'dashboard-layout',
}) => {
  const { width, containerRef, mounted } = useContainerWidth();
  const [editMode, setEditMode] = React.useState(false);
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

    const widgetType = (widget as any).type;
    if (widgetType === 'bar' || widgetType === 'line' || widgetType === 'area' || widgetType === 'pie' || widgetType === 'donut') {
      const dataItems = Array.isArray((widget as any).data) ? (widget as any).data : (widget as any).data?.items || [];
      const options = (widget as any).options || {};
      const xAxisKey = options.xField || 'name';
      const yField = options.yField || 'value';
      
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
      return {
        type: 'data-table',
        ...(widget as any).options,
        data: (widget as any).data?.items || [],
        searchable: false,
        pagination: false,
        className: "border-0"
      };
    }

    return widget;
  }, []);

  return (
    <div ref={containerRef} className={cn("w-full", className)} data-testid="grid-layout">
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
            <Button onClick={() => setEditMode(true)} size="sm" variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit Layout
            </Button>
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
            const isSelfContained = (widget as any).type === 'metric';

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
                      <div className={cn("h-full w-full overflow-auto", !widget.title ? "p-4" : "p-4")}>
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
