/**
 * Safe translation hook for field widgets.
 * Falls back to English defaults when no I18nProvider is available.
 */
import { createSafeTranslation } from '@object-ui/i18n';

const FIELD_DEFAULTS: Record<string, string> = {
  'common.selectOption': 'Select an option',
  'common.select': 'Select...',
  'common.search': 'Search',
  'common.loading': 'Loading...',
  'common.noResults': 'No results found',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'table.selected': '{{count}} selected',
  'table.search': 'Search...',
  'lookup.loading': 'Loading…',
  'lookup.noOptions': 'No options found',
  'lookup.noRecords': 'No records found',
  'lookup.recentlyUsed': 'Recently used',
  'lookup.allResults': 'All results',
  'lookup.createNew': 'Create new',
  'lookup.createNamed': 'Create new "{{name}}"',
  'lookup.showingResults': 'Showing {{shown}} of {{total}} results',
  'lookup.showAllResults': 'Show all results ({{count}})',
  'lookup.selectedBadge': 'Selected',
  'lookup.browseAll': 'Browse all records',
  'lookup.remove': 'Remove {{label}}',
  'lookup.selectFirst': 'Select {{fields}} first',
  'lookup.selectRecord': 'Select record',
  'lookup.recordCount': '{{count}} records',
  'lookup.recordCountOne': '1 record',
  'lookup.pageOf': 'Page {{current}} of {{total}}',
  'lookup.filters': 'Filters',
  'lookup.clear': 'Clear',
  'lookup.yes': 'Yes',
  'lookup.filterPlaceholder': 'Filter {{label}}',
  'lookup.prevPage': 'Previous page',
  'lookup.nextPage': 'Next page',
  'lookup.jumpToPage': 'Jump to page',
  'lookup.retry': 'Retry',
  // objectui#2600 B5 — capability picker scope group headers.
  'capability.group.platform': 'Platform',
  'capability.group.org': 'Organization',
  'capability.group.other': 'Other',
};

export const useFieldTranslation = createSafeTranslation(
  FIELD_DEFAULTS,
  'common.selectOption',
);
