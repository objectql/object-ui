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
