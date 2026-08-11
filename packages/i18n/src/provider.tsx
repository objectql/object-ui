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
 * Languages `createI18n(config)` will know about *synchronously*: the built-in
 * packs plus any extra `config.resources`.
 *
 * `hasOwnProperty` rather than `in`: a junk stored value like `constructor`
 * would pass an `in` check against the locale map's prototype.
 */
function isStaticallyKnownLanguage(lang: string, config?: I18nConfig): boolean {
  const own = Object.prototype.hasOwnProperty;
  return own.call(builtInLocales, lang) || Boolean(config?.resources && own.call(config.resources, lang));
}

/** The built-in packs' codes, as a stable identity for consumers' dep arrays. */
const BUILT_IN_LANGUAGE_CODES: readonly string[] = Object.freeze(Object.keys(builtInLocales));

/**
 * Every language this renderer can produce *without asking the app*: the
 * built-in packs plus `config.resources`.
 *
 * This is the offline/no-backend answer — the set the switcher offers when
 * there is no `loadLocales` wiring, or when the app's locale endpoint cannot
 * be reached (objectui#4039).
 */
function resolvableLanguages(config?: I18nConfig): string[] {
  const extra = Object.keys(config?.resources ?? {}).filter(
    (code) => !BUILT_IN_LANGUAGE_CODES.includes(code),
  );
  return [...BUILT_IN_LANGUAGE_CODES, ...extra];
}

/**
 * Whether `tag` is a well-formed BCP-47 language tag.
 *
 * `Intl.getCanonicalLocales` is the standard's own parser, so this rejects
 * exactly what a locale code cannot be — `constructor`, `__proto__`, `en_US`,
 * `''` all throw `RangeError` — while accepting codes no pack exists for yet
 * (`th`, `pt-BR`). Guarded for runtimes that ship no `Intl`: a language
 * preference is never worth taking the app down for.
 */
function isWellFormedLanguageTag(tag: string): boolean {
  if (typeof Intl === 'undefined' || typeof Intl.getCanonicalLocales !== 'function') {
    return /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(tag);
  }
  try {
    return Intl.getCanonicalLocales(tag).length === 1;
  } catch {
    return false;
  }
}

/**
 * Whether this provider can end up rendering `lang` at all.
 *
 * Wider than {@link isStaticallyKnownLanguage} by exactly one case: when a
 * dynamic {@link I18nProviderProps.loadLanguage} loader is wired, that loader
 * *is* the mechanism that produces app-shipped locales, and nothing can
 * enumerate what it will answer for synchronously — the app's pack for `th`
 * lives behind `GET /api/v1/i18n/translations/th`, not in `config.resources`.
 *
 * This is the lockstep half of objectui#4039. The switcher now offers the
 * app's own locales, so the restore validation had to grow with it or a
 * user-picked app locale would be purged on the next reload — the exact bug
 * objectstack#5418 predicted this fix would otherwise mint. The bound stays
 * honest rather than absent: only well-formed tags qualify, and the app's own
 * locale list adjudicates the choice for real once it lands (see the
 * `provisional` self-heal in {@link I18nProvider}).
 */
function canResolveLanguage(lang: string, config?: I18nConfig, hasLoader = false): boolean {
  if (isStaticallyKnownLanguage(lang, config)) return true;
  return hasLoader && isWellFormedLanguageTag(lang);
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
interface BootstrapResolution {
  /** The config to build the i18next instance from. */
  config: I18nConfig | undefined;
  /**
   * The stored language accepted on the dynamic loader's credit alone — not a
   * built-in pack, not in `config.resources`. Nothing synchronous can confirm
   * the app still ships it, so the app's own locale list adjudicates it once
   * it lands. `null` when the bootstrap language needed no such credit, which
   * is every case that existed before objectui#4039.
   */
  provisional: string | null;
}

function resolveBootstrapConfig(
  config: I18nConfig | undefined,
  persist: boolean,
  hasLoader: boolean,
): BootstrapResolution {
  if (!persist) return { config, provisional: null };
  const stored = readStoredLanguage();
  if (!stored) return { config, provisional: null };
  if (!canResolveLanguage(stored, config, hasLoader)) {
    clearStoredLanguage();
    return { config, provisional: null };
  }
  return {
    config: { ...config, defaultLanguage: stored, detectBrowserLanguage: false },
    provisional: isStaticallyKnownLanguage(stored, config) ? null : stored,
  };
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
  /**
   * The languages a switcher may offer (objectui#4039): the app's own locale
   * list ∩ what this renderer can resolve. Computed here because only the
   * provider knows both sides — the built-in packs, `config.resources` and
   * whether a dynamic loader is wired.
   *
   * `null` means "still asking the app". Consumers render nothing (or a
   * skeleton) rather than a list they will have to retract a tick later.
   * Without {@link I18nProviderProps.loadLocales} wiring, or when the app's
   * endpoint cannot be reached, this is the offline fallback: the built-in
   * packs plus `config.resources`.
   */
  offerableLanguages: readonly string[] | null;
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
   * The app's own locale list — the codes it actually ships translations for
   * (objectui#4039). Wired the same way as {@link I18nProviderProps.loadLanguage}:
   * the app owns the transport, the provider owns what is done with the answer.
   *
   * The console reads `GET /api/v1/i18n/locales`; see
   * `apps/console/src/loadLocales.ts`. Without this prop the switcher keeps
   * offering the built-in packs (plus `config.resources`) exactly as before, so
   * an app that never wires it is unaffected.
   *
   * @example
   * ```tsx
   * <I18nProvider loadLanguage={loadLanguage} loadLocales={loadLocales}>
   *   <App />
   * </I18nProvider>
   * ```
   */
  loadLocales?: () => Promise<string[]>;
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
  loadLocales,
  persistLanguage = true,
  children,
}: I18nProviderProps) {
  // A boolean, not `loadLanguage` itself: an inline arrow would change identity
  // every render and rebuild the i18next instance (and with it the language)
  // on each one. What the bootstrap needs to know is only whether a loader
  // exists at all.
  const hasLoader = Boolean(loadLanguage);
  const bootstrap = useMemo(() => {
    if (externalInstance) return { instance: externalInstance, provisional: null as string | null };
    const resolved = resolveBootstrapConfig(config, persistLanguage, hasLoader);
    return { instance: createI18n(resolved.config), provisional: resolved.provisional };
  }, [externalInstance, config, persistLanguage, hasLoader]);
  const i18nInstance = bootstrap.instance;

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

  // The app's own locale list (objectui#4039). `null` = not answered yet; `[]`
  // = asked and got nothing usable, which is "I don't know", not "I ship no
  // locales" — both degrade to the offline fallback below.
  const [appLocales, setAppLocales] = useState<string[] | null>(null);

  // Asked exactly once per provider, guarded by a ref — the same shape as the
  // `loadedAppLangs` guard on `loadLanguage` above, and for two reasons at
  // once. An inline `loadLocales={() => …}` changes identity every render, so
  // without the guard the answer would set state, the re-render would mint a
  // new arrow, and the new arrow would re-run the effect: a fetch loop. And
  // StrictMode's double-invoked effect must not fire a second request.
  //
  // Deliberately no `cancelled` flag: under StrictMode the cleanup would
  // cancel the only in-flight request while the re-run declines to start
  // another, leaving the list permanently unanswered and the switcher
  // permanently blank. Settling state after unmount is a no-op in React 18 —
  // which is exactly why the `loadLanguage` effect above does the same.
  const hasLocaleLoader = Boolean(loadLocales);
  const askedForLocales = useRef(false);

  useEffect(() => {
    if (!loadLocales || askedForLocales.current) return;
    askedForLocales.current = true;
    loadLocales()
      .then((codes) => setAppLocales(Array.isArray(codes) ? codes : []))
      .catch((err) => {
        // A language menu is not worth an unhandled rejection: fall back to the
        // locales this renderer can produce on its own.
        setAppLocales([]);
        console.warn('[i18n] Failed to load the app locale list:', err);
      });
  }, [loadLocales]);

  const offerableLanguages = useMemo<readonly string[] | null>(() => {
    const fallback = resolvableLanguages(config);
    // No wiring at all: the built-in packs are the whole truth, as before.
    if (!hasLocaleLoader) return fallback;
    if (appLocales === null) return null;
    const offerable = appLocales.filter((code) => canResolveLanguage(code, config, hasLoader));
    // An app that answers with nothing this renderer can produce leaves the
    // user with no way to switch at all — strictly worse than the offline
    // fallback, so the fallback wins.
    return offerable.length > 0 ? offerable : fallback;
  }, [config, hasLocaleLoader, appLocales, hasLoader]);

  // Self-heal: a stored language accepted on the loader's credit alone is
  // adjudicated by the app's real list once it lands. Without this, widening
  // the restore validation would reintroduce exactly what it was written to
  // stop — one stale entry locking the UI to a locale with no translations.
  // Scoped to our own optimism: only the bootstrap language, only while the
  // user has not moved on, and never on an empty/failed answer.
  useEffect(() => {
    const provisional = bootstrap.provisional;
    if (!provisional || !appLocales || appLocales.length === 0) return;
    if (appLocales.includes(provisional)) return;
    if ((i18nInstance.language || '') !== provisional) return;
    const revertTo = config?.defaultLanguage || config?.fallbackLanguage || 'en';
    void (async () => {
      await i18nInstance.changeLanguage(revertTo);
      // Purge AFTER the switch, not before: every language change persists
      // itself (that is the point of the single choke point in the
      // `languageChanged` handler), so clearing first would just be overwritten
      // with `revertTo` — recording a preference the user never expressed and
      // suppressing browser detection from then on. Ending with nothing stored
      // is what the bootstrap purge has always left behind.
      // Guarded: if the user picked something in the meantime, that choice is
      // theirs to keep.
      if ((i18nInstance.language || '') === revertTo) clearStoredLanguage();
    })();
  }, [bootstrap, appLocales, i18nInstance, config]);

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
      offerableLanguages,
    }),
    [language, direction, i18nInstance, loadLanguage, offerableLanguages],
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
    /**
     * Languages a switcher may offer (objectui#4039). `null` while the app's
     * locale list is in flight. Outside a provider there is nobody to ask, so
     * the built-in packs are the answer — not `null`, which would leave a
     * standalone switcher permanently blank.
     */
    offerableLanguages: context ? context.offerableLanguages : BUILT_IN_LANGUAGE_CODES,
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
