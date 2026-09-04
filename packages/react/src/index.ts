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
export * from './data-invalidation.js';
// PageComponentSchema.dataSource — mapping the spec's per-element data binding
// onto the schema keys each object-bound block reads (objectstack#6953).
export * from './element-data-source/ElementDataSourceGate.js';

// i18n utilities
export { resolveKeyedI18nLabel } from './utils/i18n.js';

// "Is this a real config bag?" — the ONE definition of that question
// (objectui#6761), exported at the package entry for the same reason the node-gate
// reporter above is (objectui#6038): a surface in `@object-ui/components`, which
// depends on this package, asks it too. `element:*` renderers there read their
// config out of `{ ...schema.props, ...schema.properties }`, the third channel of
// the degenerate-bag hazard objectui#6752 / objectui#6760 closed here
// (objectui#6783). A second copy one package over would be a spelling that
// `utils/configBag.pin.test.ts` — which scans `packages/react/src` — cannot see,
// which is the drift that pin exists to stop.
export { isConfigBag } from './utils/configBag.js';

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
//
// ⚠️ THREE members since objectui#6503, not two. `'concealment'` was added for
// the `hidden` / `hiddenOn` legs, whose verdict `SchemaRenderer` does NOT
// negate — the same fail-soft `true` that shows a node on the four negated legs
// REMOVES it there, so "the gate did NOT bite" was the one sentence that could
// not be true for them. Widening a union re-exported from this entry is a
// type-level change for any consumer that switches EXHAUSTIVELY over it or
// keys a `Record` by it; no runtime signature moved, and every value that was
// accepted before still is.
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


// The platform row ceiling for NON-GRID visualisations — gantt, calendar, map
// and tree (objectui#7210, maintainer ruling a′). One constant across the
// four, because a per-plugin copy would be four constants wearing one name,
// which is the thing the ruling ruled out.
//
// ⚠️ WHY IT LIVES HERE is a scheduling fact, not an architectural one, and the
// comment that used to stand here said otherwise: "the only package all four
// already depend on". That is measured FALSE —
// `packages/plugin-{gantt,calendar,map,tree}/package.json` each also list
// `@object-ui/core`, `@object-ui/components` and `@object-ui/types`. The real
// reason is that #7210 was dispatched with a same-round barrel fence over
// exactly those: `core` was held by #7349, `types` and `components` by #7182,
// and `@object-ui/react` has no subpath export, so "one constant, not in those
// three" left the package's sole entry as the only reachable home.
//
// ⛔ Do not read this placement as a decision that it belongs here. The
// non-React half (`applyNonGridRowCeiling`, `NonGridCeilingResult`) wraps
// `core`'s own `extractRecords` and would sit beside it; whether these five
// symbols move, and whether `NON_GRID_ROW_CEILING_TOP` should be published at
// all, is an OPEN maintainer decision on objectui#7508. Anything that grows a
// dependency on this exact shape makes that decision more expensive.
export {
  NON_GRID_ROW_CEILING,
  NON_GRID_ROW_CEILING_TOP,
  applyNonGridRowCeiling,
  NonGridRowCeilingNote,
} from './utils/nonGridRowCeiling.js';
export type { NonGridCeilingResult } from './utils/nonGridRowCeiling.js';
