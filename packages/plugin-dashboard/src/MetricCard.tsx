/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, getLazyIcon } from '@object-ui/components';
import { cn } from '@object-ui/components';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import type { I18nLabel } from '@object-ui/types';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, AlertCircle, Loader2 } from 'lucide-react';
import type { SchemaHostProps } from './schemaHostProps';

export interface MetricCardProps {
  /**
   * Card heading, in @objectstack/spec's `I18nLabel` vocabulary — a plain
   * string or an inline per-locale map. See `MetricWidget.label` for why the
   * retired `{ key, defaultValue }` form is no longer accepted (objectui#4032).
   */
  title?: string | I18nLabel;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string | I18nLabel;
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
export const MetricCard: React.FC<MetricCardProps & SchemaHostProps> = ({
  title,
  value,
  icon,
  trend,
  trendValue,
  description,
  className,
  loading,
  error,
  // Schema-shaped props `SchemaRenderer` injects, destructured out so the
  // spread below cannot write them to the DOM (objectui#4357). Named and
  // measured in `./schemaHostProps`; `schema` alone put a
  // `schema="[object Object]"` attribute on every card. The rest spread
  // survives — it is the component's genuine DOM/aria passthrough.
  schema: _schema,
  bind: _bind,
  events: _events,
  props: _propsBag,
  ariaLabel: _ariaLabel,
  ariaDescribedBy: _ariaDescribedBy,
  ...domProps
}) => {
  // Resolve icon via lazy resolver — each icon ships as its own micro-chunk
  const IconComponent = icon ? getLazyIcon(icon) : null;
  // Label text follows the active UI language (not the tenant's number locale).
  const { language } = useObjectTranslation();

  return (
    <Card className={cn("h-full", className)} {...domProps}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {pickLocalized(title, language)}
        </CardTitle>
        {IconComponent && (
          // eslint-disable-next-line react-hooks/static-components -- getLazyIcon returns a module-cached stable component per name, not one created during render
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
                {pickLocalized(description, language)}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
