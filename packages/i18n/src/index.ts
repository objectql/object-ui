/**
 * @object-ui/i18n
 *
 * Internationalization (i18n) support for Object UI.
 * Provides 10+ built-in language packs, RTL support, and date/currency formatting.
 *
 * @example
 * ```tsx
 * import { I18nProvider, useObjectTranslation } from '@object-ui/i18n';
 *
 * function App() {
 *   return (
 *     <I18nProvider config={{ defaultLanguage: 'zh' }}>
 *       <MyComponent />
 *     </I18nProvider>
 *   );
 * }
 *
 * function MyComponent() {
 *   const { t, language, changeLanguage, direction } = useObjectTranslation();
 *   return (
 *     <div dir={direction}>
 *       <h1>{t('common.save')}</h1>
 *       <button onClick={() => changeLanguage('en')}>English</button>
 *       <button onClick={() => changeLanguage('zh')}>中文</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

// Core i18n setup
export { createI18n, getDirection, getAvailableLanguages, type I18nConfig, type TranslationKeys } from './i18n.js';

// React integration
export {
  I18nProvider,
  useObjectTranslation,
  useI18nContext,
  // Language-preference persistence: the key the provider writes, and the
  // reader apps that bring their own i18next instance need to honour it.
  LOCALE_STORAGE_KEY,
  readStoredLanguage,
  // Tenant locale seed (objectui#4035) — a SEPARATE slot from the explicit
  // choice above, and never a substitute for it. An app that fetches its
  // tenant's server-side locale caches it here; the provider applies it at
  // bootstrap only when the user has chosen nothing themselves.
  LOCALE_SEED_STORAGE_KEY,
  readCachedLanguageSeed,
  cacheLanguageSeed,
  type I18nProviderProps,
} from './provider.js';

// Safe translation hook factory
export { createSafeTranslation, useSafeTranslate } from './useSafeTranslation.js';

// Convention-based object/field label i18n
export { useObjectLabel, useSafeFieldLabel } from './useObjectLabel.js';

// Locale packs
export { builtInLocales, isRTL, RTL_LANGUAGES } from './locales/index.js';
export { default as en } from './locales/en.js';
export { default as zh } from './locales/zh.js';
export { default as ja } from './locales/ja.js';
export { default as ko } from './locales/ko.js';
export { default as de } from './locales/de.js';
export { default as fr } from './locales/fr.js';
export { default as es } from './locales/es.js';
export { default as pt } from './locales/pt.js';
export { default as ru } from './locales/ru.js';
export { default as ar } from './locales/ar.js';

// Formatting utilities
export {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
  type DateFormatOptions,
  type CurrencyFormatOptions,
  type NumberFormatOptions,
} from './utils/index.js';

// Spec-aligned formatters (v2.0.7)
export {
  resolvePlural,
  formatDateSpec,
  formatNumberSpec,
  applyLocaleConfig,
  type SpecPluralRule,
  type SpecDateFormat,
  type SpecNumberFormat,
  type SpecLocaleConfig,
} from './utils/index.js';

// Spec TranslationData → flat namespace transform (consumed by
// `useObjectLabel`). Exposed so apps don't have to copy/paste — see
// `apps/console/src/loadLanguage.ts` for the canonical consumer.
export {
  isSpecTranslationData,
  transformSpecTranslations,
  type SpecTranslationData,
} from './utils/index.js';

export { pickLocalized, setLocalized } from './pickLocalized.js';
export { LocalizationProvider, useLocalization, type LocalizationValue } from './LocalizationContext.js';
export { resolveFieldCurrency } from './currency.js';

// The one number-display formatter (objectui#4033) and the locale it formats
// in. Every field cell / widget / metric renderer goes through this pair —
// see `utils/number-display.ts` for the grouping policy and its interim status.
export { useDisplayLocale } from './useDisplayLocale.js';
export {
  formatDisplayNumber,
  shouldGroupDisplayNumber,
  type DisplayNumberFormatOptions,
} from './utils/index.js';
