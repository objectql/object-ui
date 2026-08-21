/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Dev-build diagnostic: a visibility predicate could not be evaluated
 * (objectui#5454, leg 3 of the 2026-08-21 ruling).
 *
 * ## The defect this names
 *
 * `SchemaRenderer`'s visibility chain is FAIL-SOFT: `evaluateCondition` answers
 * an unevaluable predicate with `true`. On the four negated legs (`visible` /
 * `visibleWhen` / `visibleOn` / `visibility`) that `true` means SHOWN — so "this
 * predicate is broken" and "this predicate said yes" reach the screen as the
 * same pixel. An author who mistyped a root, or who wrote a `record.*` gate
 * before objectui#5454 bound the row, saw their block render and had no signal
 * at all that the gate had not been consulted.
 *
 * One of the three evaluation paths was already loud — a `{ dialect: 'cel' }`
 * envelope routes to `evalFieldPredicate`, which warns (objectstack#5149). The
 * bare-expression and `${…}` template paths were mute. So whether an author
 * heard about their own typo depended on which dialect they happened to write
 * it in, which is the arbitrariness this module removes.
 *
 * ## What it deliberately does NOT do
 *
 * It changes NO verdict. `evaluateCondition` already returned `true` for every
 * unevaluable predicate on every one of its paths, and the caller reproduces
 * exactly that from its catch — including on the two NON-negated legs
 * (`hidden` / `hiddenOn`), where the same `true` means HIDE. Flipping fail-soft
 * to fail-closed is a shipped-behaviour change tracked separately upstream
 * (objectstack#5149, appeal 1, undecided); this is the diagnostic half only.
 *
 * ## Why a separate module
 *
 * Same reason as `unevaluatedExpression.ts` next door: exporting non-components
 * from the module that exports `SchemaRenderer` breaks Fast Refresh
 * (`react-refresh/only-export-components`), and a format/emit split lets the
 * pins assert the words a developer will actually read rather than that a spy
 * was called — a diagnostic whose only test is the latter goes green the moment
 * someone no-ops it.
 */

/**
 * Prefix every diagnostic line starts with. Exported so tests can match on it
 * and so an app can filter it out of its console transport if it must.
 */
export const UNRESOLVABLE_VISIBILITY_PREFIX =
  '[ObjectUI] A visibility predicate could not be evaluated';

/** The raw predicate as an author would recognise it, envelope or not. */
function predicateSourceText(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const source = (raw as { source?: unknown }).source;
    if (typeof source === 'string') return source;
  }
  return typeof raw === 'string' ? raw : String(raw);
}

/**
 * Build the message. Separate from the emit so a test can assert the words,
 * not merely that something was logged.
 */
export function formatUnresolvableVisibilityMessage(
  type: unknown,
  id: unknown,
  key: string,
  raw: unknown,
  reason: string,
): string {
  const node = typeof type === 'string' && type ? '"' + type + '"' : '(untyped node)';
  const where = typeof id === 'string' && id ? ' (id: "' + id + '")' : '';
  return (
    UNRESOLVABLE_VISIBILITY_PREFIX + ' - node ' + node + where + '\n' +
    '  ' + key + ': ' + JSON.stringify(predicateSourceText(raw)) + '\n' +
    '  Reason: ' + reason + '\n' +
    'The node was treated as its safe default, which on this surface means the\n' +
    'gate did NOT bite - a predicate that cannot be evaluated reads on screen\n' +
    'exactly like one that said yes.\n' +
    'Page-component predicates bind `record` (the row on a record page),\n' +
    '`current_user`, and page state as `page.<var>`. Check those roots and the\n' +
    'CEL syntax.'
  );
}

/**
 * Reported (node type, key, predicate source) triples, so a re-render — or the
 * post-mount `forceUpdate` that picks up lazy plugin registrations — does not
 * repeat the line. Keyed on the predicate TEXT rather than the schema object:
 * the same broken predicate authored once and rendered over many rows is ONE
 * authoring bug, and an object key would report it once per row.
 */
const _warnedVisibilityPredicates = new Set<string>();

/**
 * Dev-build only; the caller applies the gate, so this module is dead code in a
 * production build. `console.warn`, not `error`: the verdict is unchanged and
 * the page still renders, so this is a diagnostic about a predicate — not the
 * refusal `reportUnevaluatedExpressions` emits once raw source has reached the
 * DOM.
 */
export function reportUnresolvableVisibilityPredicate(
  type: unknown,
  id: unknown,
  key: string,
  raw: unknown,
  err: unknown,
): void {
  const reason = err instanceof Error ? err.message : String(err);
  const dedupeKey = JSON.stringify([type, key, predicateSourceText(raw)]);
  if (_warnedVisibilityPredicates.has(dedupeKey)) return;
  _warnedVisibilityPredicates.add(dedupeKey);
  console.warn(formatUnresolvableVisibilityMessage(type, id, key, raw, reason));
}

/**
 * Test-only reset for the dedupe above. The `Set` is module state: without
 * this, the second test to assert the same warning reads the first test's
 * dedupe entry and sees silence — a green run that checked nothing.
 */
export function __resetVisibilityPredicateWarnings(): void {
  _warnedVisibilityPredicates.clear();
}
