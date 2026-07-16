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
        value = value.replace(`{{${k}}}`, String(v));
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
    if (testValue === testKey) {
      return { t: fallbackT };
    }
    return { t: result.t };
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
