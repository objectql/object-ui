/**
 * @object-ui/i18n - React integration
 *
 * Provides I18nProvider and useObjectTranslation hook for React components.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
export function I18nProvider({ config, instance: externalInstance, children }: I18nProviderProps) {
  const i18nInstance = useMemo(
    () => externalInstance || createI18n(config),
    [externalInstance], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [language, setLanguage] = useState(i18nInstance.language || 'en');
  const direction = getDirection(language);

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

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      language,
      changeLanguage: async (lang: string) => {
        await i18nInstance.changeLanguage(lang);
      },
      direction,
      i18n: i18nInstance,
    }),
    [language, direction, i18nInstance],
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
