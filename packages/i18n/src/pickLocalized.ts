/**
 * Resolve a possibly-localized value to the best string for a language.
 *
 * Accepts a plain string (passed through) or an i18n object keyed by language
 * code — e.g. `{ en: 'Pricing', 'zh-CN': '定价', zh: '定价', default: 'Pricing' }`.
 * Resolution order: exact language -> base language (`zh-CN` -> `zh`) -> `default`
 * -> `en` -> first value. Unlike a `default`/`en`-only resolver this is genuinely
 * locale-aware, so server-driven metadata (page text, action param labels) can
 * carry inline translations instead of rendering "[object Object]" or English.
 *
 * Pure — pair it with `useObjectTranslation().language` (or any current-locale
 * source) at the call site.
 */
export function pickLocalized(value: unknown, language: string | undefined | null): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const lang = (language || 'en').trim();
    const base = lang.split('-')[0];
    const pick =
      o[lang] ??
      o[base] ??
      o.default ??
      o.en ??
      Object.values(o).find((v) => typeof v === 'string');
    return pick == null ? '' : String(pick);
  }
  return String(value);
}
