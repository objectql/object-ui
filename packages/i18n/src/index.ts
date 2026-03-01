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
export { createI18n, getDirection, getAvailableLanguages, type I18nConfig, type TranslationKeys } from './i18n';

// React integration
export { I18nProvider, useObjectTranslation, useI18nContext, type I18nProviderProps } from './provider';

// Convention-based object/field label i18n
export { useObjectLabel, useSafeFieldLabel } from './useObjectLabel';

// Locale packs
export { builtInLocales, isRTL, RTL_LANGUAGES } from './locales/index';
export { default as en } from './locales/en';
export { default as zh } from './locales/zh';
export { default as ja } from './locales/ja';
export { default as ko } from './locales/ko';
export { default as de } from './locales/de';
export { default as fr } from './locales/fr';
export { default as es } from './locales/es';
export { default as pt } from './locales/pt';
export { default as ru } from './locales/ru';
export { default as ar } from './locales/ar';

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
} from './utils/index';

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
} from './utils/index';
