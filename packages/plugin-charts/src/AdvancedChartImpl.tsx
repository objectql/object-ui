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
  chartType?: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'radar' | 'scatter' | 'combo';
  data?: Array<Record<string, any>>;
  config?: ChartConfig;
  xAxisKey?: string;
  series?: Array<{ dataKey: string; chartType?: 'bar' | 'line' | 'area' }>;
  className?: string;
}

/**
 * AdvancedChartImpl - The heavy implementation that imports Recharts with full features
 * This component is lazy-loaded to avoid including Recharts in the initial bundle
 */
export default function AdvancedChartImpl({
  chartType = 'bar',
  data = [],
  config = {},
  xAxisKey = 'name',
  series = [],
  className = '',
}: AdvancedChartImplProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const ChartComponent = {
    bar: BarChart,
    line: LineChart,
    area: AreaChart,
    pie: PieChart,
    donut: PieChart,
    radar: RadarChart,
    scatter: ScatterChart,
  }[chartType] || BarChart;

  console.log('📈 Rendering Chart:', { chartType, dataLength: data.length, config, series, xAxisKey });

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
            tickFormatter={(value) => (value && typeof value === 'string') ? value.slice(0, 3) : value}
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

  return (
    <ChartContainer config={config} className={className}>
      <ChartComponent data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={xAxisKey}
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          interval={isMobile ? Math.ceil(data.length / 5) : 0}
          tickFormatter={(value) => (value && typeof value === 'string') ? value.slice(0, 3) : value}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={<ChartLegendContent />}
          {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
        />
        {series.map((s: any) => {
          const color = resolveColor(config[s.dataKey]?.color || DEFAULT_CHART_COLOR);
          
          if (chartType === 'bar') {
            return <Bar key={s.dataKey} dataKey={s.dataKey} fill={color} radius={4} />;
          }
          if (chartType === 'line') {
            return <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} stroke={color} strokeWidth={2} dot={false} />;
          }
          if (chartType === 'area') {
            return <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} fill={color} stroke={color} fillOpacity={0.4} />;
          }
          return null;
        })}
      </ChartComponent>
    </ChartContainer>
  );
}
