/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DashboardSchema, DashboardWidgetSchema } from '@object-ui/types';
import { SchemaRenderer } from '@object-ui/react';
import { cn, Card, CardHeader, CardTitle, CardContent, Button } from '@object-ui/components';
import { forwardRef, useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

// Color palette for charts
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

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
  [key: string]: any;
}

export const DashboardRenderer = forwardRef<HTMLDivElement, DashboardRendererProps>(
  ({ schema, className, dataSource, onRefresh, recordCount, userActions, designMode, selectedWidgetId, onWidgetClick, ...props }, ref) => {
    const columns = schema.columns || 4; // Default to 4 columns for better density
    const gap = schema.gap || 4;
    const [refreshing, setRefreshing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        const getComponentSchema = () => {
            if (widget.component) return widget.component;

            // Handle Shorthand Registry Mappings
            const widgetType = widget.type;
            const options = (widget.options || {}) as Record<string, any>;
            if (widgetType === 'bar' || widgetType === 'line' || widgetType === 'area' || widgetType === 'pie' || widgetType === 'donut') {
                // Support data at widget level or nested inside options
                const widgetData = (widget as any).data || options.data;
                const xAxisKey = options.xField || 'name';
                const yField = options.yField || 'value';

                // provider: 'object' — delegate to ObjectChart for async data loading
                if (widgetData && typeof widgetData === 'object' && !Array.isArray(widgetData) && widgetData.provider === 'object') {
                    return {
                        type: 'object-chart',
                        chartType: widgetType,
                        objectName: widgetData.object || widget.object,
                        aggregate: widgetData.aggregate,
                        xAxisKey: xAxisKey,
                        series: [{ dataKey: yField }],
                        colors: CHART_COLORS,
                        className: "h-[200px] sm:h-[250px] md:h-[300px]"
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
                    className: "h-[200px] sm:h-[250px] md:h-[300px]"
                };
            }

            if (widgetType === 'table') {
                // Support data at widget level or nested inside options
                const widgetData = (widget as any).data || options.data;

                // provider: 'object' — pass through object config for async data loading
                if (widgetData && typeof widgetData === 'object' && !Array.isArray(widgetData) && widgetData.provider === 'object') {
                    return {
                        type: 'data-table',
                        ...options,
                        objectName: widgetData.object || widget.object,
                        dataProvider: widgetData,
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
                if (widgetData && typeof widgetData === 'object' && !Array.isArray(widgetData) && widgetData.provider === 'object') {
                    return {
                        type: 'pivot',
                        ...options,
                        objectName: widgetData.object || widget.object,
                        dataProvider: widgetData,
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
        };
        
        const componentSchema = getComponentSchema();
        const isSelfContained = widget.type === 'metric';
        const widgetKey = widget.id || widget.title || `widget-${index}`;
        const isSelected = designMode && selectedWidgetId === widget.id;

        const designModeProps = designMode ? {
            'data-testid': `dashboard-preview-widget-${widget.id}`,
            'data-widget-id': widget.id,
            role: 'button' as const,
            tabIndex: 0,
            'aria-selected': isSelected,
            'aria-label': `Widget: ${widget.title || `Widget ${index + 1}`}`,
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
                    style={!isMobile && widget.layout ? {
                        gridColumn: `span ${widget.layout.w}`,
                        gridRow: `span ${widget.layout.h}`
                    }: undefined}
                    {...designModeProps}
                >
                     <SchemaRenderer schema={componentSchema} className={cn("h-full w-full", designMode && "pointer-events-none")} />
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
                style={!isMobile && widget.layout ? {
                    gridColumn: `span ${widget.layout.w}`,
                    gridRow: `span ${widget.layout.h}`
                }: undefined}
                {...designModeProps}
            >
                {widget.title && (
                    <CardHeader className="pb-2 border-b border-border/40 bg-muted/20 px-3 sm:px-6">
                        <CardTitle className="text-sm sm:text-base font-medium tracking-tight truncate" title={widget.title}>
                            {widget.title}
                        </CardTitle>
                    </CardHeader>
                )}
                <CardContent className="p-0">
                    <div className={cn("h-full w-full", "p-3 sm:p-4 md:p-6", designMode && "pointer-events-none")}>
                        <SchemaRenderer schema={componentSchema} />
                    </div>
                </CardContent>
                {designMode && <div className="absolute inset-0 z-10" aria-hidden="true" data-testid="widget-click-overlay" />}
            </Card>
        );
    };

    const headerSection = schema.header && (
      <div className="col-span-full mb-4">
        {schema.header.showTitle !== false && schema.title && (
          <h2 className="text-lg font-semibold tracking-tight">{schema.title}</h2>
        )}
        {schema.header.showDescription !== false && schema.description && (
          <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>
        )}
        {schema.header.actions && schema.header.actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {schema.header.actions.map((action: { label: string; actionUrl?: string; actionType?: string; icon?: string }, i: number) => (
              <Button key={i} variant="outline" size="sm">
                {action.label}
              </Button>
            ))}
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

    return (
      <div
        ref={ref}
        className={cn(
          "grid auto-rows-min",
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          className
        )}
        style={{
            ...(columns > 4 && { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }),
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
