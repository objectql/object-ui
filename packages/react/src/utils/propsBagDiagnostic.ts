/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isConfigBag } from './configBag.js';

/**
 * Dev-build diagnostic: a `props` CONFIG BAG on a node whose renderer reads its
 * config from `schema` — so the keys inside it are evaluated, spread as React
 * props, and then never read (objectui#6708).
 *
 * ## The defect this names
 *
 * `SchemaRenderer` HOISTS every `properties.*` value onto the node (minus
 * `HOIST_PROTECTED_KEYS`), so a key written under `properties` is a real value
 * on `schema.<key>` by the time a renderer destructures it. `props` is NOT
 * hoisted: it is spread as React props on the created element. A renderer
 * declared as `({ schema })` — the normal shape for the component renderers —
 * therefore never sees it.
 *
 * Measured through the real `SchemaRenderer` on `faac0d935`, one node per row,
 * with a probe renderer that records both channels:
 *
 *   { type: 'test:cap', props:      { data: '${data.customers}' } }
 *       -> React prop `data` = the evaluated array, `schema.data` = undefined
 *   { type: 'test:cap', properties: { data: '${data.customers}' } }
 *       -> React prop `data` = the evaluated array, `schema.data` = the array
 *
 * Same key, same value, one envelope apart. The card's own four-leg reading of
 * the same asymmetry through a real `data-table` is pinned in
 * `packages/components/src/__tests__/data-table-node-data-diagnostic.test.tsx`
 * (objectui#6665): the `props` leg renders `No results found`, the `properties`
 * leg renders the rows.
 *
 * Every gate accepts the `props` spelling — `BaseSchema` is `.passthrough()`
 * with `[key: string]: any` — and `props` is documented as the annotated legacy
 * alias of the config bag, so nothing between the author and the screen says a
 * word. That is the success-receipt shape objectui#6575 and objectui#6665 exist
 * to remove; this is the third instance, and the first at a tier that covers
 * every renderer instead of one component.
 *
 * ## What it deliberately does NOT do
 *
 * It changes NO behaviour. Hoisting `props` to parity with `properties` was
 * option 1 and the maintainer REFUSED it (ruling 2026-08-29, verbatim
 * 「同意」 on option 2): hoisting would weld the legacy alias in as a permanent
 * second spelling, the opposite of this repo's alias-retirement direction.
 * Refusing the key at parse was option 3 and stays blocked on the
 * `.passthrough()` ceiling (objectui#5155 / objectui#6269). So the trap stops
 * being silent; it does not stop being a trap, and what every renderer receives
 * is byte-for-byte what it received before — pinned directly, not asserted, in
 * `SchemaRenderer.propsBagDiagnostic.test.tsx`.
 *
 * ## Why `console.warn`, when its neighbour in this directory uses `error`
 *
 * Two conventions cross here and the choice follows the SHAPE, not the tier.
 * `unevaluatedExpression.ts` sits at this same tier and shouts with
 * `console.error`, but its subject is different: a raw `${…}` placed VERBATIM
 * in front of a user. Nothing is placed here — a value is dropped. That is
 * exactly objectui#6575's and objectui#6665's subject ("you declared something
 * and the renderer dropped it"), and both of those emit `console.warn`. The
 * card names this the third instance of that shape, so it joins that family.
 *
 * ## Level and dedupe were chosen from a census, not from taste
 *
 * The ruling fixed the order: measure component-level `props` usage across the
 * in-repo corpus FIRST, and tune level/dedupe so the diagnostic informs rather
 * than floods. Measured on `faac0d935` by walking every JSON document, every
 * `json` fence in every `.md`/`.mdx`, and every TypeScript object literal in
 * the repo (TS compiler API) for nodes carrying both `type` and `props`:
 * 39 such nodes, of which 22 are on component-renderer types — and 19 of those
 * 22 are test fixtures exercising this exact shape on purpose. The authored,
 * non-test corpus holds 5, none of them in application runtime metadata.
 *
 * So there is nothing to flood, and the level is not softened for volume. The
 * dedupe is still keyed on the MESSAGE rather than on the schema object,
 * because the failure the census makes plausible is a metadata GENERATOR that
 * emits the same wrong envelope on many nodes: those are distinct schema
 * objects, so an object-keyed `WeakSet` (the shape
 * `reportUnevaluatedExpressions` uses next door) would print one line per node
 * for one authoring bug. Keying on the rendered message collapses that to one
 * line while still giving two genuinely different nodes two lines. Full census
 * table: the objectui#6708 PR body.
 */

/**
 * The namespace whose renderers merge BOTH bags.
 *
 * Every `readProps()` in this repo that merges `{ ...schema.props,
 * ...schema.properties }` belongs to a component registered with
 * `namespace: 'element'` — measured by reading all five of them on
 * `faac0d935`: `elements.tsx` (`element:text` / `divider` / `image` / `button`
 * / `number`), `data-list.tsx` (`definition-list` / `repeater`),
 * `text-input.tsx`, `record-picker.tsx` and `metadata-viewer.tsx`. For that
 * family `props` is a legitimate spelling, so silence there is correct rather
 * than a gap — and it is the direction the ruling pins explicitly.
 */
const ELEMENT_NAMESPACE_PREFIX = 'element:';

/**
 * Node types OUTSIDE the `element:` namespace that nevertheless read the raw
 * `props` bag off the schema, so the diagnostic must not claim their keys were
 * dropped.
 *
 * Derived, not guessed: a repo-wide grep for reads of `schema.props` /
 * `schema?.props` on `faac0d935` returns the `element:` family above plus
 * exactly these. `plugin-view`'s `SimpleViewRenderer` reads
 * `schema.props?.columns` for its grid layout.
 *
 * ⚠️ This list is a MEASUREMENT of the current tree, and its cost is stated
 * rather than hidden: `view:simple` reads exactly one key out of the bag, so a
 * `props` key other than `columns` on a `view:simple` node IS dropped and is
 * NOT diagnosed. Silence on a node where the envelope is partly legitimate was
 * preferred to a message that asserts a drop it did not check — a diagnostic
 * that overstates its own consequence teaches authors to distrust it
 * (objectui#6665's `describeIgnoredBind` makes the same trade). The honest way
 * to shrink this list is to stop reading the legacy bag in that renderer, which
 * is a behaviour change on a published component and not this card's to make.
 */
const NON_ELEMENT_PROPS_BAG_READERS: ReadonlySet<string> = new Set(['view:simple']);

/**
 * Does this node's renderer read the `props` bag as a config bag?
 *
 * Exported so the report and its pins cannot drift apart: one predicate, two
 * readers. A non-string `type` answers `false` — an untyped node cannot be in
 * a family — and the caller has already resolved a component for it, so the
 * unknown-type box is not in play.
 */
export function readsPropsBag(type: unknown): boolean {
  if (typeof type !== 'string' || type.length === 0) return false;
  if (type.startsWith(ELEMENT_NAMESPACE_PREFIX)) return true;
  return NON_ELEMENT_PROPS_BAG_READERS.has(type);
}

/** Prefix every line starts with — the handle tests, greps and log filters hold. */
export const DROPPED_PROPS_BAG_PREFIX = '[ObjectUI] A `props` config bag was not read';

/** Where the offending node lives, for the first line of the message. */
function describeAddress(type: unknown, id: unknown): string {
  const node = typeof type === 'string' && type ? `\`${type}\`` : '(untyped node)';
  const where = typeof id === 'string' && id ? ` (id: '${id}')` : '';
  return `${node}${where}`;
}

/**
 * Build the message. Separate from the emit so a test can assert the words a
 * developer is going to read, not merely that something was logged.
 */
export function formatDroppedPropsBagMessage(
  type: unknown,
  id: unknown,
  droppedKeys: readonly string[],
): string {
  const keyList = droppedKeys.map(k => `\`${k}\``).join(', ');
  const one = droppedKeys.length === 1;
  return (
    `${DROPPED_PROPS_BAG_PREFIX} - node ${describeAddress(type, id)}\n` +
    `  ${one ? 'Key' : 'Keys'} under \`props\`: ${keyList}\n` +
    '`props` is NOT hoisted onto the node — only `properties.*` is. It is spread as\n' +
    `React props on the created element, so \`schema.${droppedKeys[0]}\` is undefined and a\n` +
    `renderer declared as \`({ schema })\` never sees ${one ? 'this key' : 'these keys'}. Nothing throws and\n` +
    'nothing is logged by the renderer: the node renders as if the bag were empty.\n' +
    `  Write ${one ? 'it' : 'them'} under \`properties\` instead (or at node level, where the node's\n` +
    'schema declares the key). The `element:*` renderers merge both bags via\n' +
    '`readProps()`; every other renderer reads `schema`. (objectui#6708)'
  );
}

/**
 * Reported messages, so a re-render — or a second node carrying the same
 * authoring bug — does not repeat the line. Module state, exactly like
 * `visibilityDiagnostic.ts`'s `Set`, and reset the same way for tests.
 */
const _warnedPropsBags = new Set<string>();

/**
 * Test-only reset for the dedupe above. Without it the second test to assert
 * the same warning reads the first test's dedupe entry and sees silence — a
 * green run that checked nothing.
 */
export function __resetDroppedPropsBagWarnings(): void {
  _warnedPropsBags.clear();
}

/**
 * Which keys of the OUTGOING props bag are dropped by a `schema`-reading
 * renderer, or `null` when there is nothing to say.
 *
 * Two bags are read, and needing both is a MEASUREMENT rather than caution.
 *
 * `outgoingPropsBag` is the bag `SchemaRenderer` actually spreads — the value
 * of `propsWithoutCanonicalKeys(schema.props, schema.properties)`, passed in
 * rather than re-derived. That is what makes the message honest about the two
 * cases it must not confuse:
 *
 *   - a key BOTH bags declare has already been subtracted by that function
 *     (objectui#5123: `properties` wins on both channels), so the author is
 *     getting the canonical answer and nothing was silently dropped;
 *   - a key only `props` declares survives into that bag, and it is exactly the
 *     key that reaches no `schema` reader.
 *
 * `authoredPropsBag` is what the AUTHOR wrote, read off the original schema
 * before the evaluation memo touched it. It is needed because that memo
 * rebuilds the bag with `{ ...newSchema.props }` under a bare truthiness guard,
 * so a degenerate `props: 'not-a-bag'` arrives at the spread site as
 * `{ '0': 'n', '1': 'o', … }` — measured, not supposed. Reading only the
 * outgoing bag would therefore report nine dropped keys named `0` … `8` and
 * tell the author that `schema.0` is undefined, which is true and useless. A
 * string is not a config bag; there is nothing to point at, and the shape-level
 * defect it represents is a different question from this one.
 *
 * Deliberately narrow, and each exclusion is a reading rather than an omission:
 *
 *   - an EMPTY bag says nothing was authored and nothing was lost;
 *   - a non-object authored `props` is the degenerate case above;
 *   - a node in the {@link readsPropsBag} family is silent by the ruling.
 */
export function collectDroppedPropsKeys(
  type: unknown,
  authoredPropsBag: unknown,
  outgoingPropsBag: unknown,
): string[] | null {
  if (readsPropsBag(type)) return null;
  if (!isConfigBag(authoredPropsBag)) return null;
  if (!isConfigBag(outgoingPropsBag)) return null;
  const keys = Object.keys(outgoingPropsBag);
  return keys.length > 0 ? keys : null;
}

/**
 * Dev-build only. Reports once per distinct message via `console.warn`, and
 * returns the message it emitted (or `null`) so a caller or a test can read the
 * decision rather than infer it from a spy.
 *
 * The caller applies the production gate, so this stays a single dev-only
 * branch at the call site and the whole module is dead code in a production
 * build.
 */
export function reportDroppedPropsBag(
  type: unknown,
  id: unknown,
  authoredPropsBag: unknown,
  outgoingPropsBag: unknown,
): string | null {
  const droppedKeys = collectDroppedPropsKeys(type, authoredPropsBag, outgoingPropsBag);
  if (!droppedKeys) return null;
  const message = formatDroppedPropsBagMessage(type, id, droppedKeys);
  if (_warnedPropsBags.has(message)) return null;
  _warnedPropsBags.add(message);
  console.warn(message);
  return message;
}
