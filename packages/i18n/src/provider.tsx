/**
 * @object-ui/i18n - React integration
 *
 * Provides I18nProvider and useObjectTranslation hook for React components.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import { createI18n, getDirection, type I18nConfig } from './i18n';
import { builtInLocales } from './locales/index';

/**
 * `localStorage` key holding the user's explicit language choice.
 *
 * Follows the console's existing preference-key convention
 * (`objectui-favorites`, `objectui-recent-items`), and sits beside the theme
 * preference the same avatar menu writes — a language switch is a preference,
 * not ephemeral UI state, so it belongs in storage (AGENTS.md §5 #8).
 *
 * Exported so an app that builds its own i18next instance (and therefore owns
 * its bootstrap language — see {@link I18nProviderProps.instance}) can honour
 * the same preference, and so a sign-out flow can clear it.
 */
export const LOCALE_STORAGE_KEY = 'objectui-locale';

/**
 * Read the persisted language choice, or `null` when nothing is stored.
 *
 * Defensive by design: `localStorage` does not exist under SSR and *throws* on
 * access in Safari private mode / partitioned iframes. A language preference is
 * never worth taking the app down for, so every failure degrades to "nothing
 * stored".
 */
export function readStoredLanguage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredLanguage(lang: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, lang);
  } catch {
    // Storage blocked or full — the switch still applies for this session.
  }
}

function clearStoredLanguage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // Nothing readable means nothing to purge.
  }
}

/**
 * Languages `createI18n(config)` will know about: the built-in packs plus any
 * extra `config.resources`.
 *
 * `hasOwnProperty` rather than `in`: a junk stored value like `constructor`
 * would pass an `in` check against the locale map's prototype.
 */
function isKnownLanguage(lang: string, config?: I18nConfig): boolean {
  const own = Object.prototype.hasOwnProperty;
  return own.call(builtInLocales, lang) || Boolean(config?.resources && own.call(config.resources, lang));
}

/**
 * Resolve the bootstrap config for a provider-owned i18next instance, applying
 * a stored language choice when there is a usable one.
 *
 * Applied at instance creation rather than through a post-mount
 * `changeLanguage`, because the very first render must already be in the right
 * locale: `<html lang>` seeds the `Accept-Language` header on every API call
 * (`createAuthenticatedFetch`, issue #1319), so a late switch would fetch the
 * first wave of server-resolved metadata labels in the wrong language and then
 * have to remount to fix it.
 *
 * A stored choice outranks browser detection (which itself outranks
 * `defaultLanguage` in `createI18n`) — otherwise a user who picked 中文 on a
 * `ja` browser would be handed `ja` back on every reload, and the preference
 * would be unusable for exactly the users who need it.
 *
 * A stored value the app no longer offers is dropped *and purged*, so one stale
 * entry can never lock the UI to a locale that has no translations.
 */
function resolveBootstrapConfig(
  config: I18nConfig | undefined,
  persist: boolean,
): I18nConfig | undefined {
  if (!persist) return config;
  const stored = readStoredLanguage();
  if (!stored) return config;
  if (!isKnownLanguage(stored, config)) {
    clearStoredLanguage();
    return config;
  }
  return { ...config, defaultLanguage: stored, detectBrowserLanguage: false };
}

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
  /**
   * Remember the active language in `localStorage` ({@link LOCALE_STORAGE_KEY})
   * and restore it on the next mount. Default: `true`.
   *
   * Every language change on the instance is persisted — whether it came from
   * this provider's `changeLanguage`, a switcher calling
   * `i18n.changeLanguage()` directly, or app code — because the promise the UI
   * makes ("this is my language now") must not depend on which API the caller
   * reached for.
   *
   * The *restore* half only applies to an instance this provider creates: when
   * you pass your own {@link I18nProviderProps.instance}, its bootstrap
   * language is yours to choose (call {@link readStoredLanguage} if you want
   * the same preference honoured).
   *
   * Set `false` for surfaces that must stay on a fixed language regardless of
   * what the user picked elsewhere on the origin — previews, demos, screenshot
   * harnesses.
   */
  persistLanguage?: boolean;
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
export function I18nProvider({
  config,
  instance: externalInstance,
  loadLanguage,
  persistLanguage = true,
  children,
}: I18nProviderProps) {
  const i18nInstance = useMemo(
    () => externalInstance || createI18n(resolveBootstrapConfig(config, persistLanguage)),
    [externalInstance, config, persistLanguage],
  );

  const [language, setLanguage] = useState(i18nInstance.language || 'en');
  const direction = getDirection(language);

  // Track which languages have had app-specific translations loaded
  // (separate from built-in locales that ship with the library)
  const loadedAppLangs = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLanguage(lng);
      // Remember the choice. This is the single choke point every switch runs
      // through — i18next fires `languageChanged` for the context's
      // `changeLanguage` and for a direct `i18n.changeLanguage()` alike — so no
      // switcher can be wired in a way that silently forgets the preference.
      // Bootstrap does NOT fire this event, so restoring a stored language
      // never re-writes it.
      if (persistLanguage) writeStoredLanguage(lng);
      // Update document direction for RTL support
      if (typeof document !== 'undefined') {
        document.documentElement.dir = getDirection(lng);
        document.documentElement.lang = lng;
      }
    };

    // Apply the initial language to <html> immediately. i18next does NOT
    // fire `languageChanged` for the bootstrap language, so without this
    // call `document.documentElement.lang` would stay at its server-rendered
    // default ('en') even though the app is rendering in another locale.
    // Downstream renderers (e.g. `@object-ui/components` containers.tsx)
    // rely on the <html lang=…> attribute to pick the right translation
    // dictionary.
    const initialLang = i18nInstance.language || language;
    if (typeof document !== 'undefined' && initialLang) {
      document.documentElement.dir = getDirection(initialLang);
      document.documentElement.lang = initialLang;
    }

    i18nInstance.on('languageChanged', handleLanguageChanged);
    return () => {
      i18nInstance.off('languageChanged', handleLanguageChanged);
    };
  }, [i18nInstance, persistLanguage]);

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
