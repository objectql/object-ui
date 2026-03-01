/**
 * @object-ui/i18n - React integration
 *
 * Provides I18nProvider and useObjectTranslation hook for React components.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import { createI18n, getDirection, type I18nConfig } from './i18n';

interface I18nContextValue {
  /** Current language code */
  language: string;
  /** Change the active language */
  changeLanguage: (lang: string) => Promise<void>;
  /** Current text direction ('ltr' or 'rtl') */
  direction: 'ltr' | 'rtl';
  /** The underlying i18next instance */
  i18n: I18nInstance;
}

const ObjectI18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  /** i18n configuration options */
  config?: I18nConfig;
  /** Pre-created i18next instance (overrides config) */
  instance?: I18nInstance;
  /**
   * Dynamic language pack loader (v2.0.7).
   * When set, language packs are loaded lazily instead of being bundled.
   * Should return a translation resource object for the given language code.
   *
   * @example
   * ```tsx
   * <I18nProvider
   *   loadLanguage={async (lang) => {
   *     const mod = await import(`./locales/${lang}.json`);
   *     return mod.default;
   *   }}
   * >
   *   <App />
   * </I18nProvider>
   * ```
   */
  loadLanguage?: (lang: string) => Promise<Record<string, unknown>>;
  /** Children to render */
  children: React.ReactNode;
}

/**
 * I18nProvider - Wraps your app with i18n support
 *
 * @example
 * ```tsx
 * <I18nProvider config={{ defaultLanguage: 'zh' }}>
 *   <App />
 * </I18nProvider>
 * ```
 */
export function I18nProvider({ config, instance: externalInstance, loadLanguage, children }: I18nProviderProps) {
  const i18nInstance = useMemo(
    () => externalInstance || createI18n(config),
    [externalInstance, config],
  );

  const [language, setLanguage] = useState(i18nInstance.language || 'en');
  const direction = getDirection(language);

  // Track which languages have had app-specific translations loaded
  // (separate from built-in locales that ship with the library)
  const loadedAppLangs = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLanguage(lng);
      // Update document direction for RTL support
      if (typeof document !== 'undefined') {
        document.documentElement.dir = getDirection(lng);
        document.documentElement.lang = lng;
      }
    };

    i18nInstance.on('languageChanged', handleLanguageChanged);
    return () => {
      i18nInstance.off('languageChanged', handleLanguageChanged);
    };
  }, [i18nInstance]);

  // Load app-specific translations for the initial language on mount
  useEffect(() => {
    if (!loadLanguage) return;
    const currentLang = i18nInstance.language || 'en';
    if (loadedAppLangs.current.has(currentLang)) return;
    loadedAppLangs.current.add(currentLang);
    loadLanguage(currentLang).then((resources) => {
      if (resources && Object.keys(resources).length > 0) {
        i18nInstance.addResourceBundle(currentLang, 'translation', resources, true, true);
        // Force re-render so components pick up newly loaded translations
        setLanguage(currentLang);
      }
    }).catch((err) => {
      // Allow retry on failure by removing from loaded set
      loadedAppLangs.current.delete(currentLang);
      console.warn(`[i18n] Failed to load app translations for '${currentLang}':`, err);
    });
  }, [i18nInstance, loadLanguage]);

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      language,
      changeLanguage: async (lang: string) => {
        // Dynamic language pack loading (v2.0.7)
        if (loadLanguage && !loadedAppLangs.current.has(lang)) {
          loadedAppLangs.current.add(lang);
          try {
            const resources = await loadLanguage(lang);
            i18nInstance.addResourceBundle(lang, 'translation', resources, true, true);
          } catch (err) {
            loadedAppLangs.current.delete(lang);
            console.warn(`[i18n] Failed to load app translations for '${lang}':`, err);
          }
        }
        await i18nInstance.changeLanguage(lang);
      },
      direction,
      i18n: i18nInstance,
    }),
    [language, direction, i18nInstance, loadLanguage],
  );

  return React.createElement(
    ObjectI18nContext.Provider,
    { value: contextValue },
    React.createElement(I18nextProvider, { i18n: i18nInstance }, children),
  );
}

/**
 * Hook to access Object UI i18n context
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t, language, changeLanguage, direction } = useObjectTranslation();
 *   return <div dir={direction}>{t('common.save')}</div>;
 * }
 * ```
 */
export function useObjectTranslation(ns?: string) {
  const context = useContext(ObjectI18nContext);
  const { t, i18n } = useTranslation(ns);

  return {
    /** Translation function */
    t,
    /** Current language code */
    language: context?.language || i18n.language || 'en',
    /** Change the active language */
    changeLanguage: context?.changeLanguage || (async (lang: string) => { await i18n.changeLanguage(lang); }),
    /** Current text direction */
    direction: context?.direction || 'ltr',
    /** The underlying i18next instance */
    i18n,
  };
}

/**
 * Hook to access the i18n context directly
 */
export function useI18nContext(): I18nContextValue {
  const context = useContext(ObjectI18nContext);
  if (!context) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
}
