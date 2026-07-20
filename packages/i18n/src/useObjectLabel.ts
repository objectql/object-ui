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

import { useMemo } from 'react';
import { useObjectTranslation } from './provider';
import { I18N_PROBE_FLAG } from './i18n';

/**
 * Built-in Object UI top-level locale keys — not app namespaces.
 * Update this set when new top-level platform translation keys are added
 * to `packages/i18n/src/locales/en.ts` to prevent them from being treated
 * as app namespaces during dynamic namespace discovery.
 */
const BUILTIN_KEYS = new Set([
  'common', 'validation', 'form', 'table', 'grid', 'calendar',
  'list', 'kanban', 'chart', 'dashboard', 'configPanel',
  'appDesigner', 'console', 'errors', 'detail',
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

  // Memoize the entire returned object — all closures below reference `t`/`i18n`
  // and stay valid until the language changes. Returning a fresh object on every
  // render was busting downstream `useMemo`/`useCallback` deps in heavy consumers
  // like ListView.filterFields, causing avoidable recomputation.
  return useMemo(() => {

  /**
   * Discover app namespace(s) from loaded i18next resources.
   * Returns top-level keys (outside built-in Object UI keys) that contain
   * an `objects`, `fields`, or `apps` sub-key — e.g. "crm" when resources
   * include crm.objects.* or crm.apps.*.
   */
  const getAppNamespaces = (): string[] => {
    if (!i18n || typeof i18n.getResourceBundle !== 'function') return [];
    const lang = i18n.language || 'en';
    const bundle = i18n.getResourceBundle(lang, 'translation') as Record<string, any> | undefined;
    if (!bundle) return [];
    return Object.keys(bundle).filter(
      (key) => !BUILTIN_KEYS.has(key) && bundle[key] && typeof bundle[key] === 'object'
        && (bundle[key].objects || bundle[key].fields || bundle[key].apps
          || bundle[key].dashboards || bundle[key].pages || bundle[key].reports),
    );
  };

  /**
   * Strip an ObjectStack namespace prefix (e.g. `crm__lead` → `lead`) so that
   * translations authored against short object names still resolve when the
   * runtime presents fully-qualified names. The first `__` separates the
   * package namespace from the base name; everything after is preserved.
   */
  const stripNamespace = (name: string): string => {
    if (typeof name !== 'string') return '';
    const idx = name.indexOf('__');
    return idx > 0 ? name.slice(idx + 2) : name;
  };

  /** Try resolving a key across all discovered app namespaces. */
  const resolve = (suffixes: string | string[], fallback: string): string => {
    const suffixList = Array.isArray(suffixes) ? suffixes : [suffixes];
    try {
      const namespaces = getAppNamespaces();
      for (const ns of namespaces) {
        for (const suffix of suffixList) {
          const key = `${ns}.${suffix}`;
          // `I18N_PROBE_FLAG` marks this as a speculative convention lookup so
          // the dev missing-key warner stays silent when it (expectedly) misses
          // and we fall back to the server-resolved label.
          const translated = t(key, { defaultValue: '', [I18N_PROBE_FLAG]: true });
          if (translated && translated !== key && translated !== '') {
            return translated;
          }
        }
      }
    } catch {
      // Graceful degradation when i18n provider is not available
    }
    return fallback;
  };

  /** Build suffix candidates: prefer the given name, fall back to the base (unprefixed) name. */
  const objectSuffixes = (objectName: string, tail: string): string[] => {
    const base = stripNamespace(objectName);
    return base !== objectName
      ? [`objects.${objectName}.${tail}`, `objects.${base}.${tail}`]
      : [`objects.${objectName}.${tail}`];
  };

  const fieldSuffixes = (objectName: string, fieldName: string): string[] => {
    const base = stripNamespace(objectName);
    return base !== objectName
      ? [`fields.${objectName}.${fieldName}`, `fields.${base}.${fieldName}`]
      : [`fields.${objectName}.${fieldName}`];
  };

  const optionSuffixes = (objectName: string, fieldName: string, optionValue: string): string[] => {
    const base = stripNamespace(objectName);
    return base !== objectName
      ? [
          `fieldOptions.${objectName}.${fieldName}.${optionValue}`,
          `fieldOptions.${base}.${fieldName}.${optionValue}`,
        ]
      : [`fieldOptions.${objectName}.${fieldName}.${optionValue}`];
  };

  /**
   * Build suffix candidates for a dashboard-scoped key. Mirrors the
   * object/field convention: prefer the (possibly namespaced) dashboard name,
   * fall back to the unprefixed base name.
   */
  const dashboardSuffixes = (dashboardName: string, tail: string): string[] => {
    const base = stripNamespace(dashboardName);
    return base !== dashboardName
      ? [`dashboards.${dashboardName}.${tail}`, `dashboards.${base}.${tail}`]
      : [`dashboards.${dashboardName}.${tail}`];
  };

  /**
   * Build suffix candidates for a page-scoped key.
   */
  const pageSuffixes = (pageName: string, tail: string): string[] => {
    const base = stripNamespace(pageName);
    return base !== pageName
      ? [`pages.${pageName}.${tail}`, `pages.${base}.${tail}`]
      : [`pages.${pageName}.${tail}`];
  };

  /**
   * Build suffix candidates for a report-scoped key.
   */
  const reportSuffixes = (reportName: string, tail: string): string[] => {
    const base = stripNamespace(reportName);
    return base !== reportName
      ? [`reports.${reportName}.${tail}`, `reports.${base}.${tail}`]
      : [`reports.${reportName}.${tail}`];
  };

  return {
    /**
     * Resolve translated object label, falling back to objectDef.label.
     */
    objectLabel: (objectDef: { name: string; label: string }) =>
      resolve(objectSuffixes(objectDef.name, 'label'), objectDef.label),

    /**
     * Resolve translated object description, falling back to objectDef.description.
     */
    objectDescription: (objectDef: { name: string; description?: string }) => {
      if (!objectDef.description) return undefined;
      return resolve(objectSuffixes(objectDef.name, 'description'), objectDef.description);
    },

    /**
     * Resolve translated field label, falling back to the provided fallback string.
     */
    fieldLabel: (objectName: string, fieldName: string, fallback: string) =>
      resolve(fieldSuffixes(objectName, fieldName), fallback),

    /**
     * Resolve a translated select option label for a given object field.
     * Falls back to the provided fallback (usually the English option label).
     */
    fieldOptionLabel: (objectName: string, fieldName: string, optionValue: string, fallback: string) =>
      resolve(optionSuffixes(objectName, fieldName, optionValue), fallback),

    /**
     * Translate all options for a given field, returning a new options array
     * with translated labels. Pass the objectName and fieldName to look up
     * translations; the original label is used as fallback.
     */
    translateOptions: (
      objectName: string,
      fieldName: string,
      options: Array<{ value: string; label: string; [key: string]: any }>
    ): Array<{ value: string; label: string; [key: string]: any }> =>
      options.map(opt => ({
        ...opt,
        label: resolve(optionSuffixes(objectName, fieldName, opt.value), opt.label),
      })),

    /**
     * Resolve translated app label, falling back to appDef.label.
     * Looks up `{ns}.apps.{appName}.label` from loaded i18next resources.
     */
    appLabel: (appDef: { name: string; label?: string }) =>
      resolve(`apps.${appDef.name}.label`, appDef.label ?? appDef.name),

    /**
     * Resolve translated app description, falling back to appDef.description.
     * Returns the translated value even when metadata has no description —
     * translation-only descriptions (defined only in i18n bundles) are common
     * in examples where the app metadata is English-only.
     */
    appDescription: (appDef: { name: string; description?: string }) => {
      const fallback = appDef.description ?? '';
      const resolved = resolve(`apps.${appDef.name}.description`, fallback);
      return resolved || undefined;
    },

    /**
     * Resolve translated label for a navigation group within an app.
     * Convention: `{ns}.apps.{appName}.navigation.{groupId}.label`.
     *
     * Mirrors `objectLabel`/`dashboardLabel` so app metadata can keep
     * English fallbacks while translation packs supply localised
     * sidebar group labels (e.g. "Sales" → "销售") without explicit
     * I18nLabel `{ key, defaultValue }` annotations.
     */
    navGroupLabel: (appName: string, groupId: string, fallback: string) =>
      resolve(`apps.${appName}.navigation.${groupId}.label`, fallback),

    /**
     * Resolve translated dashboard label, falling back to dashboardDef.label.
     * Convention: `{ns}.dashboards.{dashboardName}.label`.
     */
    dashboardLabel: (dashboardDef: { name: string; label?: string }) =>
      resolve(dashboardSuffixes(dashboardDef.name, 'label'), dashboardDef.label ?? dashboardDef.name),

    /**
     * Resolve translated dashboard description, falling back to
     * dashboardDef.description. Returns undefined when neither metadata nor
     * translation provides one.
     * Convention: `{ns}.dashboards.{dashboardName}.description`.
     */
    dashboardDescription: (dashboardDef: { name: string; description?: string }) => {
      const fallback = dashboardDef.description ?? '';
      const resolved = resolve(dashboardSuffixes(dashboardDef.name, 'description'), fallback);
      return resolved || undefined;
    },

    /**
     * Resolve translated dashboard header-action label.
     * Convention: `{ns}.dashboards.{dashboardName}.actions.{actionKey}.label`.
     * The actionKey is typically the action's `actionUrl` (e.g.
     * `create_opportunity`) or its English label slugified.
     */
    dashboardActionLabel: (dashboardName: string, actionKey: string, fallback: string) =>
      resolve(dashboardSuffixes(dashboardName, `actions.${actionKey}.label`), fallback),

    /**
     * Resolve translated widget title within a dashboard.
     * Convention: `{ns}.dashboards.{dashboardName}.widgets.{widgetId}.title`.
     */
    widgetTitle: (dashboardName: string, widgetId: string, fallback: string) =>
      resolve(dashboardSuffixes(dashboardName, `widgets.${widgetId}.title`), fallback),

    /**
     * Resolve translated widget description within a dashboard.
     * Convention: `{ns}.dashboards.{dashboardName}.widgets.{widgetId}.description`.
     * Returns undefined when neither metadata nor translation provides one.
     */
    widgetDescription: (dashboardName: string, widgetId: string, fallback?: string) => {
      const fb = fallback ?? '';
      const resolved = resolve(dashboardSuffixes(dashboardName, `widgets.${widgetId}.description`), fb);
      return resolved || undefined;
    },

    /**
     * Resolve translated page label, falling back to pageDef.label.
     * Convention: `{ns}.pages.{pageName}.label`.
     */
    pageLabel: (pageDef: { name: string; label?: string }) =>
      resolve(pageSuffixes(pageDef.name, 'label'), pageDef.label ?? pageDef.name),

    /**
     * Resolve translated report label, falling back to reportDef.label.
     * Convention: `{ns}.reports.{reportName}.label`.
     */
    reportLabel: (reportDef: { name: string; label?: string }) =>
      resolve(reportSuffixes(reportDef.name, 'label'), reportDef.label ?? reportDef.name),

    /**
     * Resolve translated list-view label.
     * Convention (per @objectstack/spec): `{ns}.objects.{objectName}._views.{viewName}.label`.
     */
    viewLabel: (objectName: string, viewName: string, fallback: string) =>
      resolve(objectSuffixes(objectName, `_views.${viewName}.label`), fallback),

    /**
     * Resolve translated list-view description.
     * Convention: `{ns}.objects.{objectName}._views.{viewName}.description`.
     */
    viewDescription: (objectName: string, viewName: string, fallback?: string) => {
      const fb = fallback ?? '';
      const resolved = resolve(objectSuffixes(objectName, `_views.${viewName}.description`), fb);
      return resolved || undefined;
    },

    /**
     * Resolve translated list-view emptyState. Returns a {title, message}
     * tuple with each field independently translated. Convention:
     *   `{ns}.objects.{objectName}._views.{viewName}.emptyState.title`
     *   `{ns}.objects.{objectName}._views.{viewName}.emptyState.message`
     */
    viewEmptyState: (
      objectName: string,
      viewName: string,
      fallback: { title?: string; message?: string; icon?: string } | undefined,
    ) => {
      if (!fallback) return undefined;
      const title = fallback.title
        ? resolve(objectSuffixes(objectName, `_views.${viewName}.emptyState.title`), fallback.title)
        : fallback.title;
      const message = fallback.message
        ? resolve(objectSuffixes(objectName, `_views.${viewName}.emptyState.message`), fallback.message)
        : fallback.message;
      return { ...fallback, title, message };
    },

    /**
     * Resolve translated form-section label.
     * Convention: `{ns}.objects.{objectName}._sections.{sectionName}.label`.
     */
    sectionLabel: (objectName: string, sectionName: string, fallback: string) =>
      resolve(objectSuffixes(objectName, `_sections.${sectionName}.label`), fallback),

    /**
     * Resolve translated action label.
     * Convention: `{ns}.objects.{objectName}._actions.{actionName}.label`.
     * Falls back to `{ns}.globalActions.{actionName}.label` when objectName is omitted.
     */
    actionLabel: (objectName: string | undefined, actionName: string, fallback: string) => {
      if (objectName) {
        return resolve(objectSuffixes(objectName, `_actions.${actionName}.label`), fallback);
      }
      return resolve(`globalActions.${actionName}.label`, fallback);
    },

    /**
     * Resolve translated action confirmation prompt.
     * Convention: `{ns}.objects.{objectName}._actions.{actionName}.confirmText`.
     * Returns undefined when no translation and no fallback exist.
     */
    actionConfirm: (objectName: string | undefined, actionName: string, fallback?: string) => {
      const fb = fallback ?? '';
      const suffixes = objectName
        ? objectSuffixes(objectName, `_actions.${actionName}.confirmText`)
        : `globalActions.${actionName}.confirmText`;
      const resolved = resolve(suffixes, fb);
      return resolved || undefined;
    },

    /**
     * Resolve translated action success message.
     * Convention: `{ns}.objects.{objectName}._actions.{actionName}.successMessage`.
     */
    actionSuccess: (objectName: string | undefined, actionName: string, fallback?: string) => {
      const fb = fallback ?? '';
      const suffixes = objectName
        ? objectSuffixes(objectName, `_actions.${actionName}.successMessage`)
        : `globalActions.${actionName}.successMessage`;
      const resolved = resolve(suffixes, fb);
      return resolved || undefined;
    },

    /**
     * Resolve translated action description (the explanatory line shown in the
     * action's param dialog / sheet / drawer header).
     * Convention: `{ns}.objects.{objectName}._actions.{actionName}.description`.
     * Falls back to `{ns}.globalActions.{actionName}.description`, then the
     * metadata's literal string; undefined when nothing resolves.
     */
    actionDescription: (objectName: string | undefined, actionName: string | undefined, fallback?: string) => {
      const fb = fallback ?? '';
      if (!actionName) return fb || undefined;
      const suffixes = objectName
        ? objectSuffixes(objectName, `_actions.${actionName}.description`)
        : `globalActions.${actionName}.description`;
      const resolved = resolve(suffixes, fb);
      return resolved || undefined;
    },

    /**
     * Resolve translated action-PARAMETER text (label / placeholder / helpText).
     * Convention: `{ns}.objects.{objectName}._actions.{actionName}.params.{paramName}.{attr}`.
     * Falls back to the provided value (the metadata's literal string) when no
     * translation exists, so untranslated params keep rendering as authored.
     */
    actionParamText: (
      objectName: string | undefined,
      actionName: string | undefined,
      paramName: string,
      attr: 'label' | 'placeholder' | 'helpText',
      fallback?: string,
    ) => {
      const fb = fallback ?? '';
      if (!actionName || !paramName) return fb || undefined;
      const suffix = `_actions.${actionName}.params.${paramName}.${attr}`;
      const suffixes = objectName
        ? objectSuffixes(objectName, suffix)
        : `globalActions.${actionName}.params.${paramName}.${attr}`;
      const resolved = resolve(suffixes, fb);
      return resolved || undefined;
    },
    /**
     * Resolve a translated action-parameter SELECT OPTION label.
     * Convention: `{ns}.objects.{objectName}._actions.{actionName}.params.{paramName}.options.{optionValue}`.
     * Falls back to the provided (English metadata) label when untranslated.
     */
    actionParamOptionLabel: (
      objectName: string | undefined,
      actionName: string | undefined,
      paramName: string,
      optionValue: string,
      fallback: string,
    ) => {
      if (!actionName || !paramName) return fallback;
      const suffix = `_actions.${actionName}.params.${paramName}.options.${optionValue}`;
      const suffixes = objectName
        ? objectSuffixes(objectName, suffix)
        : `globalActions.${actionName}.params.${paramName}.options.${optionValue}`;
      return resolve(suffixes, fallback);
    },
  };
  }, [t, i18n]);
}

/**
 * Stable identity fallbacks for `useSafeFieldLabel` — referenced from a
 * module-level constant so consumers using the fallback branch don't get a
 * fresh object reference on every render (which would invalidate downstream
 * memoization in heavy components like ListView).
 */
const SAFE_FIELD_LABEL_FALLBACK = {
  fieldLabel: (_objectName: string, _fieldName: string, fallback: string) => fallback,
  translateOptions: (
    _objectName: string,
    _fieldName: string,
    options: Array<{ value: string; label: string; [key: string]: any }>
  ) => options,
  fieldOptionLabel: (_objectName: string, _fieldName: string, _optionValue: string, fallback: string) => fallback,
  sectionLabel: (_objectName: string, _sectionName: string, fallback: string) => fallback,
  actionLabel: (_objectName: string | undefined, _actionName: string, fallback: string) => fallback,
};

/**
 * Safe wrapper for useObjectLabel that falls back to identity functions
 * when no I18nProvider is available. Suitable for plugin components that
 * may be rendered outside an i18n context.
 */
export function useSafeFieldLabel() {
  // useObjectLabel delegates to the provider-safe useObjectTranslation (react-
  // i18next falls back to the global instance and never throws), so it needs no
  // try/catch — wrapping the hook call would violate rules-of-hooks. It already
  // returns a stable memoized object; the module-level fallback stays as a
  // defensive default, reached only if it ever returns nullish.
  return useObjectLabel() ?? SAFE_FIELD_LABEL_FALLBACK;
}
