/**
 * @object-ui/i18n - Convention-based Object & Field Label i18n
 *
 * Provides automatic translation resolution for object metadata labels
 * using Salesforce-style convention-based key generation.
 *
 * The app namespace (e.g. "crm") is discovered dynamically from loaded
 * i18next resources — no hardcoded app names in platform code.
 *
 * Convention Rules:
 * | What               | Auto-generated key                              | Fallback              |
 * |--------------------|-------------------------------------------------|-----------------------|
 * | Object label       | {ns}.objects.{objectName}.label                  | objectDef.label       |
 * | Object description | {ns}.objects.{objectName}.description             | objectDef.description |
 * | Field label        | {ns}.fields.{objectName}.{fieldName}              | field.label           |
 *
 * @module useObjectLabel
 */

import { useObjectTranslation } from './provider';

/**
 * Built-in Object UI top-level locale keys — not app namespaces.
 * Update this set when new top-level platform translation keys are added
 * to `packages/i18n/src/locales/en.ts` to prevent them from being treated
 * as app namespaces during dynamic namespace discovery.
 */
const BUILTIN_KEYS = new Set([
  'common', 'validation', 'form', 'table', 'grid', 'calendar',
  'list', 'kanban', 'chart', 'dashboard', 'configPanel',
  'appDesigner', 'console', 'errors',
]);

/**
 * Hook for convention-based auto-resolution of object and field labels.
 *
 * Automatically constructs i18n keys from object/field names and looks up
 * translations, falling back to the plain-string label when no translation exists.
 *
 * The app namespace is discovered dynamically from loaded i18next resources
 * by finding top-level keys that contain an `objects` sub-key.
 *
 * @example
 * ```tsx
 * const { objectLabel, fieldLabel } = useObjectLabel();
 * <h1>{objectLabel(objectDef)}</h1>
 * ```
 */
export function useObjectLabel() {
  const { t, i18n } = useObjectTranslation();

  /**
   * Discover app namespace(s) from loaded i18next resources.
   * Returns top-level keys (outside built-in Object UI keys) that contain
   * an `objects` or `fields` sub-key — e.g. "crm" when resources include crm.objects.*.
   */
  const getAppNamespaces = (): string[] => {
    if (!i18n || typeof i18n.getResourceBundle !== 'function') return [];
    const lang = i18n.language || 'en';
    const bundle = i18n.getResourceBundle(lang, 'translation') as Record<string, any> | undefined;
    if (!bundle) return [];
    return Object.keys(bundle).filter(
      (key) => !BUILTIN_KEYS.has(key) && bundle[key] && typeof bundle[key] === 'object'
        && (bundle[key].objects || bundle[key].fields),
    );
  };

  /** Try resolving a key across all discovered app namespaces. */
  const resolve = (suffix: string, fallback: string): string => {
    try {
      const namespaces = getAppNamespaces();
      for (const ns of namespaces) {
        const key = `${ns}.${suffix}`;
        const translated = t(key, { defaultValue: '' });
        if (translated && translated !== key && translated !== '') {
          return translated;
        }
      }
    } catch {
      // Graceful degradation when i18n provider is not available
    }
    return fallback;
  };

  return {
    /**
     * Resolve translated object label, falling back to objectDef.label.
     */
    objectLabel: (objectDef: { name: string; label: string }) =>
      resolve(`objects.${objectDef.name}.label`, objectDef.label),

    /**
     * Resolve translated object description, falling back to objectDef.description.
     */
    objectDescription: (objectDef: { name: string; description?: string }) => {
      if (!objectDef.description) return undefined;
      return resolve(`objects.${objectDef.name}.description`, objectDef.description);
    },

    /**
     * Resolve translated field label, falling back to the provided fallback string.
     */
    fieldLabel: (objectName: string, fieldName: string, fallback: string) =>
      resolve(`fields.${objectName}.${fieldName}`, fallback),
  };
}

/**
 * Safe wrapper for useObjectLabel that falls back to identity functions
 * when no I18nProvider is available. Suitable for plugin components that
 * may be rendered outside an i18n context.
 */
export function useSafeFieldLabel() {
  try {
    const { fieldLabel } = useObjectLabel();
    return { fieldLabel };
  } catch {
    return {
      fieldLabel: (_objectName: string, _fieldName: string, fallback: string) => fallback,
    };
  }
}
