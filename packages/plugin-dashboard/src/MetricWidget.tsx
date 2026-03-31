import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@object-ui/components';
import { cn } from '@object-ui/components';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, AlertCircle, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

/** Resolve an I18nLabel (string or {key, defaultValue}) to a plain string. */
function resolveLabel(label: string | { key?: string; defaultValue?: string } | undefined): string | undefined {
  if (label === undefined || label === null) return undefined;
  if (typeof label === 'string') return label;
  return label.defaultValue || label.key;
}

export interface MetricWidgetProps {
  label: string | { key?: string; defaultValue?: string };
  value: string | number;
  trend?: {
    value: number;
    label?: string | { key?: string; defaultValue?: string };
    direction?: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode | string;
  className?: string;
  description?: string | { key?: string; defaultValue?: string };
  /** When true, the widget is in a loading state (fetching data from server). */
  loading?: boolean;
  /** Error message from a failed data fetch. When set, the widget shows an error state. */
  error?: string | null;
}

export const MetricWidget = ({
  label,
  value,
  trend,
  icon,
  className,
  description,
  loading,
  error,
  ...props
}: MetricWidgetProps) => {
  // Resolve icon if it's a string
  const resolvedIcon = useMemo(() => {
    if (typeof icon === 'string') {
        const IconComponent = (LucideIcons as any)[icon];
        return IconComponent ? <IconComponent className="h-4 w-4 text-muted-foreground" /> : null;
    }
    return icon;
  }, [icon]);

  return (
    <Card className={cn("h-full overflow-hidden", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {resolveLabel(label)}
        </CardTitle>
        {resolvedIcon && <div className="h-4 w-4 text-muted-foreground shrink-0">{resolvedIcon}</div>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground" data-testid="metric-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2" data-testid="metric-error" role="alert">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive truncate">{error}</span>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold truncate">{value}</div>
            {(trend || description) && (
              <p className="text-xs text-muted-foreground flex items-center mt-1 truncate">
                {trend && (
                  <span className={cn(
                    "flex items-center mr-2 shrink-0",
                    trend.direction === 'up' && "text-green-500",
                    trend.direction === 'down' && "text-red-500",
                    trend.direction === 'neutral' && "text-yellow-500"
                  )}>
                    {trend.direction === 'up' && <ArrowUpIcon className="h-3 w-3 mr-1" />}
                    {trend.direction === 'down' && <ArrowDownIcon className="h-3 w-3 mr-1" />}
                    {trend.direction === 'neutral' && <MinusIcon className="h-3 w-3 mr-1" />}
                    {trend.value}%
                  </span>
                )}
                <span className="truncate">{resolveLabel(description) || resolveLabel(trend?.label)}</span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
