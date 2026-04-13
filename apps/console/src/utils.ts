/**
 * Utility functions for ObjectStack Console
 */

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

/**
 * Format a record title using the titleFormat pattern
 * @param titleFormat Pattern like "{name} - {email}" or "{firstName} {lastName}"
 * @param record The record data object
 * @returns Formatted title string
 */
export function formatRecordTitle(titleFormat: string | undefined, record: any): string {
  if (!titleFormat || !record) {
    return record?.id || record?._id || 'Record';
  }

  // Replace {fieldName} patterns with actual values
  return titleFormat.replace(/\{(\w+)\}/g, (_match, fieldName) => {
    const value = record[fieldName];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });
}

/**
 * Get display name for a record using titleFormat or fallback
 * @param objectDef Object definition with optional titleFormat
 * @param record The record data
 * @returns Display name for the record
 */
export function getRecordDisplayName(objectDef: any, record: any): string {
  if (objectDef?.titleFormat) {
    return formatRecordTitle(objectDef.titleFormat, record);
  }
  
  // Fallback: Try common name fields
  return record?.name || record?.title || record?.label || record?.id || record?._id || 'Untitled';
}
