/**
 * Utility functions for ObjectStack Console
 */

export {
  resolveRecordFormTarget,
  resolveFormViewLayout,
} from './recordFormNavigation';
export type {
  ObjectDefinitionForNavigation,
  RecordFormTarget,
  ObjectDefinitionForFormView,
  FormViewDefinition,
  FormViewModalLayout,
} from './recordFormNavigation';

export { deriveRelatedLists } from './deriveRelatedLists';
export type { DerivedRelatedList } from './deriveRelatedLists';

export { preferLocal } from './preferLocal';
export { appRouteSegment, matchAppBySegment } from './appRoute';

/**
 * Resolves an I18nLabel to a plain string.
 * I18nLabel can be either a string or an object { key, defaultValue?, params? }.
 * When it's an object and a `t` function is provided, it resolves the key
 * through the i18n translation system. Otherwise returns defaultValue or key.
 */
export function resolveI18nLabel(
  label: string | { key: string; defaultValue?: string; params?: Record<string, any> } | undefined,
  t?: (key: string, options?: any) => string,
): string | undefined {
  if (label === undefined || label === null) return undefined;
  if (typeof label === 'string') return label;
  if (t) {
    const result = t(label.key, { defaultValue: label.defaultValue, ...label.params });
    if (result && result !== label.key) return result;
  }
  return label.defaultValue || label.key;
}

/**
 * Capitalize the first letter of a string.
 * Preferred over CSS `capitalize` for i18n compatibility.
 */
export function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Sentinel used to mark empty-placeholder positions inside formatRecordTitle
// so adjacent separators can be stripped in a second pass.
const EMPTY_TOKEN = '\u0000';
// Separator characters commonly placed between {fields} in titleFormat patterns
// (hyphen, em/en dashes, pipes, slashes, middle dot, comma, colon).
const SEPARATOR_CLASS = '[-\\u2013\\u2014|/·,:]';

/**
 * Format a record title using the titleFormat pattern.
 *
 * Accepts either a legacy string template or an Expression envelope
 * (`{ dialect: 'template', source: string }`) emitted by `@objectstack/spec`'s
 * normalized templates. The placeholder syntax (`{field}`) is identical in both
 * shapes; only the wrapping object is new.
 *
 * Empty placeholders (missing or null/empty fields) are stripped along with
 * any orphan separator they leave behind, so a template like
 *   "{full_name} - {company}"
 * evaluated against `{ company: "Acme" }` resolves to `"Acme"` rather than
 * `" - Acme"`. Returns an empty string when no placeholder resolved.
 */
export function formatRecordTitle(titleFormat: string | { source?: string } | undefined, record: any): string {
  // Normalize Expression envelope ({ dialect, source }) → raw template string.
  const template: string | undefined =
    typeof titleFormat === 'string'
      ? titleFormat
      : (titleFormat && typeof titleFormat === 'object' && typeof titleFormat.source === 'string')
        ? titleFormat.source
        : undefined;

  if (!template || !record) {
    return record?.id || record?._id || 'Record';
  }

  let anyResolved = false;
  let out = template.replace(/\{([^{}]+)\}/g, (_match, fieldName) => {
    // Support dotted paths (e.g. `{account.name}`) for $expanded lookups.
    const parts = String(fieldName).trim().split('.');
    let value: any = record;
    for (const p of parts) {
      if (value == null) break;
      value = (value as any)[p];
    }
    // Auto-extract display name from expanded reference objects, with a
    // Salesforce-style fallback chain.
    if (value && typeof value === 'object') {
      const o = value as any;
      let display: any =
        o.name ?? o.full_name ?? o.display_name ?? o.label ?? o.title ?? o.subject ?? null;
      if (display == null || (typeof display === 'string' && !display.trim())) {
        const composite = [o.salutation, o.first_name, o.last_name]
          .filter((p: any) => typeof p === 'string' && p.trim())
          .map((p: string) => p.trim())
          .join(' ');
        if (composite) display = composite;
        else if (typeof o.email === 'string' && o.email.trim()) display = o.email.trim();
        else display = null;
      }
      value = display;
    }
    if (value === null || value === undefined || value === '') {
      return EMPTY_TOKEN;
    }
    anyResolved = true;
    return String(value);
  });

  if (!anyResolved) return '';

  // Drop separators on either side of an empty token, then any leftover
  // tokens, then collapse runs of whitespace.
  const sepBefore = new RegExp(`\\s*${SEPARATOR_CLASS}\\s*${EMPTY_TOKEN}`, 'g');
  const sepAfter = new RegExp(`${EMPTY_TOKEN}\\s*${SEPARATOR_CLASS}\\s*`, 'g');
  out = out
    .replace(sepBefore, '')
    .replace(sepAfter, '')
    .replace(new RegExp(EMPTY_TOKEN, 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();

  return out;
}

/**
 * Get display name for a record using titleFormat or fallback
 * @param objectDef Object definition with optional titleFormat
 * @param record The record data
 * @returns Display name for the record
 */
export function getRecordDisplayName(objectDef: any, record: any): string {
  if (objectDef?.titleFormat) {
    const formatted = formatRecordTitle(objectDef.titleFormat, record);
    if (formatted) return formatted;
  }

  return (
    record?.name ||
    record?.full_name ||
    record?.fullName ||
    record?.title ||
    record?.label ||
    record?.subject ||
    record?.id ||
    record?._id ||
    'Untitled'
  );
}
