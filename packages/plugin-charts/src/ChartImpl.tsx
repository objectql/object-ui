import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface ChartImplProps {
  data?: Array<Record<string, any>>;
  dataKey?: string;
  xAxisKey?: string;
  height?: number;
  className?: string;
  color?: string;
}

/**
 * ChartImpl - The heavy implementation that imports Recharts
 * This component is lazy-loaded to avoid including Recharts in the initial bundle
 */
export default function ChartImpl({
  data = [],
  dataKey = 'value',
  xAxisKey = 'name',
  height = 400,
  className = '',
  // Default to standard primary color
  color = 'hsl(var(--primary))',
}: ChartImplProps) {
  return (
    <div className={`p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm shadow-lg shadow-background/5 ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="90%" stopColor={color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={color} stopOpacity={0.3} />
            </linearGradient>
            <filter id="glow" height="130%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
              <feOffset in="blur" dx="0" dy="0" result="offsetBlur" />
              <feFlood floodColor={color} floodOpacity="0.5" result="offsetColor" />
              <feComposite in="offsetColor" in2="offsetBlur" operator="in" result="offsetBlur" />
              <feMerge>
                <feMergeNode in="offsetBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis 
            dataKey={xAxisKey} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'monospace' }} 
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            dy={10}
          />
          <YAxis 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'monospace' }} 
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))', 
              borderColor: 'hsl(var(--border))', 
              color: 'hsl(var(--popover-foreground))',
              borderRadius: '8px',
              fontFamily: 'monospace',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: 'hsl(var(--primary))' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', fontFamily: 'monospace' }} />
          <Bar 
            dataKey={dataKey} 
            fill="url(#barGradient)" 
            radius={[4, 4, 0, 0]}
            filter="url(#glow)"
            animationDuration={1500}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
