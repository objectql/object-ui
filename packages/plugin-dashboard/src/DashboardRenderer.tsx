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
  [key: string]: any;
}

export const DashboardRenderer = forwardRef<HTMLDivElement, DashboardRendererProps>(
  ({ schema, className, dataSource, onRefresh, ...props }, ref) => {
    const columns = schema.columns || 4; // Default to 4 columns for better density
    const gap = schema.gap || 4;
    const [refreshing, setRefreshing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 640);
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

    const renderWidget = (widget: DashboardWidgetSchema) => {
        const getComponentSchema = () => {
            if (widget.component) return widget.component;

            // Handle Shorthand Registry Mappings
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
                    className: "h-[200px] sm:h-[250px] md:h-[300px]"
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

            return {
                ...widget,
                ...((widget as any).options || {})
            };
        };
        
        const componentSchema = getComponentSchema();
        const isSelfContained = (widget as any).type === 'metric';

        if (isSelfContained) {
            return (
                <div 
                    key={widget.id || widget.title}
                    className={cn("h-full w-full", isMobile && "w-[85vw] shrink-0 snap-center")}
                    style={!isMobile && widget.layout ? {
                        gridColumn: `span ${widget.layout.w}`,
                        gridRow: `span ${widget.layout.h}`
                    }: undefined}
                >
                     <SchemaRenderer schema={componentSchema} className="h-full w-full" />
                </div>
            );
        }

        return (
            <Card 
                key={widget.id || widget.title}
                className={cn(
                    "overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md",
                    "bg-card/50 backdrop-blur-sm",
                    isMobile && "w-[85vw] shrink-0 snap-center"
                )}
                style={!isMobile && widget.layout ? {
                    gridColumn: `span ${widget.layout.w}`,
                    gridRow: `span ${widget.layout.h}`
                }: undefined}
            >
                {widget.title && (
                    <CardHeader className="pb-2 border-b border-border/40 bg-muted/20 px-3 sm:px-6">
                        <CardTitle className="text-sm sm:text-base font-medium tracking-tight truncate" title={widget.title}>
                            {widget.title}
                        </CardTitle>
                    </CardHeader>
                )}
                <CardContent className="p-0">
                    <div className={cn("h-full w-full", "p-3 sm:p-4 md:p-6")}>
                        <SchemaRenderer schema={componentSchema} />
                    </div>
                </CardContent>
            </Card>
        );
    };

    const refreshButton = onRefresh && (
      <div className={cn(isMobile ? "flex justify-end mb-2" : "col-span-full flex justify-end mb-2")}>
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
      return (
        <div ref={ref} className={cn("flex flex-col", className)} {...props}>
          {refreshButton}
          <div
            className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 [-webkit-overflow-scrolling:touch]"
            style={{ scrollPaddingLeft: '0.75rem' }}
          >
            {schema.widgets?.map((widget: DashboardWidgetSchema) => renderWidget(widget))}
          </div>
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
        {...props}
      >
        {refreshButton}
        {schema.widgets?.map((widget: DashboardWidgetSchema) => renderWidget(widget))}
      </div>
    );
  }
);
