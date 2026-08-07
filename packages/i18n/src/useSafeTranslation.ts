/**
 * Safe translation hook with fallback to default strings.
 *
 * When no I18nProvider is available (e.g., in tests or standalone usage),
 * this hook falls back to the provided default translations instead of
 * returning raw i18n keys.
 *
 * @param defaults - Fallback English translations keyed by i18n key
 * @param testKey - A key to test if i18n is properly configured (must be in defaults)
 */
import { useObjectTranslation } from './provider';

export function createSafeTranslation(
  defaults: Record<string, string>,
  testKey: string,
) {
  // Factory-level fallback: one stable reference per defaults map, so
  // downstream useMemo/useCallback deps don't invalidate every render in
  // the no-translations case.
  const fallbackT = (key: string, options?: Record<string, unknown>) => {
    let value = defaults[key] || key;
    if (options) {
      for (const [k, v] of Object.entries(options)) {
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
