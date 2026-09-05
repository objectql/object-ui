/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6751 — the `flex` node in `data-display-examples.json` declares its
 * layout keys at NODE level, not inside a `props` envelope.
 *
 * ## What was wrong
 *
 * `compositeExample` authored
 *
 *     { "type": "flex", "props": { "direction": "col", "gap": 4 } }
 *
 * `SchemaRenderer` hoists `properties.*` onto the node and spreads `props` as
 * React props instead, so a renderer declared `({ schema })` — the ordinary
 * component-renderer shape, which `flex.tsx` has — never sees the envelope.
 * The example therefore rendered with the DEFAULT `row` direction and the
 * DEFAULT gap while presenting itself as a column with `gap: 4`. The fix is to
 * lift the two keys onto the node, which is where `FlexSchema` declares them;
 * it is NOT to rename `props` to `properties`.
 *
 * ## Why the assertions here are structural rather than acceptance-shaped
 *
 * `BaseSchema` is `.passthrough()`, so the broken document parsed GREEN through
 * every schema in this package and would keep doing so. Acceptance cannot tell
 * "lifted" from "still under `props`, admitted unexamined". What separates the
 * two is the parsed VALUE:
 *
 *     fixture state          FlexSchema.parse(node).direction / .gap / 'props' in node
 *     props envelope         'row' (default) / 2 (default) / true
 *     lifted onto the node   'col'           / 4           / false
 *
 * ## The fence this file must not cross (objectui#6751 triage, twice)
 *
 * Three same-shaped occurrences elsewhere in the repo are DELIBERATE
 * counter-examples — `skills/objectui/rules/protocol.md`'s `card`, and
 * `skills/objectui/guides/schema-expressions.md`'s `card` and `text`, each
 * marked wrong where it stands. The walk below is scoped to this one fixture
 * for that reason: a repo-wide "no node carries `props`" assertion would make
 * the teaching material fail.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FlexSchema, LayoutSchema } from '../zod/layout.zod';

const ROOT = resolve(__dirname, '../../../..');
const FIXTURE = 'packages/types/examples/data-display-examples.json';

/** The fixture is an arbitrary JSON document, so it is read as one. */
type JsonObject = { [key: string]: unknown };

function readFixture(): JsonObject {
  return JSON.parse(readFileSync(resolve(ROOT, FIXTURE), 'utf8')) as JsonObject;
}

/** `doc[key]`, refused loudly rather than read as `undefined` if it is not an object. */
function objectAt(doc: JsonObject, key: string): JsonObject {
  const value = doc[key];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${FIXTURE}: expected an object at \`${key}\`, got ${JSON.stringify(value)}`);
  }
  return value as JsonObject;
}

/**
 * Every object in `doc` that carries a `type` AND a `props` key, reported as
 * `type` + JSON path. The `element:*` namespace is excluded because those
 * renderers read `props` by design (`readProps` merges both bags); every other
 * `type` is a component-renderer type, which never sees the envelope.
 */
function envelopeSites(doc: unknown, path = '$'): string[] {
  const hits: string[] = [];
  if (Array.isArray(doc)) {
    doc.forEach((v, i) => hits.push(...envelopeSites(v, `${path}[${i}]`)));
    return hits;
  }
  if (doc === null || typeof doc !== 'object') return hits;
  const node = doc as Record<string, unknown>;
  if (typeof node.type === 'string' && !node.type.startsWith('element:')
      && Object.prototype.hasOwnProperty.call(node, 'props')) {
    hits.push(`${path} (type=${node.type})`);
  }
  for (const [k, v] of Object.entries(node)) hits.push(...envelopeSites(v, `${path}.${k}`));
  return hits;
}

describe('objectui#6751 — flex layout keys sit on the node, not under `props`', () => {
  it('compositeExample parses through FlexSchema with direction/gap as authored', () => {
    const node = objectAt(readFixture(), 'compositeExample');
    expect(node.type).toBe('flex');

    const parsed = FlexSchema.parse(node);
    // Under the envelope these two read the SCHEMA DEFAULTS ('row' / 2), which
    // is precisely the bug: the document says one thing and renders another.
    expect(parsed.direction).toBe('col');
    expect(parsed.gap).toBe(4);
    // `.passthrough()` carries unknown keys through, so a surviving `props` on
    // the PARSED node is the direct reading that the envelope is still there.
    expect(Object.prototype.hasOwnProperty.call(parsed, 'props')).toBe(false);
  });

  it('compositeExample parses the same way through the published LayoutSchema union', () => {
    const parsed = LayoutSchema.parse(objectAt(readFixture(), 'compositeExample')) as JsonObject;
    expect(parsed.type).toBe('flex');
    expect(parsed.direction).toBe('col');
    expect(parsed.gap).toBe(4);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'props')).toBe(false);
  });

  it('no component-renderer node anywhere in the fixture carries a `props` envelope', () => {
    expect(envelopeSites(readFixture())).toEqual([]);
  });

  it('positive control — the walk above catches an envelope when one is present', () => {
    // Without this, the zero on the previous assertion could come from a walker
    // that never reports anything.
    const doc = readFixture();
    objectAt(doc, 'compositeExample').props = { direction: 'col', gap: 4 };
    expect(envelopeSites(doc)).toEqual(['$.compositeExample (type=flex)']);
  });

  it('negative control — `properties` and the `element:*` carve-out are not flagged', () => {
    // `properties` is the bag SchemaRenderer DOES hoist, and `element:*` reads
    // `props` by design; flagging either would make the zero above meaningless.
    expect(envelopeSites({ type: 'card', properties: { title: 'Customer Summary' } })).toEqual([]);
    expect(envelopeSites({ type: 'element:div', props: { className: 'p-4' } })).toEqual([]);
  });

  it('negative control — the lift left the rest of the node untouched', () => {
    const node = objectAt(readFixture(), 'compositeExample');
    expect(node.id).toBe('user-profile-card');
    const children = node.children as JsonObject[];
    expect(children.map((c) => c.type)).toEqual(['avatar', 'statistic', 'badge', 'list']);
    expect(children[0]).toMatchObject({
      type: 'avatar', alt: 'User Avatar', fallback: 'JD', size: 'lg',
    });
  });
});
