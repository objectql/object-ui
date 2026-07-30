/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The slice of the server's import-coercion contract (`import-coerce.ts` in
 * the framework) that the Import Wizard's preview step re-checks client-side,
 * so a cell is flagged red here exactly when the server would reject it —
 * and never flagged for a value the server would take (objectui#3017).
 */

import { REFERENCE_VALUE_TYPES } from '@objectstack/spec/data';

/**
 * Truthy tokens the server's boolean coercion accepts (`BOOL_TRUE`), compared
 * after `trim().toLowerCase()` — so every entry must already be lower-case
 * and trimmed (`importCoercionContract.test.ts` enforces both, plus
 * disjointness from the falsy set).
 *
 * The spec does not publish this table yet, so it cannot be derived — the
 * paired inventory in the test is the tripwire that keeps edits deliberate
 * (objectstack#4173 tracks exporting it from the source of truth).
 */
export const BOOLEAN_TRUE_IMPORT_TOKENS: ReadonlySet<string> = new Set([
  'true', 't', 'yes', 'y', '1', 'on', '是', '对', '✓', '√',
]);

/** Falsy tokens the server's boolean coercion accepts (`BOOL_FALSE`). */
export const BOOLEAN_FALSE_IMPORT_TOKENS: ReadonlySet<string> = new Set([
  'false', 'f', 'no', 'n', '0', 'off', '否', '错', '✗', '×',
]);

/** Every boolean token the server accepts (e.g. Chinese 是/否, on/off, ✓/×). */
export const BOOLEAN_IMPORT_TOKENS: ReadonlySet<string> = new Set([
  ...BOOLEAN_TRUE_IMPORT_TOKENS,
  ...BOOLEAN_FALSE_IMPORT_TOKENS,
]);

/**
 * Field types the server resolves from display text to record IDs during
 * `/import`. Derived exactly the way the server derives its
 * `REFERENCE_TYPES` — the spec's reference-shaped value types plus the
 * generic `'reference'` alias — so the two ends share one source instead of
 * two hand lists.
 *
 * The legacy per-row create fallback has no resolution step — raw cell text
 * would be stored verbatim into relation fields — so the fallback must refuse
 * to run when any mapped column targets one of these types.
 */
export const REFERENCE_IMPORT_TYPES: ReadonlySet<string> = new Set([
  ...REFERENCE_VALUE_TYPES,
  'reference',
]);
