/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Dev-build diagnostic: an UNEVALUATED template expression reached the DOM.
 *
 * ## The defect this names (objectui#4795, Direction 3)
 *
 * A value only reaches the user if it passes two gates: `SchemaRenderer`
 * must EVALUATE it, and the renderer must READ IT BACK. Those two sets do not
 * fully overlap, and where they miss, the failure is SILENT — measured on a
 * real render with `dataSource: { total: 99 }`:
 *
 *   { type: 'ui:statistic', value: '${data.n}' }            -> screen shows
 *                                                              `${data.n}`
 *   { type: 'ui:card', props: { title: '${data.total}' } }  -> card body EMPTY
 *                                                              (the evaluated
 *                                                              `99` landed on a
 *                                                              DOM attribute)
 *
 * The first shape is what this module catches: the memo in `SchemaRenderer`
 * evaluates `content`, the `properties` / `props` bags and the predicate keys,
 * and passes every other top-level key through untouched — so the raw source
 * text is what the renderer receives, and it is placed verbatim. An author
 * (increasingly, an AI authoring metadata) gets no signal at all: a literal
 * `${data.n}` on screen reads like a data problem, not a contract violation.
 *
 * The second shape this module also catches, in its residue form: when an
 * expression IS evaluated but the evaluation THROWS, `ExpressionEvaluator`
 * returns the original source verbatim (`return match` in its interpolation
 * branch, `defaultValue ?? expression` in its outer catch), so a failed
 * evaluation is indistinguishable on screen from a key that was never
 * evaluated at all. Both end as raw `${…}` in front of a user.
 *
 * ## What this deliberately does NOT do
 *
 * It changes NO evaluation behaviour — it reads the schema after the memo has
 * run and reports. Widening the set of evaluated keys is objectui#4795's
 * Direction 1, which the maintainer DEFERRED behind a named restart condition
 * (ruling of 2026-08-17); this diagnostic is Direction 3 and must not
 * pre-empt it. Merging `props` into the node (Direction 2) is permanently
 * rejected.
 *
 * ## Depth: exactly the evaluator's own radius, and not one level more
 *
 * The scan is SHALLOW because evaluation is shallow. `ExpressionEvaluator`
 * returns every non-string untouched, so a nested `aria: { label: '${…}' }`
 * under either bag keeps its raw source today — deliberately, and pinned as
 * such by objectui#4799's parity tests. A deeper scan would therefore report,
 * as a defect, a shape the repo has explicitly decided not to change yet: the
 * diagnostic would be louder than the contract it speaks for. Deepening
 * evaluation is a separate decision, and this scan follows it the day it is
 * taken, not before.
 */

/** What counts as an expression — the evaluator's own definition. */
const EXPRESSION_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Mirrors `ExpressionEvaluator.evaluate`: a `${` with no closing brace, or an
 * empty `${}`, is not an expression to the evaluator (its interpolation regex
 * requires at least one character), so it is not one here either. Matching the
 * PRODUCER's definition is what keeps this from reporting strings the engine
 * never intended to touch — prose and code samples that merely contain `${`.
 */
export function findExpressionSources(value: string): string[] {
  const found: string[] = [];
  // `matchAll` needs the /g flag and a fresh lastIndex per call; the literal
  // above is module-scope, so reset before use rather than allocating a regex
  // per value (this runs per key, per node, per render, in dev).
  EXPRESSION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = EXPRESSION_PATTERN.exec(value);
  while (match !== null) {
    found.push(match[0]);
    match = EXPRESSION_PATTERN.exec(value);
  }
  return found;
}

/** Which authored channel a residual expression was found on. */
export type UnevaluatedChannel = 'schema' | 'properties' | 'props';

export interface UnevaluatedExpressionFinding {
  /** The key holding the raw source. */
  key: string;
  /** The authored channel the key was read from. */
  channel: UnevaluatedChannel;
  /** The value, verbatim, as it will be handed to the renderer. */
  value: string;
  /** The `${…}` fragments inside it. */
  expressions: string[];
}

function scanBag(
  bag: unknown,
  channel: UnevaluatedChannel,
  into: UnevaluatedExpressionFinding[],
  skip?: (key: string, value: string) => boolean
): void {
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return;
  for (const [key, value] of Object.entries(bag as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    if (skip?.(key, value)) continue;
    const expressions = findExpressionSources(value);
    if (expressions.length > 0) {
      into.push({ key, channel, value, expressions });
    }
  }
}

/**
 * Collect every unevaluated `${…}` that is about to be handed to a renderer.
 *
 * Pure and side-effect free — the reporting half is {@link reportUnevaluatedExpressions}.
 * Kept separate so the scan can be asserted directly: a diagnostic whose only
 * test is "a spy was called" goes green the moment someone no-ops it.
 *
 * @param spread  The post-strip top-level bag — exactly what `SchemaRenderer`
 *   spreads as React props, which is also what renderers read as `schema.<key>`.
 *   Schema METADATA (`visible` / `hidden` / `disabled` / … ) must already be
 *   removed by the caller: those keys carry raw predicate source BY DESIGN and
 *   are evaluated as conditions, never placed.
 * @param properties  The node's `properties` bag, if any. Reported in
 *   preference to the top-level copy the hoist makes of it, so the finding
 *   names the key the author actually wrote.
 * @param props  The node's legacy `props` bag, if any.
 */
export function collectUnevaluatedExpressions(
  spread: Record<string, unknown> | undefined | null,
  properties?: unknown,
  props?: unknown
): UnevaluatedExpressionFinding[] {
  const findings: UnevaluatedExpressionFinding[] = [];

  scanBag(properties, 'properties', findings);

  // The hoist copies every `properties.*` value onto the node's top level, so
  // the same residue is visible twice. Report the authored spelling only.
  const hoisted =
    properties && typeof properties === 'object' && !Array.isArray(properties)
      ? (properties as Record<string, unknown>)
      : undefined;
  scanBag(spread, 'schema', findings, (key, value) => hoisted?.[key] === value);

  scanBag(props, 'props', findings);

  return findings;
}

/**
 * Prefix every diagnostic line starts with. Exported so tests can match on it
 * and so an app can filter it out of its console transport if it must.
 */
export const UNEVALUATED_EXPRESSION_PREFIX =
  '[ObjectUI] Unevaluated expression reached the DOM';

/** Where a finding sits, spelled the way an author would search for it. */
function locate(finding: UnevaluatedExpressionFinding): string {
  switch (finding.channel) {
    case 'properties':
      return 'properties.' + finding.key;
    case 'props':
      return 'props.' + finding.key;
    default:
      return finding.key;
  }
}

/**
 * Build the message. Separate from the emit so a test can assert the words a
 * developer is going to read, not merely that something was logged.
 */
export function formatUnevaluatedExpressionMessage(
  type: unknown,
  id: unknown,
  findings: UnevaluatedExpressionFinding[]
): string {
  const node = typeof type === 'string' && type ? '"' + type + '"' : '(untyped node)';
  const where = typeof id === 'string' && id ? ' (id: "' + id + '")' : '';
  const lines = findings.map(f => {
    const site = locate(f);
    return (
      '  - ' + site + ': ' + JSON.stringify(f.value) +
      '  [' + f.expressions.join(', ') + ']'
    );
  });
  return (
    UNEVALUATED_EXPRESSION_PREFIX + ' - node ' + node + where + '\n' +
    lines.join('\n') + '\n' +
    'The value above is placed VERBATIM: it is handed to the renderer, and spread\n' +
    'to the DOM, with its source text intact. Either SchemaRenderer does not\n' +
    'evaluate this key, or the expression threw and the evaluator returned the\n' +
    'source unchanged.\n' +
    'Channels that do evaluate and read back today: `content`, or resolve the\n' +
    'value in the host before handing the schema to SchemaRenderer.'
  );
}

/**
 * Reported nodes, so a re-render (or the post-mount forceUpdate that picks up
 * lazy plugin registrations) does not repeat the message. Keyed on the ORIGINAL
 * schema object, matching `validateSchemaOnce`'s dedup: the evaluated copy is a
 * fresh object on every memo recompute and would dedup nothing.
 */
const _reportedNodes: WeakSet<object> =
  typeof WeakSet !== 'undefined'
    ? new WeakSet()
    : ({ add() {}, has() { return false; } } as unknown as WeakSet<object>);

/**
 * Dev-build only. Scans, and on a hit reports once per schema object via
 * `console.error`.
 *
 * `console.error` and not `warn`: this is the loud refusal objectui#4795's
 * ruling asked for, and it follows the assertion shape objectui#5092 landed in
 * SchemaForm. (It is also the level that survives happy-dom, which swallows
 * `console.log`.)
 *
 * The caller applies the production gate, so this stays a single dev-only
 * branch at the call site and the whole module is dead code in a production
 * build.
 */
export function reportUnevaluatedExpressions(
  schema: object | null | undefined,
  type: unknown,
  id: unknown,
  spread: Record<string, unknown> | undefined | null,
  properties?: unknown,
  props?: unknown
): UnevaluatedExpressionFinding[] {
  const findings = collectUnevaluatedExpressions(spread, properties, props);
  if (findings.length === 0) return findings;
  if (schema && typeof schema === 'object') {
    if (_reportedNodes.has(schema)) return findings;
    _reportedNodes.add(schema);
  }
  console.error(formatUnevaluatedExpressionMessage(type, id, findings));
  return findings;
}
