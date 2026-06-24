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
  Treemap,
  Sankey,
  Tooltip,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartConfig
} from './ChartContainerImpl';
import { mapScatterClick, mapTreemapClick, mapSankeyClick } from './chartDrillEvents';

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

/**
 * Default visual treatment for a `variant: 'comparison'` series. Returns
 * overrides per chart family so the comparison overlay reads as muted
 * (dashed line, lower fill opacity) while still being color-matched to
 * the primary series. Series-level `opacity` / `dashArray` win over defaults.
 */
const comparisonStyle = (s: any, kind: 'line' | 'area' | 'bar' | 'scatter') => {
  if (s?.variant !== 'comparison') return null;
  const strokeOpacity = typeof s.opacity === 'number' ? s.opacity : (kind === 'line' || kind === 'scatter' ? 0.5 : 0.6);
  const fillOpacity = typeof s.opacity === 'number' ? s.opacity : (kind === 'bar' ? 0.4 : kind === 'area' ? 0.2 : 0.5);
  const strokeDasharray = s.dashArray ?? (kind === 'line' || kind === 'area' ? '4 4' : undefined);
  return { strokeOpacity, fillOpacity, strokeDasharray };
};

export interface AdvancedChartImplProps {
  chartType?: 'bar' | 'column' | 'horizontal-bar' | 'line' | 'area' | 'pie' | 'donut' | 'radar' | 'scatter' | 'funnel' | 'combo' | 'treemap' | 'sankey';
  data?: Array<Record<string, any>>;
  config?: ChartConfig;
  xAxisKey?: string;
  series?: Array<{ dataKey: string; chartType?: 'bar' | 'line' | 'area'; variant?: 'current' | 'comparison'; opacity?: number; dashArray?: string; label?: string }>;
  className?: string;
  /** Categorical/series colour palette. Overrides the theme's `--chart-1..n`
   *  defaults so a page/dashboard can brand its charts (data-screens). */
  colors?: string[];
  /**
   * Per-category colour map keyed by the category value OR its display label
   * (e.g. `{ green: '#10B981', Green: '#10B981' }`). When the chart's category
   * dimension is a select/lookup field, ObjectChart resolves the field's option
   * colours into this map so a "Red" health slice paints red instead of taking
   * the next positional palette slot. A category found here WINS over `colors`;
   * categories absent here fall back to the positional palette, then the theme.
   */
  categoryColors?: Record<string, string>;
  /**
   * Optional drill-down click handler. Fires when a chart segment is clicked
   * with `{ category, series, value }`. Wired for bar/horizontal-bar/line/
   * area/pie/donut. Other chart types are no-ops in L1.
   */
  onChartClick?: (event: { category?: string; series?: string; value?: number }) => void;
  /**
   * Disable Recharts' entrance animation when `false`. Animations drive the
   * reveal via `requestAnimationFrame`, which browsers throttle/pause in
   * hidden/background tabs — so a chart rendered off-screen (analytics export,
   * a report opened in an inactive tab, headless capture) can freeze at frame 0
   * and look empty (esp. pie/donut: sectors at angle 0 = no ring, legend only).
   * Reports pass `false` for a deterministic, instant, export-safe render.
   * Omitted/true preserves the animated default everywhere else (dashboards).
   */
  isAnimationActive?: boolean;
}

/**
 * AdvancedChartImpl - The heavy implementation that imports Recharts with full features
 * This component is lazy-loaded to avoid including Recharts in the initial bundle
 */
export default function AdvancedChartImpl({
  chartType: rawChartType = 'bar',
  data: rawData = [],
  config = {},
  xAxisKey = 'name',
  series = [],
  className = '',
  colors,
  categoryColors,
  onChartClick,
  isAnimationActive,
}: AdvancedChartImplProps) {
  // Normalize 'column' → 'bar' (Recharts BarChart is already vertical).
  // 'column' is the spec-level alias for vertical bars; 'horizontal-bar' stays as-is.
  const chartType = rawChartType === 'column' ? 'bar' : rawChartType;
  const data = Array.isArray(rawData) ? rawData : [];
  // Only emit the prop when explicitly disabled, so the default (animated)
  // behavior is byte-for-byte unchanged for every existing caller.
  const animProps = isAnimationActive === false ? { isAnimationActive: false as const } : {};
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

  // Per-category colour: a select/lookup dimension's option colour (passed via
  // `categoryColors`, keyed by value OR label) wins per slice/bar; categories
  // with no option colour fall back to their positional palette slot. Used by
  // pie/donut and single-series categorical bars so semantic colours (health
  // green/red/yellow) survive even when a generic brand palette is also set.
  const colorForCategory = React.useCallback((rawKey: any, index: number, palette: string[]): string => {
    const mapped = categoryColors && categoryColors[rawKey == null ? '' : String(rawKey)];
    return mapped || palette[index % palette.length];
  }, [categoryColors]);

  // Scatter / treemap / sankey element clicks map to the same
  // { category, series, value } drill event via pure mappers (see
  // chartDrillEvents). Each returns null for non-drillable targets (e.g. a
  // sankey link or root node), in which case we don't fire.
  const handleScatterClick = React.useCallback((node: any) => {
    if (!onChartClick) return;
    const ev = mapScatterClick(node, xAxisKey, series);
    if (ev) onChartClick(ev);
  }, [onChartClick, xAxisKey, series]);

  const handleTreemapClick = React.useCallback((node: any) => {
    if (!onChartClick) return;
    const ev = mapTreemapClick(node, series);
    if (ev) onChartClick(ev);
  }, [onChartClick, series]);

  const handleSankeyClick = React.useCallback((payload: any) => {
    if (!onChartClick) return;
    const ev = mapSankeyClick(payload, series);
    if (ev) onChartClick(ev);
  }, [onChartClick, series]);

  const scatterClickProps = onChartClick ? { onClick: handleScatterClick, cursor: 'pointer' } : {};
  const treemapClickProps = onChartClick ? { onClick: handleTreemapClick, style: { cursor: 'pointer' as const } } : {};
  const sankeyClickProps = onChartClick ? { onClick: handleSankeyClick, style: { cursor: 'pointer' as const } } : {};

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
    // treemap/sankey return from their own branches above; mapped here only so
    // the index type stays exhaustive.
    treemap: BarChart,
    sankey: BarChart,
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

  // Helper function to get color palette. An explicit `colors` prop (set by the
  // page/dashboard) wins; otherwise fall back to the theme's --chart-1..5 vars.
  const getPalette = () => (Array.isArray(colors) && colors.length > 0 ? colors : [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
  ]);

  // Compact numeric formatter for Y-axis ticks (1,200,000 → 1.2M).
  // Keeps the axis readable when bar/area series have large values.
  const formatYTick = React.useCallback((value: any): string => {
    if (value == null || value === '') return '';
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return String(value);
    try {
      return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(num);
    } catch {
      return String(num);
    }
  }, []);

  // Shared X-axis props for time/categorical axes. Recharts' `minTickGap`
  // automatically thins ticks that would otherwise overlap, so we no
  // longer hard-code `interval={0}` (which forced every label and
  // produced a dense black bar when data spanned hundreds of points).
  const xAxisCommonProps = React.useMemo(() => ({
    tickLine: false as const,
    tickMargin: 10,
    axisLine: false as const,
    interval: 'preserveStartEnd' as const,
    minTickGap: isMobile ? 32 : 48,
    tickFormatter: formatTick,
    ...(!isMobile && hasLongLabels && { angle: -35, textAnchor: 'end' as const, height: 60 }),
  }), [isMobile, hasLongLabels, formatTick]);

  // Pie and Donut charts
  if (chartType === 'pie' || chartType === 'donut') {
    const innerRadius = chartType === 'donut' ? '52%' : 0;
    const palette = getPalette();
    // Augment the chart config with one entry per category value so that
    // `ChartLegendContent` (which resolves item labels via `config[key]`)
    // can render the slice labels next to the color swatches. Without
    // this the legend showed colored dots with no text, because the
    // upstream config only contained entries for series dataKeys.
    const pieConfig: ChartConfig = { ...(config as ChartConfig) };
    data.forEach((entry, index) => {
      const rawKey = entry?.[xAxisKey];
      if (rawKey == null || rawKey === '') return;
      const key = String(rawKey);
      if (!pieConfig[key]) {
        pieConfig[key] = {
          label: key,
          color: colorForCategory(rawKey, index, palette),
        };
      }
    });
    return (
      <ChartContainer config={pieConfig} className={className}>
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={data}
            dataKey={series[0]?.dataKey || 'value'}
            nameKey={xAxisKey || 'name'}
            innerRadius={innerRadius}
            strokeWidth={5}
            paddingAngle={2}
            outerRadius="85%"
            {...animProps}
            {...pieClickProps}
          >
             {data.map((entry, index) => {
                // Per-category option colour wins; otherwise the positional
                // palette slot (kept identical to the legend swatch above).
                const c = colorForCategory(entry?.[xAxisKey], index, palette);
                return <Cell key={`cell-${index}`} fill={resolveColor(c)} />;
             })}
          </Pie>
          <ChartLegend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: isMobile ? '11px' : '12px', paddingTop: '8px' }}
            content={<ChartLegendContent nameKey={xAxisKey} className="flex-wrap" />}
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
    // Recharts <Funnel> draws segments in source order. For a visually
    // correct funnel (largest at top, narrowing down) we sort descending
    // by the numeric value of `dataKey` so authors don't have to pre-sort
    // their dashboard data.
    const funnelData = [...data].sort((a, b) => {
      const av = Number(a?.[dataKey] ?? 0);
      const bv = Number(b?.[dataKey] ?? 0);
      return bv - av;
    });
    return (
      <ChartContainer config={config} className={className}>
        <FunnelChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Funnel
            dataKey={dataKey}
            data={funnelData}
            nameKey={xAxisKey}
            isAnimationActive
            {...funnelClickProps}
          >
            <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey={xAxisKey} />
            {funnelData.map((_entry, idx) => (
              <Cell key={`funnel-cell-${idx}`} fill={resolveColor(palette[idx % palette.length])} />
            ))}
          </Funnel>
        </FunnelChart>
      </ChartContainer>
    );
  }

  // Treemap — composition by relative size. Recharts <Treemap> is itself the
  // chart root (no wrapping cartesian chart); a custom content paints each
  // leaf with a palette color + label.
  if (chartType === 'treemap') {
    const dataKey = series[0]?.dataKey || 'value';
    const palette = getPalette();
    const tmData = data.map((row, idx) => ({
      name: String(row?.[xAxisKey] ?? ''),
      size: Number(row?.[dataKey]) || 0,
      fill: resolveColor(palette[idx % palette.length]),
    }));
    const TreemapCell = (props: any) => {
      const { x, y, width, height, name, fill } = props;
      if (width <= 0 || height <= 0) return null;
      return (
        <g>
          <rect x={x} y={y} width={width} height={height} fill={fill} stroke="hsl(var(--background))" strokeWidth={2} />
          {width > 48 && height > 18 ? (
            <text x={x + 6} y={y + 18} fill="#fff" fontSize={12} className="pointer-events-none">{name}</text>
          ) : null}
        </g>
      );
    };
    return (
      <ChartContainer config={config} className={className}>
        <Treemap data={tmData} dataKey="size" nameKey="name" isAnimationActive content={<TreemapCell />} {...treemapClickProps}>
          <Tooltip />
        </Treemap>
      </ChartContainer>
    );
  }

  // Sankey — flow from a single root node to each category, weighted by value.
  // (The dashboard aggregate yields one value per category; a real multi-stage
  // flow needs richer data, but this honestly renders the sankey family.)
  if (chartType === 'sankey') {
    const dataKey = series[0]?.dataKey || 'value';
    const rootName = series[0]?.label || dataKey;
    const rows = data.filter((r) => (Number(r?.[dataKey]) || 0) > 0);
    const nodes = [{ name: rootName }, ...rows.map((r) => ({ name: String(r?.[xAxisKey] ?? '') }))];
    const links = rows.map((r, i) => ({ source: 0, target: i + 1, value: Number(r?.[dataKey]) || 0 }));
    if (links.length === 0) {
      return <div className={className} />;
    }
    return (
      <ChartContainer config={config} className={className}>
        <Sankey
          data={{ nodes, links }}
          nodePadding={24}
          link={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.25 }}
          node={{ fill: 'hsl(var(--chart-1))' } as any}
          {...sankeyClickProps}
        >
          <Tooltip />
        </Sankey>
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
            minTickGap={isMobile ? 32 : 48}
          />
          <YAxis 
            type="number"
            dataKey={series[0]?.dataKey || 'value'}
            name={String(config[series[0]?.dataKey]?.label || series[0]?.dataKey)}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYTick}
            width={48}
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
            const cmp = comparisonStyle(s, 'scatter');
            return (
              <Scatter
                key={s.dataKey}
                name={config[s.dataKey]?.label || s.dataKey}
                data={data}
                fill={color}
                fillOpacity={cmp?.fillOpacity}
                {...scatterClickProps}
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
          <XAxis dataKey={xAxisKey} {...xAxisCommonProps} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={formatYTick} width={48} />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={formatYTick} width={48} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend
            content={<ChartLegendContent />}
            {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
          />
          {series.map((s: any, index: number) => {
            const color = resolveColor(config[s.dataKey]?.color || DEFAULT_CHART_COLOR);
            const seriesType = s.chartType || (index === 0 ? 'bar' : 'line');
            const yAxisId = seriesType === 'bar' ? 'left' : 'right';
            const cmp = comparisonStyle(s, seriesType as any);

            if (seriesType === 'line') {
              return <Line key={s.dataKey} yAxisId={yAxisId} type="monotone" dataKey={s.dataKey} stroke={color} strokeWidth={2} dot={false} strokeOpacity={cmp?.strokeOpacity} strokeDasharray={cmp?.strokeDasharray} {...animProps} />;
            }
            if (seriesType === 'area') {
              return <Area key={s.dataKey} yAxisId={yAxisId} type="monotone" dataKey={s.dataKey} fill={color} stroke={color} fillOpacity={cmp?.fillOpacity ?? 0.4} strokeOpacity={cmp?.strokeOpacity} strokeDasharray={cmp?.strokeDasharray} {...animProps} />;
            }
            return <Bar key={s.dataKey} yAxisId={yAxisId} dataKey={s.dataKey} fill={color} radius={4} fillOpacity={cmp?.fillOpacity} {...animProps} />;
          })}
        </BarChart>
      </ChartContainer>
    );
  }

  // Horizontal bar — swap X/Y axis types and orientation.
  const isHorizontal = chartType === 'horizontal-bar';

  // Build vertical fill gradients (bar + area) for every colour in play, so
  // fills read as a polished ramp instead of flat blocks (大屏 look). Inline
  // `style` on the stops makes the `--chart-*` CSS vars resolve.
  const _gpal = getPalette();
  // Per-category bars fill from a gradient keyed by the resolved colour, so any
  // semantic option colour (categoryColors) needs its own gradient def too.
  const _catColors = categoryColors ? Object.values(categoryColors).map((c) => resolveColor(String(c))) : [];
  const gradColors = Array.from(new Set<string>([
    ..._gpal,
    ..._catColors,
    ...series.map((s: any, i: number) => resolveColor(((config[s.dataKey] as any)?.color) || _gpal[i % _gpal.length] || DEFAULT_CHART_COLOR)),
  ]));
  const gslug = (c: string) => 'g' + c.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <ChartContainer config={config} className={className}>
      <ChartComponent data={data} layout={isHorizontal ? 'vertical' : 'horizontal'} {...cartesianClickProps}>
        <defs>
          {gradColors.map((c) => (
            <React.Fragment key={gslug(c)}>
              <linearGradient id={`bg-${gslug(c)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: c }} stopOpacity={0.95} />
                <stop offset="100%" style={{ stopColor: c }} stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id={`ag-${gslug(c)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: c }} stopOpacity={0.5} />
                <stop offset="95%" style={{ stopColor: c }} stopOpacity={0.05} />
              </linearGradient>
            </React.Fragment>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        {isHorizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={formatYTick} />
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
          <>
            <XAxis dataKey={xAxisKey} {...xAxisCommonProps} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={formatYTick} width={48} />
          </>
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          content={<ChartLegendContent />}
          {...(isMobile && { verticalAlign: "bottom", wrapperStyle: { fontSize: '11px', paddingTop: '8px' } })}
        />
        {series.map((s: any, sIdx: number) => {
          const palette = getPalette();
          // Comparison series should mirror the color of the primary series
          // they overlay, not be assigned a fresh palette color. Find the
          // first non-comparison series above this one and reuse its color.
          const isComparison = s.variant === 'comparison';
          const baseSeries = isComparison
            ? (series.slice(0, sIdx).find((p: any) => p.variant !== 'comparison') || series[0])
            : s;
          const baseIdx = isComparison ? series.indexOf(baseSeries) : sIdx;
          const seriesColor = resolveColor(config[baseSeries.dataKey]?.color || palette[baseIdx % palette.length] || DEFAULT_CHART_COLOR);

          if (chartType === 'bar' || chartType === 'horizontal-bar') {
            // For categorical bar charts with a single primary series,
            // color each bar distinctly. With a comparison overlay the
            // chart effectively has two series, so revert to one color
            // per series for visual consistency.
            const primaryCount = series.filter((p: any) => p.variant !== 'comparison').length;
            const colorPerCategory = primaryCount === 1 && !isComparison && series.length === 1 && data.length > 1;
            const cmp = comparisonStyle(s, 'bar');
            return (
              <Bar key={s.dataKey} dataKey={s.dataKey} fill={`url(#bg-${gslug(seriesColor)})`} radius={4} fillOpacity={cmp?.fillOpacity} {...animProps}>
                {colorPerCategory && data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={`url(#bg-${gslug(resolveColor(colorForCategory(entry?.[xAxisKey], idx, palette)))})`} />
                ))}
              </Bar>
            );
          }
          if (chartType === 'line') {
            const cmp = comparisonStyle(s, 'line');
            return <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} stroke={seriesColor} strokeWidth={2} dot={false} strokeOpacity={cmp?.strokeOpacity} strokeDasharray={cmp?.strokeDasharray} {...animProps} />;
          }
          if (chartType === 'area') {
            const cmp = comparisonStyle(s, 'area');
            return <Area key={s.dataKey} type="monotone" dataKey={s.dataKey} fill={`url(#ag-${gslug(seriesColor)})`} stroke={seriesColor} strokeWidth={2} fillOpacity={cmp?.fillOpacity ?? 1} strokeOpacity={cmp?.strokeOpacity} strokeDasharray={cmp?.strokeDasharray} {...animProps} />;
          }
          return null;
        })}
      </ChartComponent>
    </ChartContainer>
  );
}
