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
  color = '#8884d8',
}: ChartImplProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xAxisKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={dataKey} fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
