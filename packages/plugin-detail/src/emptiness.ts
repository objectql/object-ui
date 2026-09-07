/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { recordDisplayValueAt } from '@object-ui/core';

/**
 * Does this cell have anything to render? **THE** definition of emptiness on
 * the `record:details` page (objectui#8376, widened to the whole package by
 * objectui#8394).
 *
 * ## Readers
 *
 * Every band of the record page that draws a placeholder instead of a value, or
 * omits a slot because there is no value, asks THIS — never its own
 * `null | undefined | ''`:
 *
 *  - `DetailSection` — `isEmptyValue` (the row filter behind `emptyCount`, the
 *    "Show N empty fields" toggle and the auto-hide heuristic), the `isEmpty`
 *    branch of `displayValue` (the muted em-dash + `No value` affordance), and
 *    `canCopy` (a row that says `No value` must not offer to copy it);
 *  - `HeaderHighlight` — the ADR-0085 highlight strip's `isEmpty`, the same
 *    em-dash affordance one band higher on the same screen;
 *  - `DetailView` — the `summaryFields` chips beside the page H1, BOTH the
 *    auto-detection that picks which field becomes a chip and the render that
 *    skips a valueless one. Those two must agree or the derivation spends the
 *    one status slot on a field the render then drops, and no chip appears;
 *  - `HistoryTimeline` — `formatDiffValue`'s `'—'` placeholder for an audit
 *    value;
 *  - `RecordMetaFooter` — whether `created_by` / `updated_by` is an actor at
 *    all (see the note at its call site: the footer normalizes at the READ,
 *    because the label, the `·` separator and the renderer are three consumers
 *    of one answer).
 *
 * They MUST agree. Before objectui#8350 / #8376 / #8394 each spelled the test
 * out for itself, none trimmed, and the page contradicted itself in one
 * screenful: the H1 called a whitespace-only field empty, the body grid painted
 * a blank cell, the strip between them painted a blank chip. Raw tests that
 * happen to agree can stop agreeing; one definition cannot.
 *
 * ## Why the scalar half DELEGATES (objectui#8350's authority)
 *
 * None of those tests TRIMMED, so `'   '` counted as FILLED while
 * `@object-ui/core`'s `recordDisplayValueAt` — the definition the page H1 and
 * the `record:details` dedupe ladder both read — calls it EMPTY. The
 * consequences were not cosmetic: a row painted a visually blank cell (the exact
 * UI the em-dash exists to prevent), it escaped `emptyCount` so the toggle read
 * one too low, and because `shouldAutoHideEmpty` only needs `filledCount > 0`
 * ONE such value suppressed the all-empty skeleton and hid every genuinely empty
 * row in its section. So the scalar answer is not re-spelled here: it is the
 * authority's, and a `.trim()` written at a call site would be the second
 * implementation that drifts next.
 *
 * ## Why the OBJECT half does NOT delegate — measured, not assumed
 *
 * `recordDisplayValueAt` answers "does this resolve to a NAME", so an object
 * value goes through `displayNameOfEmbeddedObject` and is EMPTY whenever that
 * Salesforce-style chain yields nothing. That is right for a title and WRONG for
 * a cell: here an object value is handed to a TYPE-AWARE renderer that knows how
 * to draw it. `{ latitude, longitude }` renders as coordinates
 * (`LocationCellRenderer`), `{ street, city, … }` as a formatted postal address
 * (`AddressCellRenderer`, objectui#4037), `['alpha','beta']` as select badges,
 * an expanded `{ id, name }` reference through `LookupCellRenderer`'s own
 * display chain, any other object as JSON — none of which carries a name-ish key
 * in the general case, so delegating this half would replace populated cells
 * with `No value`, drop them out of `filledCount`, and let auto-hide bury them.
 * An object is therefore a VALUE here: this function moves whitespace-only
 * strings and nothing else.
 *
 * ## Not every emptiness question on this page is THIS question
 *
 * ⛔ Do not widen the reader list by pattern-matching on the shape of a test.
 * `ConcurrentUpdateDialog`'s `formatValue` deliberately renders `''` as `""`
 * rather than as a placeholder — a conflict dialog is reporting what is STORED,
 * where "empty string" and "absent" are different facts the reader must be able
 * to tell apart. Converging it would delete information rather than add it.
 *
 * Pinned end-to-end (DOM, not predicate) in
 * `__tests__/DetailSection.emptinessAuthority-8376.test.tsx` and
 * `__tests__/detailPage.emptinessAuthority-8394.test.tsx`, whose NON-REGRESSION
 * cases are red for a wholesale delegation and red for an emptiness test that
 * answers EMPTY for everything.
 */
export function hasCellValue(value: unknown): boolean {
  // Object/array values belong to the cell renderers, not to the display-name
  // chain — see the docblock above. `typeof null === 'object'`, so null is
  // excluded here and answered by the authority below.
  if (value !== null && typeof value === 'object') return true;
  // A one-key synthetic record is how a VALUE asks the authority its question:
  // `recordDisplayValueAt` is keyed `(record, field)` because its callers read
  // a field off a record, while a call site's value has several sources (the
  // record, then an authored `field.value` fallback) and is already resolved by
  // the time emptiness is asked. Re-typing the test to take a value is precisely
  // the extra implementation this function exists to remove.
  return recordDisplayValueAt({ value }, 'value') !== undefined;
}
