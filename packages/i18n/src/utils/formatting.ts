/**
 * @object-ui/i18n - Date and currency formatting utilities
 *
 * Uses the native Intl API for locale-aware formatting.
 */

export interface DateFormatOptions {
  locale?: string;
  style?: 'short' | 'medium' | 'long' | 'full';
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
}

export interface CurrencyFormatOptions {
  locale?: string;
  currency?: string;
  style?: 'currency' | 'decimal' | 'percent';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface NumberFormatOptions {
  locale?: string;
  style?: 'decimal' | 'percent' | 'unit';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
}

/**
 * Format a date according to locale conventions
 */
export function formatDate(
  date: Date | string | number,
  options: DateFormatOptions = {},
): string {
  const { locale = 'en', style = 'medium' } = options;
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return String(date);
  }

  const styleMap: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: '2-digit', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  };

  const formatOptions = options.dateStyle
    ? { dateStyle: options.dateStyle, timeStyle: options.timeStyle }
    : styleMap[style] || styleMap.medium;

  return new Intl.DateTimeFormat(locale, formatOptions).format(d);
}

/**
 * Format a date and time according to locale conventions
 */
export function formatDateTime(
  date: Date | string | number,
  options: DateFormatOptions = {},
): string {
  const { locale = 'en', style = 'medium' } = options;
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return String(date);
  }

  const styleMap: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: '2-digit', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' },
    full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' },
  };

  return new Intl.DateTimeFormat(locale, styleMap[style] || styleMap.medium).format(d);
}

/**
 * Format a relative time (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale = 'en',
): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');

  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');

  return rtf.format(Math.round(diffDay / 365), 'year');
}

/**
 * Format a currency value according to locale conventions
 */
export function formatCurrency(
  value: number,
  options: CurrencyFormatOptions = {},
): string {
  const { locale = 'en', currency = 'USD', minimumFractionDigits, maximumFractionDigits } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/**
 * Format a number according to locale conventions
 */
export function formatNumber(
  value: number,
  options: NumberFormatOptions = {},
): string {
  const { locale = 'en', ...rest } = options;
  return new Intl.NumberFormat(locale, rest).format(value);
}
