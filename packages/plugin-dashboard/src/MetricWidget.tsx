import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@object-ui/components';
import { cn } from '@object-ui/components';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react';
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
}

export const MetricWidget = ({
  label,
  value,
  trend,
  icon,
  className,
  description,
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
    <Card className={cn("h-full", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {resolveLabel(label)}
        </CardTitle>
        {resolvedIcon && <div className="h-4 w-4 text-muted-foreground">{resolvedIcon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(trend || description) && (
          <p className="text-xs text-muted-foreground flex items-center mt-1">
            {trend && (
              <span className={cn(
                "flex items-center mr-2",
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
            {resolveLabel(description) || resolveLabel(trend?.label)}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
