/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export * from './SchemaRenderer.js';
export * from './schema-input.js';
export * from './hooks/index.js'; // will be empty for now
export * from './context/index.js'; // will be empty for now
export * from './LazyPluginLoader.js';
export * from './spec-bridge/index.js';
export * from './data-invalidation.js';
// PageComponentSchema.dataSource — mapping the spec's per-element data binding
// onto the schema keys each object-bound block reads (objectstack#6953).
export * from './element-data-source/ElementDataSourceGate.js';

// i18n utilities
export { resolveKeyedI18nLabel } from './utils/i18n.js';

// Node-gate predicate diagnostics. Exported at the package entry (objectui#6038)
// so every surface that evaluates a node `visibleWhen` reports a fault through
// ONE reporter and ONE dedupe `Set` — `page:tabs` item predicates live in
// `@object-ui/components`, which depends on this package. A second copy of the
// reporter would mean a second rate limit, and the same broken predicate would
// then be entitled to one line per package instead of one line, which is the
// property the 2026-08-25 ruling asked for.
export {
  reportUnresolvableVisibilityPredicate,
  formatUnresolvableVisibilityMessage,
  UNRESOLVABLE_VISIBILITY_PREFIX,
  // The ENABLEMENT gate's opening line (objectui#6445). Exported beside its
  // sibling for the reason that one is: an app filtering these out of its
  // console transport filters by the constant, and a second line it cannot
  // name is a second thing to hard-code. Not a second reporter — the emit,
  // the dedupe `Set` and the reset above are still the only ones.
  UNRESOLVABLE_ENABLEMENT_PREFIX,
  __resetVisibilityPredicateWarnings,
} from './utils/visibilityDiagnostic.js';
// The per-surface scope hint those two take (objectui#6487). Exported because
// `@object-ui/app-shell` — a caller in another package — has to name its tier,
// and a caller that cannot spell the argument would be back on the node tier's
// advice by default, which is the defect that card fixed.
export type { PredicateScopeTier } from './utils/visibilityDiagnostic.js';
// Which gate the predicate was authored on (objectui#6445) — the argument that
// decides whether the message says the safe default bit or did not. Exported as
// a type for the same reason as the tier above: the reporter is public, so a
// caller has to be able to spell its arguments.
export type { PredicateGateKind } from './utils/visibilityDiagnostic.js';

// Write-error surfacing utilities (shared by drag-write plugins so a failed
// PATCH — e.g. an RLS 403 — is never silently swallowed).
export { extractWriteErrorMessage, isPermissionError, extractFieldErrors, classifyLoadError, declaredUserMessage } from './utils/error-message.js';
export type { WriteFieldError, LoadErrorKind } from './utils/error-message.js';

// Built-in i18n support
export {
  I18nProvider,
  useObjectTranslation,
  useSafeTranslate,
  useObjectLabel,
  useSafeFieldLabel,
  useI18nContext,
  createI18n,
  getDirection,
  getAvailableLanguages,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
  type I18nConfig,
  type I18nProviderProps,
  type TranslationKeys,
  type DateFormatOptions,
  type CurrencyFormatOptions,
  type NumberFormatOptions,
} from '@object-ui/i18n';

