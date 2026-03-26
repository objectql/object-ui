/**
 * Safe translation hook for field widgets.
 * Falls back to English defaults when no I18nProvider is available.
 */
import { createSafeTranslation } from '@object-ui/i18n';

const FIELD_DEFAULTS: Record<string, string> = {
  'common.selectOption': 'Select an option',
  'common.select': 'Select...',
  'common.search': 'Search',
  'table.selected': '{{count}} selected',
};

export const useFieldTranslation = createSafeTranslation(
  FIELD_DEFAULTS,
  'common.selectOption',
);
