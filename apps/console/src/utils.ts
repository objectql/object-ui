/**
 * Utility functions for ObjectStack Console
 */

/**
 * Resolves an I18nLabel to a plain string.
 * I18nLabel can be either a string or an object { key, defaultValue?, params? }.
 * When it's an object, we return the defaultValue or the key as fallback.
 */
export function resolveI18nLabel(label: string | { key: string; defaultValue?: string; params?: Record<string, any> } | undefined): string | undefined {
  if (label === undefined || label === null) return undefined;
  if (typeof label === 'string') return label;
  return label.defaultValue || label.key;
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
