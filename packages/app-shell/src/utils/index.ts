/**
 * Utility functions for ObjectStack Console
 */

// Re-export the unified record display-name resolver (ADR-0079) so existing
// importers of `@object-ui/app-shell`'s `getRecordDisplayName` /
// `formatRecordTitle` keep working unchanged. The implementation now lives in
// `@object-ui/core` (pure util, shared by every view plugin and field widget).
export {
  getRecordDisplayName,
  deriveTitleField,
  isTitleEligibleField,
  // `formatTitleTemplate` is the new canonical name; alias it to the legacy
  // `formatRecordTitle` export this module has always provided.
  formatTitleTemplate as formatRecordTitle,
} from '@object-ui/core';
export type { RecordDisplayNameOptions } from '@object-ui/core';

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

// NOTE (ADR-0079): `formatRecordTitle` (now canonically `formatTitleTemplate`)
// and `getRecordDisplayName` moved to `@object-ui/core` and are re-exported
// from the top of this module. The previous local copies — a titleFormat-only
// resolver that fell back to a hard-coded `name`/`title`/… list and bottomed
// out at the literal 'Untitled' — are gone, so every surface now also honors
// the object's `displayNameField` + type-aware derivation + `Record #<id>`.
