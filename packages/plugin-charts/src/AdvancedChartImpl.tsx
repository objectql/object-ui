/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Scatter,
  ScatterChart,
  ZAxis,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Funnel,
  FunnelChart,
  LabelList,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig
} from './ChartContainerImpl';

// Default color fallback for chart series
const DEFAULT_CHART_COLOR = 'hsl(var(--primary))';

// Simple color map for Tailwind names (Mock - ideal would be computed styles)
const TW_COLORS: Record<string, string> = {
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
};

const resolveColor = (color: string) => TW_COLORS[color] || color;

export interface AdvancedChartImplProps {
  chartType?: 'bar' | 'horizontal-bar' | 'line' | 'area' | 'pie' | 'donut' | 'radar' | 'scatter' | 'funnel' | 'combo';
  data?: Array<Record<string, any>>;
  config?: ChartConfig;
  xAxisKey?: string;
  series?: Array<{ dataKey: string; chartType?: 'bar' | 'line' | 'area' }>;
  className?: string;
  /**
   * Optional drill-down click handler. Fires when a chart segment is clicked
   * with `{ category, series, value }`. Wired for bar/horizontal-bar/line/
   * area/pie/donut. Other chart types are no-ops in L1.
   */
  onChartClick?: (event: { category?: string; series?: string; value?: number }) => void;
}

/**
 * AdvancedChartImpl - The heavy implementation that imports Recharts with full features
 * This component is lazy-loaded to avoid including Recharts in the initial bundle
 */
export default function AdvancedChartImpl({
  chartType = 'bar',
  data: rawData = [],
  config = {},
  xAxisKey = 'name',
  series = [],
  className = '',
  onChartClick,
}: AdvancedChartImplProps) {
  const data = Array.isArray(rawData) ? rawData : [];
  const [isMobile, setIsMobile] = React.useState(false);

  // Recharts' top-level onClick payload: { activeLabel, activePayload, ... }
  const handleCartesianClick = React.useCallback((payload: any) => {
    if (!onChartClick || !payload) return;
    const ap = Array.isArray(payload.activePayload) ? payload.activePayload[0] : undefined;
    onChartClick({
      category: payload.activeLabel != null ? String(payload.activeLabel) : undefined,
      series: ap?.dataKey ? String(ap.dataKey) : undefined,
      value: typeof ap?.value === 'number' ? ap.value : undefined,
    });
  }, [onChartClick]);

  const handlePieClick = React.useCallback((entry: any) => {
    if (!onChartClick || !entry) return;
    const cat = entry.payload?.[xAxisKey];
    const dk = series[0]?.dataKey || 'value';
    onChartClick({
      category: cat != null ? String(cat) : undefined,
      series: dk,
      value: typeof entry.payload?.[dk] === 'number' ? entry.payload[dk] : undefined,
    });
  }, [onChartClick, xAxisKey, series]);

  const cartesianClickProps = onChartClick ? { onClick: handleCartesianClick, style: { cursor: 'pointer' as const } } : {};
  const pieClickProps = onChartClick ? { onClick: handlePieClick, style: { cursor: 'pointer' as const } } : {};

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const ChartComponent = {
    bar: BarChart,
    'horizontal-bar': BarChart,
    line: LineChart,
    area: AreaChart,
    pie: PieChart,
    donut: PieChart,
    radar: RadarChart,
    scatter: ScatterChart,
    funnel: FunnelChart as any,
    combo: BarChart,
  }[chartType] || BarChart;

  // Format ISO date strings into compact "MMM D" / "MMM YYYY" labels for X-axis ticks.
  // Falls back to the raw value when not parseable as a date.
  const formatTick = React.useCallback((value: any): string => {
    if (value == null || value === '') return '';
    const str = typeof value === 'string' ? value : String(value);
    // Detect ISO 8601 date / datetime strings (YYYY-MM-DD or with time component)
    const isoLike = /^\d{4}-\d{2}-\d{2}/.test(str);
    if (isoLike) {
      const d = new Date(str);
      if (!Number.isNaN(d.getTime())) {
        // Choose granularity based on data span: <= 31 days → MMM D, otherwise MMM YYYY
        const span = data.length > 1
          ? Math.abs(new Date(String(data[data.length - 1][xAxisKey] ?? '')).getTime() -
                     new Date(String(data[0][xAxisKey] ?? '')).getTime())
          : 0;
        const days = span / (1000 * 60 * 60 * 24);
        try {
          if (days <= 62) {
            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }
          return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        } catch {
          return d.toISOString().slice(0, 10);
        }
      }
    }
    if (isMobile && str.length > 8) return str.slice(0, 8) + '…';
    return str;
  }, [data, xAxisKey, isMobile]);

  // Memoize whether any X-axis label is long enough to warrant angle rotation
  const hasLongLabels = React.useMemo(
    () => data.some((d: any) => String(d[xAxisKey] || '').length > 5),
    [data, xAxisKey],
  );

  // Helper function to get color palette
  const getPalette = () => [
    'hsl(var(--chart-1))', 
    'hsl(var(--chart-2))', 
    'hsl(var(--chart-3))', 
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
  ];

  // Pie and Donut charts
  if (chartType === 'pie' || chartType === 'donut') {
    const innerRadius = chartType === 'donut' ? 60 : 0;
    return (
      <ChartContainer config={config} className={className}>
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey={series[0]?.dataKey || 'value'}
            nameKey={xAxisKey || 'name'}
            innerRadius={innerRadius}
            strokeWidth={5}
            paddingAngle={2}
            outerRadius={80}
            {...pieClickProps}
          >
             {data.map((entry, index) => {
                // 1. Try config by nameKey (category)
                let c = config[entry[xAxisKey]]?.color;
                
                // 2. Fallback to palette
                if (!c) {
                   const palette = getPalette();
                   c = palette[index % palette.length];
                }
                
                return <Cell key={`cell-${index}`} fill={resolveColor(c)} />;
             })}
          </Pie>
          <ChartLegend
            content={<ChartLegendContent nameKey={xAxisKey} />}
            {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
          />
        </PieChart>
      </ChartContainer>
    );
  }

  // Funnel chart — uses recharts FunnelChart (single series only)
  if (chartType === 'funnel') {
    const dataKey = series[0]?.dataKey || 'value';
    const palette = getPalette();
    const handleFunnelClick = onChartClick
      ? (entry: any) => {
          if (!entry) return;
          onChartClick({
            category: entry?.payload?.[xAxisKey] ?? entry?.[xAxisKey],
            value: entry?.payload?.[dataKey] ?? entry?.[dataKey],
          });
        }
      : undefined;
    const funnelClickProps = handleFunnelClick
      ? { onClick: handleFunnelClick, style: { cursor: 'pointer' as const } }
      : {};
    return (
      <ChartContainer config={config} className={className}>
        <FunnelChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Funnel
            dataKey={dataKey}
            data={data}
            nameKey={xAxisKey}
            isAnimationActive
            {...funnelClickProps}
          >
            <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey={xAxisKey} />
            {data.map((_entry, idx) => (
              <Cell key={`funnel-cell-${idx}`} fill={resolveColor(palette[idx % palette.length])} />
            ))}
          </Funnel>
        </FunnelChart>
      </ChartContainer>
    );
  }

  // Radar chart
  if (chartType === 'radar') {
    return (
      <ChartContainer config={config} className={className}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey={xAxisKey} />
          <PolarRadiusAxis />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend
            content={<ChartLegendContent />}
            {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
          />
          {series.map((s: any) => {
            const color = resolveColor(config[s.dataKey]?.color || DEFAULT_CHART_COLOR);
            return (
              <Radar
                key={s.dataKey}
                dataKey={s.dataKey}
                stroke={color}
                fill={color}
                fillOpacity={0.6}
              />
            );
          })}
        </RadarChart>
      </ChartContainer>
    );
  }

  // Scatter chart
  if (chartType === 'scatter') {
    return (
      <ChartContainer config={config} className={className}>
        <ScatterChart>
          <CartesianGrid vertical={false} />
          <XAxis 
            type="number" 
            dataKey={xAxisKey}
            name={String(config[xAxisKey]?.label || xAxisKey)}
            tickLine={false}
            axisLine={false}
            interval={isMobile ? Math.ceil(data.length / 5) : 0}
          />
          <YAxis 
            type="number"
            dataKey={series[0]?.dataKey || 'value'}
            name={String(config[series[0]?.dataKey]?.label || series[0]?.dataKey)}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis type="number" range={[60, 400]} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend
            content={<ChartLegendContent />}
            {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
          />
          {series.map((s: any, index: number) => {
            const palette = getPalette();
            const color = resolveColor(config[s.dataKey]?.color || palette[index % palette.length]);
            return (
              <Scatter
                key={s.dataKey}
                name={config[s.dataKey]?.label || s.dataKey}
                data={data}
                fill={color}
              />
            );
          })}
        </ScatterChart>
      </ChartContainer>
    );
  }

  // Combo chart (mixed bar + line on same chart)
  if (chartType === 'combo') {
    return (
      <ChartContainer config={config} className={className}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            interval={isMobile ? Math.ceil(data.length / 5) : 0}
            tickFormatter={formatTick}
            {...(!isMobile && hasLongLabels && { angle: -35, textAnchor: 'end', height: 60 })}
          />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend
            content={<ChartLegendContent />}
            {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
          />
          {series.map((s: any, index: number) => {
            const color = resolveColor(config[s.dataKey]?.color || DEFAULT_CHART_COLOR);
            const seriesType = s.chartType || (index === 0 ? 'bar' : 'line');
            const yAxisId = seriesType === 'bar' ? 'left' : 'right';
            
            if (seriesType === 'line') {
              return <Line key={s.dataKey} yAxisId={yAxisId} type="monotone" dataKey={s.dataKey} stroke={color} strokeWidth={2} dot={false} />;
            }
            if (seriesType === 'area') {
              return <Area key={s.dataKey} yAxisId={yAxisId} type="monotone" dataKey={s.dataKey} fill={color} stroke={color} fillOpacity={0.4} />;
            }
            return <Bar key={s.dataKey} yAxisId={yAxisId} dataKey={s.dataKey} fill={color} radius={4} />;
          })}
        </BarChart>
      </ChartContainer>
    );
  }

  // Horizontal bar — swap X/Y axis types and orientation.
  const isHorizontal = chartType === 'horizontal-bar';

  return (
    <ChartContainer config={config} className={className}>
      <ChartComponent data={data} layout={isHorizontal ? 'vertical' : 'horizontal'} {...cartesianClickProps}>
        <CartesianGrid vertical={false} />
        {isHorizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              width={Math.min(140, Math.max(60, Math.max(...data.map(d => String(d[xAxisKey] ?? '').length)) * 7))}
              tickFormatter={formatTick}
            />
          </>
        ) : (
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            interval={isMobile ? Math.ceil(data.length / 5) : 0}
            tickFormatter={formatTick}
            {...(!isMobile && hasLongLabels && { angle: -35, textAnchor: 'end', height: 60 })}
          />
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={<ChartLegendContent />}
          {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
        />
        {series.map((s: any, sIdx: number) => {
          const palette = getPalette();
          const seriesColor = resolveColor(config[s.dataKey]?.color || palette[sIdx % palette.length] || DEFAULT_CHART_COLOR);

          if (chartType === 'bar' || chartType === 'horizontal-bar') {
            // For categorical bar charts with a single series, color each bar
            // distinctly so that categories are visually distinguishable.
            // For multi-series bars, keep one color per series (standard behavior).
            const colorPerCategory = series.length === 1 && data.length > 1;
            return (
              <Bar key={s.dataKey} dataKey={s.dataKey} fill={seriesColor} radius={4}>
                {colorPerCategory && data.map((_entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={resolveColor(palette[idx % palette.length])} />
                ))}
              </Bar>
            );
          }
          if (chartType === 'line') {
            return <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} stroke={seriesColor} strokeWidth={2} dot={false} />;
          }
          if (chartType === 'area') {
            return <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} fill={seriesColor} stroke={seriesColor} fillOpacity={0.4} />;
          }
          return null;
        })}
      </ChartComponent>
    </ChartContainer>
  );
}
