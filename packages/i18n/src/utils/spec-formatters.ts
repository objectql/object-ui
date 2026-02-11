/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/i18n - Spec-aligned i18n utilities
 *
 * Runtime consumers for @objectstack/spec v2.0.7 i18n types:
 * - PluralRuleSchema → resolvePlural()
 * - DateFormatSchema → formatDateSpec()
 * - NumberFormatSchema → formatNumberSpec()
 * - LocaleConfigSchema → applyLocaleConfig()
 *
 * @module spec-formatters
 */

// ============================================================================
// PluralRuleSchema Consumer
// ============================================================================

/**
 * Spec-aligned PluralRule (mirrors @objectstack/spec PluralRuleSchema).
 */
export interface SpecPluralRule {
  /** Translation key */
  key: string;
  /** Form for zero items */
  zero?: string;
  /** Form for exactly one item */
  one?: string;
  /** Form for exactly two items */
  two?: string;
  /** Form for few items (language-specific) */
  few?: string;
  /** Form for many items (language-specific) */
  many?: string;
  /** Default/fallback form (required) */
  other: string;
}

/**
 * Resolve a plural form based on count, following CLDR plural rules.
 * Uses the Intl.PluralRules API for correct locale-aware pluralization.
 *
 * @example
 * ```ts
 * const rule: SpecPluralRule = {
 *   key: 'items.count',
 *   zero: 'No items',
 *   one: '{count} item',
 *   other: '{count} items',
 * };
 * resolvePlural(rule, 0, 'en'); // → 'No items'
 * resolvePlural(rule, 1, 'en'); // → '1 item'
 * resolvePlural(rule, 5, 'en'); // → '5 items'
 * ```
 */
export function resolvePlural(
  rule: SpecPluralRule,
  count: number,
  locale = 'en',
): string {
  const pr = new Intl.PluralRules(locale);
  const category = pr.select(count);

  // Prefer the explicit form, fall back to 'other'
  const template =
    (category === 'zero' && rule.zero) ||
    (category === 'one' && rule.one) ||
    (category === 'two' && rule.two) ||
    (category === 'few' && rule.few) ||
    (category === 'many' && rule.many) ||
    rule.other;

  // Replace {count} placeholder
  return template.replace(/\{count\}/g, String(count));
}

// ============================================================================
// DateFormatSchema Consumer
// ============================================================================

/**
 * Spec-aligned DateFormat (mirrors @objectstack/spec DateFormatSchema).
 */
export interface SpecDateFormat {
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
  timeZone?: string;
  hour12?: boolean;
}

/**
 * Format a date using @objectstack/spec DateFormatSchema configuration.
 *
 * @example
 * ```ts
 * formatDateSpec(new Date(), {
 *   dateStyle: 'medium',
 *   timeStyle: 'short',
 *   timeZone: 'America/New_York',
 * }, 'en-US');
 * ```
 */
export function formatDateSpec(
  date: Date | string | number,
  format: SpecDateFormat,
  locale = 'en',
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const options: Intl.DateTimeFormatOptions = {};
  if (format.dateStyle) options.dateStyle = format.dateStyle;
  if (format.timeStyle) options.timeStyle = format.timeStyle;
  if (format.timeZone) options.timeZone = format.timeZone;
  if (format.hour12 !== undefined) options.hour12 = format.hour12;

  return new Intl.DateTimeFormat(locale, options).format(d);
}

// ============================================================================
// NumberFormatSchema Consumer
// ============================================================================

/**
 * Spec-aligned NumberFormat (mirrors @objectstack/spec NumberFormatSchema).
 */
export interface SpecNumberFormat {
  style?: 'currency' | 'percent' | 'decimal' | 'unit';
  currency?: string;
  unit?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

/**
 * Format a number using @objectstack/spec NumberFormatSchema configuration.
 *
 * @example
 * ```ts
 * formatNumberSpec(1234.56, {
 *   style: 'currency',
 *   currency: 'USD',
 *   maximumFractionDigits: 2,
 * }, 'en-US'); // → '$1,234.56'
 * ```
 */
export function formatNumberSpec(
  value: number,
  format: SpecNumberFormat,
  locale = 'en',
): string {
  const options: Intl.NumberFormatOptions = {
    style: format.style || 'decimal',
  };

  if (format.currency) options.currency = format.currency;
  if (format.unit) options.unit = format.unit;
  if (format.minimumFractionDigits !== undefined) options.minimumFractionDigits = format.minimumFractionDigits;
  if (format.maximumFractionDigits !== undefined) options.maximumFractionDigits = format.maximumFractionDigits;
  if (format.useGrouping !== undefined) options.useGrouping = format.useGrouping;

  return new Intl.NumberFormat(locale, options).format(value);
}

// ============================================================================
// LocaleConfigSchema Consumer
// ============================================================================

/**
 * Spec-aligned LocaleConfig (mirrors @objectstack/spec LocaleConfigSchema).
 */
export interface SpecLocaleConfig {
  /** BCP 47 language code (e.g., 'en-US', 'zh-CN') */
  code: string;
  /** Fallback locale chain */
  fallbackChain?: string[];
  /** Text direction */
  direction?: 'ltr' | 'rtl';
  /** Number formatting defaults */
  numberFormat?: SpecNumberFormat;
  /** Date formatting defaults */
  dateFormat?: SpecDateFormat;
}

/**
 * Apply a LocaleConfigSchema to configure i18n formatting defaults.
 * Returns resolved formatting functions bound to the locale config.
 *
 * @example
 * ```ts
 * const locale = applyLocaleConfig({
 *   code: 'zh-CN',
 *   direction: 'ltr',
 *   numberFormat: { style: 'decimal', useGrouping: true },
 *   dateFormat: { dateStyle: 'medium' },
 * });
 * locale.formatDate(new Date()); // Chinese medium date
 * locale.formatNumber(1234.5);   // 1,234.5
 * ```
 */
export function applyLocaleConfig(config: SpecLocaleConfig) {
  return {
    code: config.code,
    direction: config.direction || 'ltr',
    fallbackChain: config.fallbackChain || [],
    formatDate: (date: Date | string | number, overrides?: Partial<SpecDateFormat>) =>
      formatDateSpec(date, { ...config.dateFormat, ...overrides }, config.code),
    formatNumber: (value: number, overrides?: Partial<SpecNumberFormat>) =>
      formatNumberSpec(value, { ...config.numberFormat, ...overrides }, config.code),
    resolvePlural: (rule: SpecPluralRule, count: number) =>
      resolvePlural(rule, count, config.code),
  };
}
