import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, getLazyIcon } from '@object-ui/components';
import { cn } from '@object-ui/components';
import { createSafeTranslation } from '@object-ui/i18n';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, AlertCircle, Loader2 } from 'lucide-react';

const TREND_LABEL_DEFAULTS: Record<string, string> = {
  'dashboard.trend.vsLastQuarter': 'vs last quarter',
  'dashboard.trend.vsLastMonth': 'vs last month',
  'dashboard.trend.vsLastWeek': 'vs last week',
  'dashboard.trend.vsLastYear': 'vs last year',
  'dashboard.trend.vsYesterday': 'vs yesterday',
  'dashboard.trend.vsPreviousPeriod': 'vs previous period',
};

const useTrendT = createSafeTranslation(TREND_LABEL_DEFAULTS, 'dashboard.trend.vsLastQuarter');

/**
 * Map a server-provided English trend phrase ("vs last quarter") to its
 * canonical i18n key so we can translate it without requiring backends to
 * emit `{key, defaultValue}` objects.
 */
function trendLabelKey(label: string): string | undefined {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ');
  switch (normalized) {
    case 'vs last quarter':
    case 'vs previous quarter':
      return 'dashboard.trend.vsLastQuarter';
    case 'vs last month':
    case 'vs previous month':
      return 'dashboard.trend.vsLastMonth';
    case 'vs last week':
    case 'vs previous week':
      return 'dashboard.trend.vsLastWeek';
    case 'vs last year':
    case 'vs previous year':
      return 'dashboard.trend.vsLastYear';
    case 'vs yesterday':
      return 'dashboard.trend.vsYesterday';
    case 'vs previous period':
    case 'vs prior period':
      return 'dashboard.trend.vsPreviousPeriod';
    default:
      return undefined;
  }
}

/**
 * Lightweight numeric formatter for metric widgets.
 *
 * Honors a numeral.js-style `format` pattern:
 * - `'0,0'` / `'0,0.00'` → thousands separators with explicit decimals
 * - leading `$/¥/€/£` or `currency` prop → currency formatting
 * - trailing `%` → percent (assumes already in 0-100 unless < 1)
 *
 * When no format is given but the value is a finite number, defaults to
 * thousands separators with no decimals — that's what users expect for
 * KPI cards (`1,930,000` not `1930000`).
 */
function formatMetricValue(
  value: string | number,
  format?: string,
  currency?: string,
): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    // If the string is a pure number, format it; else pass through.
    const n = Number(value);
    if (!isFinite(n) || value.trim() === '') return value;
    return formatMetricValue(n, format, currency);
  }
  if (!isFinite(value as number)) return String(value);

  const symbolMap: Record<string, string> = { '$': 'USD', '¥': 'JPY', '€': 'EUR', '£': 'GBP' };
  const trimmed = (format || '').trim();
  const isCurrency = !!currency || (trimmed.length > 0 && symbolMap[trimmed[0]] !== undefined);
  const isPercent = trimmed.endsWith('%');

  // Determine decimals from the format pattern (e.g. '0,0.00' → 2)
  const decimalsMatch = trimmed.match(/0\.(0+)/);
  const decimals = decimalsMatch ? decimalsMatch[1].length : 0;

  if (isCurrency) {
    const code = currency || symbolMap[trimmed[0]] || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value as number);
    } catch {
      return `${code} ${(value as number).toFixed(decimals)}`;
    }
  }

  if (isPercent) {
    const v = (value as number) > 1 ? (value as number) : (value as number) * 100;
    return `${v.toFixed(decimals)}%`;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value as number);
}

/** Resolve an I18nLabel (string or {key, defaultValue}) to a plain string. */
function resolveLabel(label: string | { key?: string; defaultValue?: string } | undefined): string | undefined {
  if (label === undefined || label === null) return undefined;
  if (typeof label === 'string') return label;
  return label.defaultValue || label.key;
}

export type MetricColorVariant =
  | 'default' | 'blue' | 'teal' | 'orange' | 'purple'
  | 'success' | 'warning' | 'danger';

/**
 * Static map of color variants → Tailwind class strings.
 * Defined statically so Tailwind v4's content scanner picks them up.
 * Each variant tints the icon container with a soft background + bold foreground,
 * keeping the rest of the card in the neutral Shadcn palette.
 */
const VARIANT_ICON_CLASSES: Record<MetricColorVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  teal:    'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  orange:  'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  purple:  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger:  'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

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
  /** Visual color variant — tints the icon container while keeping the card neutral. */
  colorVariant?: MetricColorVariant;
  /** numeral.js-style format pattern (e.g. `'0,0'`, `'0,0.00'`, `'$0,0'`, `'0%'`). */
  format?: string;
  /** ISO currency code (e.g. `'USD'`); enables currency formatting on numeric values. */
  currency?: string;
  /** Static prefix appended in front of the formatted value (e.g. `'$'`, `'¥'`). */
  prefix?: string;
  /** Static suffix appended after the formatted value (e.g. `' /mo'`). */
  suffix?: string;
  /** When set, the entire card becomes clickable and emits this handler. */
  onClick?: () => void;
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
  colorVariant = 'default',
  format,
  currency,
  prefix,
  suffix,
  onClick,
  ...props
}: MetricWidgetProps) => {
  const iconClasses = VARIANT_ICON_CLASSES[colorVariant] || VARIANT_ICON_CLASSES.default;
  const { t: tTrend } = useTrendT();

  const localizedTrendLabel = useMemo(() => {
    const raw = resolveLabel(description) || resolveLabel(trend?.label);
    if (!raw) return raw;
    const key = trendLabelKey(raw);
    return key ? tTrend(key) : raw;
  }, [description, trend?.label, tTrend]);

  const displayValue = useMemo(() => {
    const formatted = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && isFinite(Number(value)))
      ? formatMetricValue(value, format, currency)
      : (value ?? '');
    const formattedStr = String(formatted);
    // Avoid duplicating a currency-style prefix/suffix that the formatter
    // already produced (e.g. format='$0,0' + prefix='$' → '$$0').
    const effectivePrefix = prefix && formattedStr.startsWith(prefix) ? '' : (prefix ?? '');
    const effectiveSuffix = suffix && formattedStr.endsWith(suffix) ? '' : (suffix ?? '');
    return `${effectivePrefix}${formattedStr}${effectiveSuffix}`;
  }, [value, format, currency, prefix, suffix]);

  // Resolve icon if it's a string — uses lazy resolver so we don't pull
  // the entire lucide-react namespace into the bundle.
  const resolvedIcon = useMemo(() => {
    if (typeof icon === 'string') {
      const IconComponent = getLazyIcon(icon);
      return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
    }
    return icon;
  }, [icon]);

  return (
    <Card
      className={cn(
        "h-full overflow-hidden",
        onClick && "cursor-pointer transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      {...props}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {resolveLabel(label)}
        </CardTitle>
        {resolvedIcon && (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md shrink-0",
              iconClasses,
            )}
          >
            {resolvedIcon}
          </div>
        )}
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
            <div className="text-2xl font-bold tabular-nums tracking-tight truncate">{displayValue}</div>
            {(trend || description) && (
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                {trend && (
                  <span className={cn(
                    "flex items-center shrink-0 font-medium",
                    trend.direction === 'up' && "text-emerald-600 dark:text-emerald-400",
                    trend.direction === 'down' && "text-rose-600 dark:text-rose-400",
                    trend.direction === 'neutral' && "text-muted-foreground"
                  )}>
                    {trend.direction === 'up' && <ArrowUpIcon className="h-3 w-3 mr-1" />}
                    {trend.direction === 'down' && <ArrowDownIcon className="h-3 w-3 mr-1" />}
                    {trend.direction === 'neutral' && <MinusIcon className="h-3 w-3 mr-1" />}
                    {trend.value}%
                  </span>
                )}
                <span className="truncate min-w-0">{localizedTrendLabel}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
