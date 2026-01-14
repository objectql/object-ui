import { ComponentRegistry } from '@object-ui/core';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/ui/chart';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

ComponentRegistry.register('chart',
  ({ schema, className }) => {
    const { chartType = 'bar', data = [], config = {}, xAxisKey, series = [] } = schema;

    const ChartComponent = {
      bar: BarChart,
      line: LineChart,
      area: AreaChart
    }[chartType as string] || BarChart;

    return (
      <ChartContainer config={config} className={className}>
        <ChartComponent data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {series.map((s: any) => {
             const color = config[s.dataKey]?.color || 'hsl(var(--chart-1))';
             
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
  },
  {
    label: 'Chart',
    category: 'data-display',
    inputs: [
      { 
        name: 'chartType', 
        type: 'enum', 
        label: 'Chart Type',
        enum: [
            { label: 'Bar', value: 'bar' },
            { label: 'Line', value: 'line' },
            { label: 'Area', value: 'area' }
        ]
      },
      { name: 'data', type: 'code', label: 'Data (JSON)' },
      { name: 'config', type: 'code', label: 'Config (JSON)' },
      { name: 'xAxisKey', type: 'string', label: 'X Axis Key' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
