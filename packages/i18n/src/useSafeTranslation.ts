/**
 * Safe translation hook with fallback to default strings.
 *
 * When no I18nProvider is available (e.g., in tests or standalone usage),
 * this hook falls back to the provided default translations instead of
 * returning raw i18n keys — and, for a key the `defaults` map does not carry,
 * to the call site's own inline `t(key, { defaultValue })` (objectui#3865).
 * The lookup order is i18next's, so a provider-less host and a provider-mounted
 * one render the same string: `defaults[key]` (the pack value's stand-in here)
 * -> `defaultValue` -> the key.
 *
 * @param defaults - Fallback English translations keyed by i18n key
 * @param testKey - A key to test if i18n is properly configured (must be in defaults)
 */
import { useObjectTranslation } from './provider.js';

/**
 * The i18next option that names the string to use when the lookup misses.
 *
 * It is a LOOKUP CONTROL, not interpolation data (objectui#3865): it chooses
 * which string is rendered, so it must never also be spliced into a
 * `{{defaultValue}}` hole in the string it chose — or in any other.
 */
const DEFAULT_VALUE_OPTION = 'defaultValue';

export function createSafeTranslation(
  defaults: Record<string, string>,
  testKey: string,
) {
  // Factory-level fallback: one stable reference per defaults map, so
  // downstream useMemo/useCallback deps don't invalidate every render in
  // the no-translations case.
  const fallbackT = (key: string, options?: Record<string, unknown>) => {
    // Lookup order: defaults table -> inline `defaultValue` -> the key itself
    // (objectui#3865). The table is the pack value's stand-in on this path, so
    // it takes the pack's position in i18next's own order — verified against a
    // real i18next 26.3.6 instance configured the way `createI18n` configures
    // it: `t('anchor', { defaultValue: 'INLINE' })` is the pack's `'Anchor
    // value'`, `t('missing', { defaultValue: 'INLINE' })` is `'INLINE'`, and
    // `t('missing')` is `'missing'`.
    //
    // Before this, the inline default was DEAD on both paths for every
    // component behind this factory: the provider path never reaches it
    // (the pack value always wins), and this path did not read it at all —
    // it rendered the raw key and then treated `defaultValue` as one more
    // interpolation variable. A census over all 26 `createSafeTranslation`
    // hooks measured 27 keys whose table lacks them, 21 of those carrying an
    // inline default that used to be dropped (objectui#3865; the fact is
    // recorded on objectui#3810, whose option C rests on it).
    //
    // Non-strings are ignored rather than coerced — this function returns a
    // `string`, and i18next itself declines a `null` default. `||` (not `??`)
    // keeps the whole chain consistent with the pre-existing `defaults[key] ||`
    // step: an empty string at any position falls through to the next.
    const inlineDefault = options?.[DEFAULT_VALUE_OPTION];
    let value =
      defaults[key] || (typeof inlineDefault === 'string' ? inlineDefault : '') || key;
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        // Reserved: see DEFAULT_VALUE_OPTION. Skipped whatever its type, so an
        // ignored non-string default cannot re-enter through this loop.
        //
        // This is the one deliberate divergence from i18next on this path, and
        // it is unreachable with today's strings: i18next passes the whole
        // options object to its interpolator, so it WOULD render
        // `'Fallback: {{defaultValue}}'` as `'Fallback: INLINE'` (measured on
        // 26.3.6) — but no value in this repo spells that hole (zero hits for
        // `{{defaultValue` across packages/apps/examples), and splicing a
        // fallback string into a hole named after itself has no sensible
        // reading. The alternative — letting a call site's fallback text leak
        // into an unrelated table value — is the worse of the two.
        if (k === DEFAULT_VALUE_OPTION) continue;
        // `split(needle).join(value)` — deliberately not `replace`, and not
        // `replaceAll` either (objectui#3418). This path must agree with
        // i18next, which serves the *provider* path; any divergence is a
        // silent fork that only shows up on provider-less hosts, where we are
        // least likely to see it:
        //   1. `replace` with a string needle substitutes only the FIRST
        //      occurrence. i18next substitutes every one, so a sentence that
        //      repeats a placeholder ("Selected {{count}} of {{count}} items"
        //      — natural in many locales, and often required by RTL /
        //      agglutinative word order) leaked literal braces to users.
        //   2. `replace` AND `replaceAll` both interpret `$&`, `` $` ``, `$'`
        //      and `$$` in the *replacement* string. i18next does not. Values
        //      here are runtime data — record labels, search terms — so this
        //      one is reachable today, unlike (1).
        // split/join is literal on both sides, which is exactly i18next's
        // behaviour, and needs no regex escaping of the placeholder name.
        value = value.split(`{{${k}}}`).join(String(v));
      }
    }
    return value;
  };

  return function useSafeTranslation() {
    // No try/catch around the hook: useObjectTranslation is provider-safe
    // (optional context read + react-i18next global-instance fallback), and
    // wrapping a hook call in try/catch violates rules-of-hooks — a throw
    // after the hook ran would desync hook order on the next render (same
    // fix as objectui#2595/#2596; this factory closure just escaped the
    // static lint). The testKey probe below carries the actual
    // "translations not configured" fallback.
    const result = useObjectTranslation();
    const testValue = result.t(testKey);
    // `language` is surfaced so consumers that localize dates/numbers
    // alongside their copy (data-table, gantt) don't have to call
    // `useObjectTranslation` a second time just to read it. With no provider
    // it is whatever react-i18next reports, which callers may treat as
    // "follow the runtime default".
    if (testValue === testKey) {
      return { t: fallbackT, language: result.language };
    }
    return { t: result.t, language: result.language };
  };
}

/**
 * Per-call graceful translate hook for plugin renderers.
 *
 * Returns `t(keyOrKeys, fallback)`: tries each i18n key in order and returns the
 * first real translation; when no `I18nProvider` is mounted (tests / standalone)
 * or every key is missing, returns the English `fallback` — never a raw key.
 *
 * Unlike {@link createSafeTranslation} (a factory keyed by a defaults map), this
 * takes the English default at each call site, which suits one-off labels like
 * "Total". The key-array form supports a migration fallback chain, e.g.
 * `tt(['common.total', 'dashboard.total'], 'Total')`.
 */
export function useSafeTranslate(): (keyOrKeys: string | string[], fallback: string) => string {
  // Unconditional hook call (rules-of-hooks) — the hook is provider-safe,
  // and a missing translation surfaces as `t(key) === key` per key below,
  // never as a throw. Same fix as createSafeTranslation above.
  const { t } = useObjectTranslation();
  return (keyOrKeys, fallback) => {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    for (const key of keys) {
      const v = t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  };
}
