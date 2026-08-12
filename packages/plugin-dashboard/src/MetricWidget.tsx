import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, getLazyIcon } from '@object-ui/components';
import { cn } from '@object-ui/components';
import {
  createSafeTranslation,
  useDisplayLocale,
  useObjectTranslation,
  pickLocalized,
  formatDisplayNumber,
  type DisplayNumberFormatOptions,
} from '@object-ui/i18n';
import type { I18nLabel } from '@object-ui/types';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, AlertCircle, Loader2 } from 'lucide-react';
import { VARIANT_ICON_CLASSES, VARIANT_TEXT_CLASSES, type MetricColorVariant } from './colorVariants';
import type { SchemaHostProps } from './schemaHostProps';

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
  locale?: string,
): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    // If the string is a pure number, format it; else pass through.
    const n = Number(value);
    if (!isFinite(n) || value.trim() === '') return value;
    return formatMetricValue(n, format, currency, locale);
  }
  if (!isFinite(value as number)) return String(value);

  const symbolMap: Record<string, string> = { '$': 'USD', '¥': 'JPY', '€': 'EUR', '£': 'GBP' };
  const trimmed = (format || '').trim();
  const isCurrency = !!currency || (trimmed.length > 0 && symbolMap[trimmed[0]] !== undefined);
  const isPercent = trimmed.endsWith('%');

  // Determine decimals from the format pattern (e.g. '0,0.00' → 2)
  const decimalsMatch = trimmed.match(/0\.(0+)/);
  const decimals = decimalsMatch ? decimalsMatch[1].length : 0;

  // Compact / abbreviated notation (numeral.js 'a' convention, e.g. '0.0a' →
  // "1.1M", '$0a' → "$1M"). Keeps big KPI numbers from overflowing a tile.
  const isCompact = /a/i.test(trimmed);
  if (isCompact) {
    const opts: DisplayNumberFormatOptions = {
      locale,
      notation: 'compact',
      maximumFractionDigits: decimals || 1,
    };
    if (isCurrency) { opts.currency = currency || symbolMap[trimmed[0]] || 'USD'; }
    try { return formatDisplayNumber(value as number, opts); } catch { /* fall through */ }
  }

  if (isCurrency) {
    const code = currency || symbolMap[trimmed[0]] || 'USD';
    try {
      return formatDisplayNumber(value as number, {
        locale,
        currency: code,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    } catch {
      return `${code} ${(value as number).toFixed(decimals)}`;
    }
  }

  if (isPercent) {
    const v = (value as number) > 1 ? (value as number) : (value as number) * 100;
    return `${v.toFixed(decimals)}%`;
  }

  // MEASURED EXCEPTION to objectui#4033's ordinal no-grouping default, and the
  // reason this call passes no `scale`. `decimals` above is parsed out of a
  // numeral.js format PATTERN (`'0,0.00'` → 2), not out of a field's declared
  // scale — and it is 0 for the commonest KPI patterns (`'0,0'`, or no format
  // at all). Grouping is load-bearing here, as this function's own contract
  // says: "defaults to thousands separators with no decimals — that's what
  // users expect for KPI cards (`1,930,000` not `1930000`)". Suppressing it
  // would turn every unformatted dashboard aggregate into an unreadable digit
  // run. The `en-US` locale hardcode IS fixed; the grouping default is not
  // applied to this surface.
  return formatDisplayNumber(value as number, {
    locale,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * The variant vocabulary and its two class tables now live in
 * `./colorVariants` — the dataset-bound KPI (`DatasetWidget`, objectui#3359)
 * paints the SAME accents, and two copies of a palette is how a
 * declared-but-unenforced key becomes two disagreeing declarations. Re-exported
 * here because this module was the type's original home.
 */
export type { MetricColorVariant };

/**
 * DOM PASS-THROUGH (objectui#4426). `MetricWidget` ends its prop list with a
 * `...domProps` spread onto the Shadcn `Card` — a `div` — so `id`, `role`,
 * `aria-*`, `data-*`, `tabIndex`, `title` and the DOM event handlers reach the
 * element. objectui#4357 (PR #4428) deliberately KEPT that spread: it is the
 * component's only accessibility passthrough, and removing it would delete the
 * only way a host can put an `id` or an `aria-label` on a KPI card.
 *
 * Until now the type refused what the runtime accepted. A TypeScript consumer
 * importing the component directly could not write `<MetricWidget id="revenue"
 * role="region" aria-label="Revenue KPI" … />` without a cast, while a JS
 * consumer and every SDUI author going through `SchemaRenderer` (untyped at
 * that boundary) got the passthrough for free. This `extends` is that
 * declaration — the mirror image of #4357, closing the same question from the
 * other side: renderer metadata was reaching the DOM because the spread is
 * open; DOM attributes were unreachable because the type was closed.
 *
 * Measured convention, not an invented spelling: an exported `*Props` interface
 * that spreads onto a host element extends `React.HTMLAttributes<HTMLDivElement>`
 * here — `PageHeaderComponentProps` (whose own doc says "it extends
 * `HTMLAttributes` so every DOM prop rides along"), `ChatbotProps`,
 * `ChatbotEnhancedProps`, `TypingIndicatorProps`, `RefreshIndicatorProps`,
 * `FieldProps`, and shadcn's own `BadgeProps`.
 *
 * What this does NOT declare, deliberately: the schema-shaped keys
 * `SchemaRenderer` injects (`schema` / `bind` / `events` / `props` /
 * `ariaLabel` / `ariaDescribedBy` / `dataSource`). None of them is an HTML
 * attribute name, all seven are destructured out and never reach the DOM, and
 * declaring them here would re-assert as a public contract exactly what #4357
 * stripped. They stay in `SchemaHostProps`, intersected in at the component's
 * own signature — the renderer's private door, not the consumer's front door.
 * The narrower `FieldWidgetDomProps` shape (objectui#3221) is the other spelling
 * in this repo, but it exists to be bound key-by-key to a runtime whitelist
 * (`toDomProps`) in both directions; this component has no such whitelist, and
 * inventing a half of one here would declare a set the spread does not enforce.
 * Whether plugin widgets should get that whitelist is objectui#4425.
 */
export interface MetricWidgetProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The KPI's heading, in @objectstack/spec's `I18nLabel` vocabulary — a plain
   * string or an inline per-locale map (`{ en: 'Revenue', 'zh-CN': '收入' }`).
   *
   * Was `string | { key?, defaultValue? }` — the key-reference form
   * objectstack#5055 RETIRED. It is not accepted here any more because the spec
   * rejects it at authoring time, and because reading it was never the point:
   * the private resolver behind it ended `defaultValue || key` and never
   * consulted a bundle, so the escape hatch was declared and inert
   * (objectui#4032).
   */
  label: string | I18nLabel;
  value: string | number;
  trend?: {
    value: number;
    label?: string | I18nLabel;
    direction?: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode | string;
  className?: string;
  description?: string | I18nLabel;
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
  /**
   * Static prefix appended in front of the formatted value (e.g. `'$'`, `'¥'`).
   *
   * Same name, same `string` type as the inherited RDFa `prefix` attribute, and
   * this declaration wins: the component reads it and destructures it out, so
   * it never reaches the DOM. That is the accurate contract — it was already
   * true before this interface declared its passthrough.
   */
  prefix?: string;
  /** Static suffix appended after the formatted value (e.g. `' /mo'`). */
  suffix?: string;
  /**
   * When set, the entire card becomes clickable and emits this handler.
   *
   * Deliberately NARROWER than the inherited `MouseEventHandler<HTMLDivElement>`:
   * the KPI card treats a click as "the tile was activated" and wires the same
   * handler to Enter/Space, where there is no mouse event to hand over. A
   * zero-arg function is assignable to the inherited signature, so consumers
   * already passing `(e) => …` keep compiling; this only stops the component
   * from promising an event object its keyboard path cannot produce.
   */
  onClick?: () => void;
  /**
   * Layout variant. `'card'` (default) is the bordered KPI card; `'bare'` drops
   * all card chrome and renders a large tinted number + label — the dense
   * big-number look data-screens (大屏) want, while staying data-bound.
   */
  variant?: 'card' | 'bare';
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
  variant = 'card',
  // Schema-shaped props `SchemaRenderer` injects, destructured out so the
  // spread below cannot write them to the DOM (objectui#4357). Named and
  // measured in `./schemaHostProps`; `schema` alone put a
  // `schema="[object Object]"` attribute on every KPI card. The rest spread
  // survives — it is the component's genuine DOM/aria passthrough.
  schema: _schema,
  bind: _bind,
  events: _events,
  props: _propsBag,
  ariaLabel: _ariaLabel,
  ariaDescribedBy: _ariaDescribedBy,
  dataSource: _dataSource,
  ...domProps
}: MetricWidgetProps & SchemaHostProps) => {
  const iconClasses = VARIANT_ICON_CLASSES[colorVariant] || VARIANT_ICON_CLASSES.default;
  const { t: tTrend } = useTrendT();
  // Two locale channels, deliberately distinct. `useDisplayLocale` is the
  // NUMBER locale (objectui#4033 — tenant regional default outranks UI
  // language); `language` is the UI language, which is what label text follows.
  // Keep them separate: swapping either for the other silently changes the
  // other surface's behaviour.
  const locale = useDisplayLocale();
  const { language } = useObjectTranslation();

  const resolvedLabel = useMemo(() => pickLocalized(label, language) || undefined, [label, language]);

  const localizedTrendLabel = useMemo(() => {
    const raw = pickLocalized(description, language) || pickLocalized(trend?.label, language) || undefined;
    if (!raw) return raw;
    const key = trendLabelKey(raw);
    return key ? tTrend(key) : raw;
  }, [description, trend?.label, tTrend, language]);

  const displayValue = useMemo(() => {
    const formatted = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && isFinite(Number(value)))
      ? formatMetricValue(value, format, currency, locale)
      : (value ?? '');
    const formattedStr = String(formatted);
    // Avoid duplicating a currency-style prefix/suffix that the formatter
    // already produced (e.g. format='$0,0' + prefix='$' → '$$0').
    const effectivePrefix = prefix && formattedStr.startsWith(prefix) ? '' : (prefix ?? '');
    const effectiveSuffix = suffix && formattedStr.endsWith(suffix) ? '' : (suffix ?? '');
    return `${effectivePrefix}${formattedStr}${effectiveSuffix}`;
  }, [value, format, currency, prefix, suffix, locale]);

  // Resolve icon if it's a string — uses lazy resolver so we don't pull
  // the entire lucide-react namespace into the bundle.
  const resolvedIcon = useMemo(() => {
    if (typeof icon === 'string') {
      const IconComponent = getLazyIcon(icon);
      // eslint-disable-next-line react-hooks/static-components -- getLazyIcon returns a module-cached stable component per name, not one created during render
      return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
    }
    return icon;
  }, [icon]);

  if (variant === 'bare') {
    const textClasses = VARIANT_TEXT_CLASSES[colorVariant] || VARIANT_TEXT_CLASSES.default;
    return (
      <div
        className={cn('flex flex-col gap-1 min-w-0', onClick && 'cursor-pointer', className)}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      >
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground" data-testid="metric-loading">
            <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2" data-testid="metric-error" role="alert">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" /><span className="text-xs text-destructive truncate">{error}</span>
          </div>
        ) : (
          <>
            <div className={cn('text-[2rem] leading-none font-extrabold tabular-nums tracking-tight truncate', textClasses)}>{displayValue}</div>
            <div className="text-xs font-medium text-muted-foreground truncate">{resolvedLabel}</div>
          </>
        )}
      </div>
    );
  }

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
      {...domProps}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {resolvedLabel}
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
