/**
 * Safe translation hook for field widgets.
 * Falls back to English defaults when no I18nProvider is available.
 */
import { createSafeTranslation } from '@object-ui/i18n';

const FIELD_DEFAULTS: Record<string, string> = {
  'common.selectOption': 'Select an option',
  'common.select': 'Select…',
  'common.search': 'Search',
  'common.loading': 'Loading…',
  'common.noResults': 'No results found',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'table.selected': '{{count}} selected',
  'table.search': 'Search…',
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
  // objectui#3342 — the tags widget's input hint. Used only when the field
  // author declared no `placeholder` of their own (author declaration wins).
  'fields.tags.placeholder': 'Type and press Enter to add…',
  // objectui#3406 — the accessible name of `TextAreaField`'s character
  // counter, rendered only when the field declares `maxLength`. The visible
  // `{n}/{max}` is digits; this sentence is what a screen reader speaks, and
  // the element is `aria-live`, so before the key existed a non-English
  // session heard English on every keystroke. Byte-identical to the literal
  // it replaces, so a no-provider render is unchanged.
  'fields.textarea.characterCount': 'Character count: {{count}} of {{max}}',
  // objectui#3408 — the NEAR-LIMIT warning, spoken by the counter's status
  // region after the typist pauses and only once they are inside the last 10%
  // (or last 20 characters) of the cap. The sentence above became the field's
  // `aria-describedby` description in the same change; this one is the only
  // thing that is ever announced mid-typing, which is why it says what is
  // LEFT rather than repeating the whole count.
  //
  // Colon form, not "You have {{count}} characters remaining": `count` makes
  // i18next attempt plural lookup (`_one` / `_few` / …) before the base key,
  // and these packs declare the base key only — the same base-key fallback
  // `characterCount` already relies on. A sentence whose grammar does not
  // depend on the number stays correct at 1 without ten plural entries per
  // pack, and matches the sibling key's shape.
  'fields.textarea.charactersRemaining': 'Characters remaining: {{count}}',
  // The fullscreen long-text dialog's copy (objectui#3404) is NOT declared
  // here any more. It moved with the implementation: `FullscreenFieldEditor` is
  // a thin wrapper over `FullscreenEditor` in `@object-ui/components`
  // (objectui#3398), and that primitive carries its own `createSafeTranslation`
  // defaults for the same `form.fullscreen.*` / `common.cancel` keys — still
  // the built-in branch's keys, still byte-identical English, so provider-less
  // rendering is unchanged and the ten locale packs need no edit. Leaving the
  // entries here would have re-created in the defaults map exactly the
  // duplication #3398 removed from the components, and this map's own
  // discipline is that a default is declared where it is read.
  //
  // `common.cancel` stays above: `RecordPickerDialog` and `PeoplePicker` read
  // it independently of anything fullscreen.
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
