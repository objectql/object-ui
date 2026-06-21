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
  return function useSafeTranslation() {
    try {
      const result = useObjectTranslation();
      const testValue = result.t(testKey);
      if (testValue === testKey) {
        return {
          t: (key: string, options?: Record<string, unknown>) => {
            let value = defaults[key] || key;
            if (options) {
              for (const [k, v] of Object.entries(options)) {
                value = value.replace(`{{${k}}}`, String(v));
              }
            }
            return value;
          },
        };
      }
      return { t: result.t };
    } catch {
      return {
        t: (key: string, options?: Record<string, unknown>) => {
          let value = defaults[key] || key;
          if (options) {
            for (const [k, v] of Object.entries(options)) {
              value = value.replace(`{{${k}}}`, String(v));
            }
          }
          return value;
        },
      };
    }
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
  let t: ((key: string) => string) | undefined;
  try {
    t = useObjectTranslation().t;
  } catch {
    t = undefined;
  }
  return (keyOrKeys, fallback) => {
    if (!t) return fallback;
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    for (const key of keys) {
      const v = t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  };
}
