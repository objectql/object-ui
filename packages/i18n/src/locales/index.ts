/**
 * @object-ui/i18n - Locale index
 * Exports all 10 built-in language packs
 */
export { default as en, type TranslationKeys } from './en';
export { default as zh } from './zh';
export { default as ja } from './ja';
export { default as ko } from './ko';
export { default as de } from './de';
export { default as fr } from './fr';
export { default as es } from './es';
export { default as pt } from './pt';
export { default as ru } from './ru';
export { default as ar } from './ar';

/**
 * Map of all built-in locales keyed by language code
 */
import en from './en';
import zh from './zh';
import ja from './ja';
import ko from './ko';
import de from './de';
import fr from './fr';
import es from './es';
import pt from './pt';
import ru from './ru';
import ar from './ar';

export const builtInLocales = { en, zh, ja, ko, de, fr, es, pt, ru, ar } as const;

/**
 * List of RTL language codes
 */
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'] as const;

/**
 * Check if a language code is RTL
 */
export function isRTL(lang: string): boolean {
  return (RTL_LANGUAGES as readonly string[]).includes(lang);
}
