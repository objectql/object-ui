/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DashboardSchema, DashboardWidgetSchema } from '@object-ui/types';
import { SchemaRenderer } from '@object-ui/react';
import { cn, Card, CardHeader, CardTitle, CardContent } from '@object-ui/components';
import { forwardRef, useMemo } from 'react';

// Color palette for charts
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const DashboardRenderer = forwardRef<HTMLDivElement, { schema: DashboardSchema; className?: string; [key: string]: any }>(
  ({ schema, className, ...props }, ref) => {
    const columns = schema.columns || 4; // Default to 4 columns for better density
    const gap = schema.gap || 4;

    return (
      <div 
        ref={ref} 
        className={cn("grid auto-rows-min", className)} 
        style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: `${gap * 0.25}rem`
        }}
        {...props}
      >
        {schema.widgets?.map((widget: DashboardWidgetSchema) => {
            // Logic to determine what to render
            // Supports both Component Schema (widget.component) and Shorthand (widget.type)
            
            const componentSchema = useMemo(() => {
                if (widget.component) return widget.component;

                // Handle Shorthand Registry Mappings
                const widgetType = (widget as any).type;
                if (widgetType === 'bar' || widgetType === 'line' || widgetType === 'area' || widgetType === 'pie' || widgetType === 'donut') {
                    // Extract data from 'data.items' or 'data' array
                    const dataItems = Array.isArray((widget as any).data) ? (widget as any).data : (widget as any).data?.items || [];
                    
                    // Map xField/yField to ChartRenderer expectations
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
                        className: "h-[300px]" // Enforce height
                    };
                }

                if (widgetType === 'table') {
                    // Map to ObjectGrid
                    return {
                        type: 'data-table',
                        ...(widget as any).options,
                        data: (widget as any).data?.items || [],
                        searchable: false, // Simple table for dashboard
                        pagination: false,
                        className: "border-0"
                    };
                }

                return widget; // Fallback to widget itself as schema
            }, [widget]);

            // Check if the widget is self-contained (like a Metric Card) to avoid double borders
            const isSelfContained = (widget as any).type === 'metric';

            if (isSelfContained) {
                return (
                    <div 
                        key={widget.id || widget.title}
                        className="h-full w-full"
                        style={widget.layout ? {
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
                        "bg-card/50 backdrop-blur-sm"
                    )}
                    style={widget.layout ? {
                        gridColumn: `span ${widget.layout.w}`,
                        gridRow: `span ${widget.layout.h}`
                    }: undefined}
                >
                    {widget.title && (
                        <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
                            <CardTitle className="text-base font-medium tracking-tight truncate" title={widget.title}>
                                {widget.title}
                            </CardTitle>
                        </CardHeader>
                    )}
                    <CardContent className="p-0">
                        <div className={cn("h-full w-full", !widget.title ? "p-4" : "p-4")}>
                            <SchemaRenderer schema={componentSchema} />
                        </div>
                    </CardContent>
                </Card>
            );
        })}
      </div>
    );
  }
);
