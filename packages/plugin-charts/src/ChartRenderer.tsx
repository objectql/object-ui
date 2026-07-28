
import React, { Suspense } from 'react';
import { Skeleton } from '@object-ui/components';
import type { ChartConfig } from './ChartContainerImpl';
import { normalizeChartSchema } from './normalizeChartSchema';

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
    chartType?: 'bar' | 'column' | 'horizontal-bar' | 'line' | 'area' | 'pie' | 'donut' | 'radar' | 'scatter' | 'funnel' | 'combo' | 'treemap' | 'sankey';
    data?: Array<Record<string, any>>;
    config?: Record<string, any>;
    /** Internal binding. Authors write the spec `xAxis: { field }` (or the
     *  report surface's bare string); `normalizeChartSchema` resolves both. */
    xAxisKey?: string;
    /** Internal binding. Authors write the spec `series: [{ name, … }]`. */
    series?: Array<{ dataKey: string; label?: string; variant?: 'current' | 'comparison'; opacity?: number; dashArray?: string; chartType?: 'bar' | 'line' | 'area'; stack?: string; yAxis?: 'left' | 'right'; color?: string }>;
    /** Spec `ChartConfig` shape — honored via `normalizeChartSchema`
     *  (objectui#2880). Listed here so the author-facing contract type-checks;
     *  the internal props above win when both are present. */
    xAxis?: unknown;
    yAxis?: unknown;
    showLegend?: boolean;
    showDataLabels?: boolean;
    title?: unknown;
    subtitle?: unknown;
    annotations?: Array<Record<string, any>>;
    interaction?: Record<string, any>;
    /** An author `type` rescued from the SDUI envelope's discriminator
     *  collision by the react-page wrapper — see `normalizeChartSchema`. */
    specType?: string;
    colors?: string[];
    /** Per-category colour map (value/label → colour). Wins over `colors` per
     *  category; see AdvancedChartImpl. Set by ObjectChart from select/lookup
     *  dimension option colours and/or an explicit author map. */
    categoryColors?: Record<string, string>;
    /** Declared category order (value/label keys, in domain order) for
     *  ordered-sequence charts — funnel/pyramid stages. Set by DatasetWidget
     *  from the dimension's picklist order or an explicit `stageOrder`; see
     *  AdvancedChartImpl. Omitted → the funnel's value-descending default. */
    categoryOrder?: string[];
    /** Pass `false` for a deterministic, export-safe render with no entrance
     *  animation (see AdvancedChartImpl). Omitted → animated default. */
    isAnimationActive?: boolean;
  };
  /** Drill-down click handler — wired by ObjectChart when drillDown is enabled. */
  onChartClick?: (event: { category?: string; series?: string; value?: number }) => void;
}

/**
 * ChartRenderer - The public API for the advanced chart component
 */
export const ChartRenderer: React.FC<ChartRendererProps> = ({ schema, onChartClick }) => {
  // ⚡️ Adapter: Normalize the AUTHOR-facing chart schema to Recharts props.
  //
  // The spec shape (`type` / `xAxis: {field}` / `yAxis: [{field, format, …}]` /
  // `series: [{name, stack, yAxis}]`) and the renderer's internal shape
  // (`chartType` / `xAxisKey` / `series: [{dataKey}]`) both land here;
  // `normalizeChartSchema` is the single translation point, with internal props
  // winning so DashboardRenderer/ObjectView/the dataset path are untouched
  // (objectui#2880 S1).
  const props = React.useMemo(() => {
    const spec = normalizeChartSchema(schema);

    let series: any[] | undefined = schema.series ?? spec.series;
    let xAxisKey = schema.xAxisKey ?? spec.xAxisKey;
    let config = schema.config;

    // Adapt the Tremor/simple format (categories -> series, index -> xAxisKey)
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

    // Auto-generate config/colors if missing. A spec `series[].color` is an
    // explicit author choice, so it wins over the positional palette.
    if (!config && series) {
       const colors = (schema as any).colors || ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];
       const newConfig: ChartConfig = {};
       series.forEach((s: any, idx: number) => {
         newConfig[s.dataKey] = { label: s.label || s.dataKey, color: s.color || colors[idx % colors.length] };
       });
       config = newConfig;
    }

    return {
      chartType: schema.chartType ?? spec.chartType,
      data: Array.isArray(schema.data) ? schema.data : [],
      config,
      xAxisKey,
      series,
      className: schema.className,
      spec,
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
        colors={Array.isArray((schema as any).colors) ? (schema as any).colors : undefined}
        categoryColors={(schema as any).categoryColors}
        categoryOrder={(schema as any).categoryOrder}
        isAnimationActive={schema.isAnimationActive}
        onChartClick={onChartClick}
        xAxis={props.spec.xAxis}
        yAxes={props.spec.yAxes}
        showLegend={props.spec.showLegend}
        showDataLabels={props.spec.showDataLabels}
        title={props.spec.title}
        subtitle={props.spec.subtitle}
        annotations={props.spec.annotations}
        interaction={props.spec.interaction}
      />
    </Suspense>
  );
};
