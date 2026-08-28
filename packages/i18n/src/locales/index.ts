/**
 * @object-ui/i18n - Locale index
 * Exports all 10 built-in language packs
 */
export { default as en, type TranslationKeys } from './en.js';
export { default as zh } from './zh.js';
export { default as ja } from './ja.js';
export { default as ko } from './ko.js';
export { default as de } from './de.js';
export { default as fr } from './fr.js';
export { default as es } from './es.js';
export { default as pt } from './pt.js';
export { default as ru } from './ru.js';
export { default as ar } from './ar.js';

/**
 * Map of all built-in locales keyed by language code
 */
import en from './en.js';
import zh from './zh.js';
import ja from './ja.js';
import ko from './ko.js';
import de from './de.js';
import fr from './fr.js';
import es from './es.js';
import pt from './pt.js';
import ru from './ru.js';
import ar from './ar.js';

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
