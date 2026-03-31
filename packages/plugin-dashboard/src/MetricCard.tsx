/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
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

export interface MetricCardProps {
  title?: string | { key?: string; defaultValue?: string };
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string | { key?: string; defaultValue?: string };
  className?: string;
  /** When true, the card is in a loading state (fetching data from server). */
  loading?: boolean;
  /** Error message from a failed data fetch. When set, the card shows an error state. */
  error?: string | null;
}

/**
 * MetricCard - Standalone metric card component for dashboard KPIs
 * Displays a metric value with optional icon, trend indicator, and description
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend,
  trendValue,
  description,
  className,
  loading,
  error,
  ...props
}) => {
  // Resolve icon from lucide-react
  const IconComponent = icon && (LucideIcons as any)[icon];

  return (
    <Card className={cn("h-full", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {resolveLabel(title)}
        </CardTitle>
        {IconComponent && (
          <IconComponent className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground" data-testid="metric-card-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2" data-testid="metric-card-error" role="alert">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-xs text-destructive truncate">{error}</span>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {(trend || trendValue || description) && (
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {trend && trendValue && (
                  <span className={cn(
                    "flex items-center mr-2",
                    trend === 'up' && "text-green-500",
                    trend === 'down' && "text-red-500",
                    trend === 'neutral' && "text-yellow-500"
                  )}>
                    {trend === 'up' && <ArrowUpIcon className="h-3 w-3 mr-1" />}
                    {trend === 'down' && <ArrowDownIcon className="h-3 w-3 mr-1" />}
                    {trend === 'neutral' && <MinusIcon className="h-3 w-3 mr-1" />}
                    {trendValue}
                  </span>
                )}
                {resolveLabel(description)}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
