/**
 * @object-ui/i18n - Core i18n configuration and initialization
 *
 * Wraps i18next with Object UI defaults and built-in locale support.
 */
import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { builtInLocales, isRTL } from './locales/index';
import type { TranslationKeys } from './locales/en';

export interface I18nConfig {
  /** Default language (default: 'en') */
  defaultLanguage?: string;
  /** Fallback language (default: 'en') */
  fallbackLanguage?: string;
  /** Additional translation resources to merge with built-in locales */
  resources?: Record<string, Record<string, unknown>>;
  /** Whether to detect browser language automatically (default: true) */
  detectBrowserLanguage?: boolean;
  /** i18next interpolation options */
  interpolation?: {
    escapeValue?: boolean;
    prefix?: string;
    suffix?: string;
  };
  /**
   * Warn (once per key) in the dev console when a translation key is missing
   * and the UI falls back to the key/defaultValue. Helps catch un-translated
   * static strings while iterating. Defaults to ON outside production builds.
   *
   * Convention-key probes from `useObjectLabel` (object/field/view labels that
   * intentionally fall back to server metadata) are excluded — they are not
   * real "missing keys", just speculative lookups.
   */
  warnMissingKeys?: boolean;
}

/**
 * Internal `t()` option flag set by `useObjectLabel` on its convention-key
 * probes. The missing-key handler skips any lookup carrying this flag, so the
 * deliberate object/field/view label probes (which usually miss and fall back
 * to server metadata) never surface as dev warnings. Not part of the public
 * API — shared between `i18n.ts` and `useObjectLabel.ts` to avoid drift.
 */
export const I18N_PROBE_FLAG = '__ouiLabelProbe';

// Module-scoped ambient: this browser-targeted package omits @types/node, but
// bundlers (Vite/esbuild) statically replace `process.env.NODE_ENV`, so the
// reference is safe and tree-shakes to a constant in production.
declare const process: { env: Record<string, string | undefined> } | undefined;

/** True outside production builds (bundlers statically replace this). */
function isDevEnv(): boolean {
  return typeof process === 'undefined' || process.env.NODE_ENV !== 'production';
}

/**
 * Build a dev-only i18next `missingKeyHandler`. Dedupes by language+key so a
 * missing string warns once, not on every re-render, and stays silent for the
 * convention-key probes flagged with {@link I18N_PROBE_FLAG}.
 */
function createMissingKeyHandler(): (
  lngs: readonly string[],
  ns: string,
  key: string,
  fallbackValue: string,
  updateMissing: boolean,
  options: Record<string, unknown>,
) => void {
  const seen = new Set<string>();
  return (lngs, _ns, key, fallbackValue, _updateMissing, options) => {
    if (options && options[I18N_PROBE_FLAG]) return;
    const lng = Array.isArray(lngs) ? lngs[0] : String(lngs ?? '');
    const dedupeKey = `${lng}:${key}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const fb = fallbackValue ? `"${fallbackValue}"` : 'the key itself';
    console.warn(
      `[object-ui i18n] Missing translation for "${key}" (language "${lng}") — falling back to ${fb}.`,
    );
  };
}

/**
 * Create and initialize an i18next instance with Object UI defaults
 */
export function createI18n(config: I18nConfig = {}): I18nInstance {
  const {
    defaultLanguage = 'en',
    fallbackLanguage = 'en',
    resources = {},
    detectBrowserLanguage = true,
    interpolation,
    warnMissingKeys = isDevEnv(),
  } = config;

  // Merge built-in locales with user-provided resources
  const mergedResources: Record<string, { translation: Record<string, unknown> }> = {};

  for (const [lang, translations] of Object.entries(builtInLocales)) {
    mergedResources[lang] = {
      translation: {
        ...translations,
        ...(resources[lang] || {}),
      },
    };
  }

  // Add any additional languages from resources not in built-in locales
  for (const [lang, translations] of Object.entries(resources)) {
    if (!mergedResources[lang]) {
      mergedResources[lang] = { translation: translations as Record<string, unknown> };
    }
  }

  // Detect browser language if enabled
  let lng = defaultLanguage;
  if (detectBrowserLanguage && typeof navigator !== 'undefined') {
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && mergedResources[browserLang]) {
      lng = browserLang;
    }
  }

  const instance = i18next.createInstance();

  // IMPORTANT: disable react-i18next Suspense. Otherwise `useTranslation()`
  // calls during bootstrap throw a Suspense promise (the i18n instance is
  // technically still "initializing" on the very first render in StrictMode),
  // which unmounts the entire App subtree — including ConditionalAuthWrapper,
  // so the discovery fetch never runs and the splash never appears.
  instance.use(initReactI18next).init({
    lng,
    fallbackLng: fallbackLanguage,
    resources: mergedResources,
    interpolation: {
      escapeValue: false, // React already escapes
      ...interpolation,
    },
    returnNull: false,
    // Dev-only: surface un-translated static keys in the console (deduped,
    // and silent for useObjectLabel's intentional convention-key probes).
    saveMissing: warnMissingKeys,
    missingKeyHandler: warnMissingKeys ? createMissingKeyHandler() : undefined,
    react: {
      useSuspense: false,
    },
  });

  return instance;
}

/**
 * Get the text direction for the current language
 */
export function getDirection(lang: string): 'ltr' | 'rtl' {
  return isRTL(lang) ? 'rtl' : 'ltr';
}

/**
 * Get available languages from an i18n instance
 */
export function getAvailableLanguages(instance: I18nInstance): string[] {
  const resources = instance.options.resources;
  return resources ? Object.keys(resources) : [];
}

export type { TranslationKeys };
