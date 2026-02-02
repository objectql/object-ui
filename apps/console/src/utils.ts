/**
 * Utility functions for ObjectStack Console
 */

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
