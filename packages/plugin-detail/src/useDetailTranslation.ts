/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useObjectTranslation } from '@object-ui/react';

/**
 * Create a safe translation hook with fallback to defaults.
 * Follows the same pattern as useGridTranslation / useListViewTranslation.
 *
 * @param defaults - Fallback English translations keyed by i18n key
 * @param testKey - A key to test if i18n is properly configured
 */
export function createSafeTranslationHook(
  defaults: Record<string, string>,
  testKey: string,
) {
  return function useSafeTranslation() {
    try {
      const result = useObjectTranslation();
      const testValue = result.t(testKey);
      if (testValue === testKey) {
        return {
          t: (key: string, options?: Record<string, unknown>) => {
            let value = defaults[key] || key;
            if (options) {
              for (const [k, v] of Object.entries(options)) {
                value = value.replace(`{{${k}}}`, String(v));
              }
            }
            return value;
          },
        };
      }
      return { t: result.t };
    } catch {
      return {
        t: (key: string, options?: Record<string, unknown>) => {
          let value = defaults[key] || key;
          if (options) {
            for (const [k, v] of Object.entries(options)) {
              value = value.replace(`{{${k}}}`, String(v));
            }
          }
          return value;
        },
      };
    }
  };
}

/**
 * Default English translations for detail view components.
 * Used as fallback when no I18nProvider is available.
 */
export const DETAIL_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'detail.back': 'Back',
  'detail.edit': 'Edit',
  'detail.editInline': 'Edit inline',
  'detail.save': 'Save',
  'detail.saveChanges': 'Save changes',
  'detail.editFieldsInline': 'Edit fields inline',
  'detail.share': 'Share',
  'detail.duplicate': 'Duplicate',
  'detail.export': 'Export',
  'detail.viewHistory': 'View history',
  'detail.delete': 'Delete',
  'detail.moreActions': 'More actions',
  'detail.addToFavorites': 'Add to favorites',
  'detail.removeFromFavorites': 'Remove from favorites',
  'detail.previousRecord': 'Previous record',
  'detail.nextRecord': 'Next record',
  'detail.recordOf': '{{current}} of {{total}}',
  'detail.recordNotFound': 'Record not found',
  'detail.recordNotFoundDescription': 'The record you are looking for does not exist or may have been deleted.',
  'detail.goBack': 'Go back',
  'detail.details': 'Details',
  'detail.related': 'Related',
  'detail.relatedRecords': '{{count}} records',
  'detail.relatedRecordOne': '{{count}} record',
  'detail.noRelatedRecords': 'No related records found',
  'detail.loading': 'Loading...',
  'detail.copyToClipboard': 'Copy to clipboard',
  'detail.copied': 'Copied!',
  'detail.deleteConfirmation': 'Are you sure you want to delete this record?',
  'detail.editRecord': 'Edit record',
  'detail.viewAll': 'View All',
  'detail.new': 'New',
  'detail.emptyValue': '—',
  'detail.activity': 'Activity',
  'detail.editRow': 'Edit',
  'detail.deleteRow': 'Delete',
  'detail.deleteRowConfirmation': 'Are you sure you want to delete this record?',
  'detail.actions': 'Actions',
  'detail.previousPage': 'Previous',
  'detail.nextPage': 'Next',
  'detail.pageOf': 'Page {{current}} of {{total}}',
  'detail.sortBy': 'Sort by',
  'detail.filterPlaceholder': 'Filter...',
  'detail.highlightFields': 'Key Fields',
};

/**
 * Translation hook for detail view components.
 * Falls back to DETAIL_DEFAULT_TRANSLATIONS when no I18nProvider is available.
 */
export const useDetailTranslation = createSafeTranslationHook(
  DETAIL_DEFAULT_TRANSLATIONS,
  'detail.back',
);
