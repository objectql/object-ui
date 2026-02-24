
import React, { Suspense } from 'react';
import { Skeleton } from '@object-ui/components';
import type { ChartConfig } from './ChartContainerImpl';

// 🚀 Lazy load the implementation files
const LazyChart = React.lazy(() => import('./ChartImpl'));
const LazyAdvancedChart = React.lazy(() => import('./AdvancedChartImpl'));

export interface ChartBarRendererProps {
  schema: {
    type: string;
    id?: string;
    className?: string;
    data?: Array<Record<string, any>>;
    dataKey?: string;
    xAxisKey?: string;
    height?: number;
    color?: string;
  };
}

/**
 * ChartBarRenderer - The public API for the bar chart component
 */
export const ChartBarRenderer: React.FC<ChartBarRendererProps> = ({ schema }) => {
  return (
    <Suspense fallback={<Skeleton className="w-full h-48 sm:h-64 md:h-80 lg:h-[400px]" />}>
      <LazyChart
        data={schema.data}
        dataKey={schema.dataKey}
        xAxisKey={schema.xAxisKey}
        height={schema.height}
        className={schema.className}
        color={schema.color}
      />
    </Suspense>
  );
};

export interface ChartRendererProps {
  schema: {
    type: string;
    id?: string;
    className?: string;
    chartType?: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'radar' | 'scatter' | 'combo';
    data?: Array<Record<string, any>>;
    config?: Record<string, any>;
    xAxisKey?: string;
    series?: Array<{ dataKey: string }>;
  };
}

/**
 * ChartRenderer - The public API for the advanced chart component
 */
export const ChartRenderer: React.FC<ChartRendererProps> = ({ schema }) => {
  // ⚡️ Adapter: Normalize JSON schema to Recharts Props
  const props = React.useMemo(() => {
    // 1. Defaults
    let series = schema.series;
    let xAxisKey = schema.xAxisKey;
    let config = schema.config;

    // 2. Adapt Tremor/Simple format (categories -> series, index -> xAxisKey)
    if (!xAxisKey) {
       if ((schema as any).index) xAxisKey = (schema as any).index;
       else if ((schema as any).category) xAxisKey = (schema as any).category; // Support Pie/Donut category
    }

    if (!series) {
       if ((schema as any).categories) {
          series = (schema as any).categories.map((cat: string) => ({ dataKey: cat }));
       } else if ((schema as any).value) {
          // Single value adapter (for Pie/Simple charts)
          series = [{ dataKey: (schema as any).value }];
       }
    }
    
    // 3. Auto-generate config/colors if missing
    if (!config && series) {
       const colors = (schema as any).colors || ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))']; 
       const newConfig: ChartConfig = {};
       series.forEach((s: any, idx: number) => {
         newConfig[s.dataKey] = { label: s.dataKey, color: colors[idx % colors.length] };
       });
       config = newConfig;
    }

    return {
      chartType: schema.chartType,
      data: Array.isArray(schema.data) ? schema.data : [],
      config,
      xAxisKey,
      series,
      className: schema.className
    };
  }, [schema]);

  return (
    <Suspense fallback={<Skeleton className="w-full h-48 sm:h-64 md:h-80 lg:h-[400px]" />}>
      <LazyAdvancedChart
        chartType={props.chartType}
        data={props.data}
        config={props.config}
        xAxisKey={props.xAxisKey}
        series={props.series}
        className={props.className}
      />
    </Suspense>
  );
};
