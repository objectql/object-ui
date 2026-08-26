/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Diagnostic: a visibility predicate could not be evaluated (objectui#5454,
 * leg 3 of the 2026-08-21 ruling; production coverage added by objectui#6038,
 * maintainer ruling 2026-08-25 option B).
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
 *
 * This is the RATE LIMIT the 2026-08-25 ruling requires of the production leg,
 * and it is why that leg can be a plain `console.warn`: the ceiling is not "one
 * line per render" but "one line per distinct authored predicate", for the
 * lifetime of the page. Two properties have to hold together, and a test that
 * pins only the first cannot tell a working dedupe from one that suppresses
 * everything — so objectui#6038 pins both: N renders of ONE faulting predicate
 * emit exactly one line, and a SECOND distinct predicate source still emits.
 */
const _warnedVisibilityPredicates = new Set<string>();

/**
 * Reports a visibility predicate that could not be evaluated — in DEVELOPMENT
 * AND IN PRODUCTION since objectui#6038 (maintainer ruling 2026-08-25, option
 * B: "the silence is no longer an accepted property").
 *
 * `console.warn`, not `error`: the verdict is unchanged and the page still
 * renders, so this is a diagnostic about a predicate — not the refusal
 * `reportUnevaluatedExpressions` emits once raw source has reached the DOM.
 *
 * ## `err` takes a reason, not only an `Error`
 *
 * The dev caller catches a throw and passes the `Error`; the production caller
 * is handed the evaluator's own reason STRING through `EvaluationOptions.onFault`
 * (no throw is raised there, because raising one would cost a second
 * evaluation). `String(err)` already covered that shape, so both callers reach
 * the same `Reason:` text and the same dedupe entry — which is what makes "dev
 * and production print the identical line" true rather than approximately true.
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
 * Test-only reset for the dedupe above — for BOTH legs, which is the point of
 * their sharing one `Set`. The `Set` is module state: without this, the second
 * test to assert the same warning reads the first test's dedupe entry and sees
 * silence — a green run that checked nothing.
 */
export function __resetVisibilityPredicateWarnings(): void {
  _warnedVisibilityPredicates.clear();
}

/* -------------------------------------------------------------------------- *
 * objectui#5687 — the NON-throwing half of the same silence
 * -------------------------------------------------------------------------- */

/**
 * Prefix for the objectui#5687 leg. A SIBLING of the constant above, not a
 * reuse of it, and the difference is deliberate.
 *
 * The maintainer ruling (2026-08-22, option A) says this path "emits the
 * dev-only unresolvable-predicate report". What is load-bearing there — and
 * what the dispatch restated — is the reporter's POSTURE: same module, same
 * severity (`console.warn`), same dedupe key shape, same dedupe Set, same
 * gate at the same call site, same test-only reset. All of that is shared
 * below.
 *
 * ⚠️ The two legs stopped sharing that gate's VALUE in objectui#6038, and only
 * that. The unresolvable leg now reports in production as well, because the
 * 2026-08-25 ruling retired its silence; THIS leg stays dev-only under its own
 * 2026-08-22 ruling, and the difference is not an oversight. A fault is a
 * predicate that could not be evaluated, and shipping a live gate that has
 * stopped biting is the class-1 defect production has to be able to see. This
 * leg reports something else: a predicate that evaluated perfectly, against the
 * wrong object. Its trigger is a LEXICAL scan of the predicate source with a
 * stated false-positive residue (the deliberate-absence idioms below), which is
 * a cost worth paying for an author at their keyboard and not for every user of
 * every production page. The first LINE is not reused, because on this path it would
 * state something false: the predicate did not fail to evaluate. It evaluated
 * perfectly, against the wrong object, and produced a constant. Telling an
 * author "could not be evaluated" would send them hunting for a syntax error
 * that is not there.
 */
export const ADAPTER_ONLY_DATA_PREDICATE_PREFIX =
  '[ObjectUI] A visibility predicate resolved `data.*` against the data-source adapter';

/**
 * Strip string literals before scanning for `data.*` reads.
 *
 * The scan below is LEXICAL, not a parse — it reads the predicate's source
 * text. Without this step a predicate that merely quotes the characters
 * (`note == 'data.status'`) would be reported for a read it never performs.
 * That class is not hypothetical in this repo: `examples/schema-catalog`'s
 * `components-complex-scroll-area/code-preview.json` carries `data.features`
 * inside a JS snippet in a `content` string.
 *
 * Replaced with an EMPTY literal of the same quote style rather than deleted,
 * so neighbouring tokens cannot be fused into a new false match.
 */
function stripStringLiterals(source: string): string {
  return source.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
}

/**
 * `data.<path>` reads, matched only where `data` is a ROOT identifier.
 *
 * The leading group is what keeps this from being the loose sweep the card's
 * own cross-reference warns about: `metadata.status` (a longer identifier that
 * ends in `data`) and `record.data.status` (`data` as a MEMBER, which is the
 * row's own field, not this evaluator's root) must not match. Both are pinned.
 * A capture group is used rather than a lookbehind for target-browser reach.
 */
const DATA_ROOT_PATH_RE =
  /(^|[^A-Za-z0-9_$.])data\.([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)/g;

/**
 * The `data.*` reads in `source` that are `undefined` on the object `data` is
 * actually bound to — i.e. the ones that make the comparison a constant.
 *
 * ## Why THIS discriminator, measured against the three alternatives
 *
 * The ruling's trigger is not "references `data.`" — a genuine adapter read has
 * to stay silent, and that half is what makes the loud half mean anything.
 * Measured on `packages/core`'s built evaluator, against the four candidate
 * definitions:
 *
 *   * "references `data.` at all" — fires on `data.total > 0` against an
 *     adapter that HAS `total`. Refused by the ruling in as many words.
 *   * "the whole predicate is constant-false" — measured: `data.total > 100`
 *     against `{ total: 99 }` returns `false`, and so does a correct
 *     `record.status == 'draft'` against a row whose status is `open`. The
 *     definition cannot tell a gate that correctly says NO from a gate that
 *     never asked. It would report every hiding gate in the repo.
 *   * "the comparison OPERAND is undefined" — the most precise reading, and it
 *     needs the expression engine to expose its operands. That is a change to
 *     `@object-ui/core`'s evaluator for a diagnostic on a card that dissolves
 *     when objectui#5330's deprecation window closes.
 *   * "a `data.*` read the bound object does not answer" — this one. On the
 *     card's repro (`data.status` against the adapter) it fires; on
 *     `${data.total}` against `{ total: 99 }` it does not; and it is
 *     STRUCTURALLY incapable of firing on the `record.*` bucket (objectui#5401
 *     → #5454), which is the adjacent card with a different correct fix.
 *
 * Residue, stated rather than hidden: deliberate absence idioms
 * (`data.status == null`, `!data.status`) are reported. They are not really
 * false positives at this tier — an adapter that has no `status` makes those
 * constants too, just constant-TRUE instead of constant-false — but they are
 * the shapes an author could have meant.
 *
 * The walk mirrors `useDataScope`'s own `path.split('.').reduce(…)` resolution
 * of a `data.*` path, so "undefined here" means what it means everywhere else
 * this repo resolves against the adapter.
 */
function unresolvedDataPaths(source: string, boundData: unknown): string[] {
  const scannable = stripStringLiterals(source);
  const out: string[] = [];
  DATA_ROOT_PATH_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATA_ROOT_PATH_RE.exec(scannable)) !== null) {
    const path = match[2];
    let cursor: unknown = boundData;
    try {
      for (const segment of path.split('.')) {
        if (cursor === null || cursor === undefined) {
          cursor = undefined;
          break;
        }
        cursor = (cursor as Record<string, unknown>)[segment];
      }
    } catch {
      // A throwing getter on the adapter is the OTHER reporter's case: the
      // evaluator would have thrown too. Stay silent rather than guess.
      return [];
    }
    const spelling = 'data.' + path;
    if (cursor === undefined && out.indexOf(spelling) === -1) out.push(spelling);
  }
  return out;
}

/** Built separately from the emit, for the same reason as the message above. */
export function formatAdapterOnlyDataMessage(
  type: unknown,
  id: unknown,
  key: string,
  raw: unknown,
  unresolved: string[],
): string {
  const node = typeof type === 'string' && type ? '"' + type + '"' : '(untyped node)';
  const where = typeof id === 'string' && id ? ' (id: "' + id + '")' : '';
  return (
    ADAPTER_ONLY_DATA_PREDICATE_PREFIX + ' - node ' + node + where + '\n' +
    '  ' + key + ': ' + JSON.stringify(predicateSourceText(raw)) + '\n' +
    '  Undefined on the adapter: ' + unresolved.join(', ') + '\n' +
    'At the node tier `data` is the DATA-SOURCE ADAPTER - the object\n' +
    '`${data.total}` in a props bag reads - and it is NOT the row. The reads\n' +
    'above are undefined on it, so this predicate is a CONSTANT: it does not\n' +
    'depend on the row at all, and on this surface a constant `false` hides the\n' +
    'node on every row while looking exactly like a gate that said no.\n' +
    'Write the row as `record.*` (e.g. `record.status`), which page-component\n' +
    'predicates bind alongside `current_user` and page state as `page.<var>`.\n' +
    '`data.*` as a spelling for the row is deprecated (objectui#5330) and was\n' +
    'never bound to the row on this tier.'
  );
}

/**
 * Dev-build diagnostic for a node-gate predicate that reads `data.*` and gets
 * `undefined` back from the adapter (objectui#5687, maintainer ruling
 * 2026-08-22 option A).
 *
 * ## It changes NO verdict, and it is not allowed to
 *
 * The ruling is explicit that the node tier keeps its documented
 * `data` = adapter semantics: no verdict change, no interpolation change. This
 * function returns `void`, is called for its console output only, and the
 * caller passes the evaluator's answer through untouched. The constant-false
 * still hides the block; the author now hears about it.
 *
 * ## Why it lives beside `reportUnresolvableVisibilityPredicate`
 *
 * They are two halves of ONE silence. objectui#5454 made the THROWING paths
 * loud; measured on this base, a `{ dialect: 'cel' }` envelope reading
 * `data.status` already throws and is already reported by that function. The
 * bare-string and `${…}` template dialects do not throw for the same
 * predicate — they resolve `undefined == 'draft'` to a clean `false` — so the
 * author heard about the identical authoring mistake only if they happened to
 * write it in the CEL dialect. That is the same dialect-dependent arbitrariness
 * objectui#5454 existed to remove, one path further along.
 *
 * Sharing the module means sharing the LIFECYCLE, which is the part that has to
 * match: one dedupe Set, one reset, one severity. (One gate, too, until
 * objectui#6038 — see the prefix constant above for why only the sibling leg
 * crossed into production.) The dedupe
 * key is tagged with this leg's name so the two diagnostics cannot silence each
 * other for the same (type, key, source) triple — they are different faults,
 * and a node that faults one way is not evidence about the other.
 */
export function reportAdapterOnlyDataPredicate(
  type: unknown,
  id: unknown,
  key: string,
  raw: unknown,
  boundData: unknown,
): void {
  const source = predicateSourceText(raw);
  // Fast reject: the overwhelming majority of predicates never mention `data.`
  // at all, and this runs for every visibility predicate of every node in dev.
  if (source.indexOf('data.') === -1) return;
  const unresolved = unresolvedDataPaths(source, boundData);
  // Every `data.*` read the adapter answers -> a genuine adapter read.
  // SILENT. This is the half of the ruling that makes the other half mean
  // something.
  if (unresolved.length === 0) return;
  const dedupeKey = JSON.stringify(['adapter-only-data', type, key, source]);
  if (_warnedVisibilityPredicates.has(dedupeKey)) return;
  _warnedVisibilityPredicates.add(dedupeKey);
  console.warn(formatAdapterOnlyDataMessage(type, id, key, raw, unresolved));
}
