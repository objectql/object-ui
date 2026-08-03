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
  // objectui#3231 — the empty / dependency-gated state of the fixed-option
  // widgets (select, multiselect, radio, checkboxes). Only used when the host
  // supplies no `emptyHint`; the gate sentence shares its key with the form
  // renderer so both cannot drift apart in a locale.
  'fields.options.empty': 'No options available',
  'fields.options.selectFirst': 'Select {{fields}} first',
  // objectstack#3821 — sharing-rule authoring widgets (object-ref /
  // recipient-picker / filter-condition). The recipient placeholder is keyed
  // PER TYPE rather than interpolating the enum value into an English
  // sentence, which no locale could translate.
  'fields.objectRef.loading': 'Loading objects…',
  'fields.objectRef.placeholder': 'Select an object',
  'fields.objectRef.search': 'Search objects…',
  'fields.objectRef.empty': 'No objects found',
  'fields.recipient.selectTypeFirst': 'Select a recipient type first.',
  'fields.recipient.loading': 'Loading…',
  'fields.recipient.search': 'Search…',
  'fields.recipient.empty': 'No matches',
  'fields.recipient.select': 'Select a recipient',
  'fields.recipient.selectUser': 'Select a user',
  'fields.recipient.selectTeam': 'Select a team',
  'fields.recipient.selectBusinessUnit': 'Select a business unit',
  'fields.recipient.selectPosition': 'Select a position',
  'fields.recipient.selectUnitAndSubordinates': 'Select a business unit',
  'fields.filterCondition.selectObjectFirst': 'Select an object first.',
  // objectstack#3896 — this used to be 'All records'. An empty criteria never
  // meant "share everything"; it meant the predicate was missing, and the
  // sharing evaluator failed open on it. Such a rule is now refused on save
  // and shares nothing, so say that rather than advertise the old bug.
  'fields.filterCondition.noCriteria': 'No criteria — this rule shares nothing',
  'fields.filterCondition.criteriaRequired':
    'Add at least one condition. A rule with no criteria would share every record, so it cannot be saved.',
  'fields.filterCondition.invalidJson': 'Invalid JSON — the rule will match no records until fixed.',
  'fields.filterCondition.jsonOnly': 'This criteria can only be edited as JSON',
  'fields.filterCondition.editAsJson': 'Edit as JSON',
  'fields.filterCondition.useVisualBuilder': 'Use visual builder',
  // objectui#2600 B5 — capability picker scope group headers.
  'capability.group.platform': 'Platform',
  'capability.group.org': 'Organization',
  'capability.group.other': 'Other',
  // objectui#2600 B5 — curated platform capability labels (registry serves
  // English; dots in the api-name become underscores in the key).
  'capability.label.manage_users': 'Manage Users',
  'capability.label.manage_org_users': 'Manage Organization Users',
  'capability.label.manage_metadata': 'Manage Metadata',
  'capability.label.manage_platform_settings': 'Manage Platform Settings',
  'capability.label.setup_access': 'Setup Access',
  'capability.label.setup_write': 'Write Settings',
  'capability.label.studio_access': 'Studio Access',
};

export const useFieldTranslation = createSafeTranslation(
  FIELD_DEFAULTS,
  'common.selectOption',
);
