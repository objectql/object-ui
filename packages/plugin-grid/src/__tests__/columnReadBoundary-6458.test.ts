/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6458 — what `ObjectGrid.generateColumns()` is allowed to READ off
 * the AUTHORED column.
 *
 * ## The seam, and why it is NOT the one objectui#6004 fenced
 *
 * objectui#6004 (landed as objectui#6461) typed what this producer WRITES:
 * `ObjectGridColumnDraft` / `ObjectGridColumn`, with a tombstone band DERIVED
 * from `keyof ListColumn` so a future spec member is refused by default. That
 * fence is on the emit, and `columnEmitBoundary-6004.test.ts` pins it.
 *
 * This file pins the OTHER half: the same function's READ of its authored
 * input. Nothing on that side is typed at all — `col` is a `ListColumn`, and
 * every read that `ListColumn` does not declare goes through `(col as any)`,
 * which admits any key whatsoever. `ListColumnSchema` is a `strictObject`, so
 * an author who writes one of those keys is REFUSED at publish with
 * `unrecognized_keys` while this renderer honours it — the `declared !=
 * enforced` split AGENTS.md #0.1 exists to stop.
 *
 * ## What is pinned here, and what is deliberately NOT
 *
 * PINNED — the closable half: a key `ListColumn` DECLARES must never be read
 * through a cast. `prefix` was (objectui#6458's own measurement), which is the
 * worst version of the defect: it made a schema-admitted key look exactly like
 * the four that are not, and it discarded `ColumnPrefix`'s typing at every use.
 * Casting a declared key buys nothing and hides the keys that matter, so it is
 * refused mechanically rather than by review.
 *
 * NOT PINNED — the four genuinely undeclared reads (`format`, `options`,
 * `appearance`, `essential`). Each needs a per-key verdict — declare it on
 * `ListColumn` in `@objectstack/spec`, or stop reading it — and neither leg is
 * this repo's to decide unilaterally: the declare leg widens a published
 * contract, and AGENTS.md #0.1 forbids answering it renderer-side either way.
 * They are held to a SUBSET assertion instead, which is the part that can be
 * enforced without prejudging any of them: the four that exist may leave as
 * they are adjudicated, and a FIFTH may not arrive anonymously.
 *
 * ## Why a source scan rather than a rendering test
 *
 * Same reason `columnEmitBoundary-6004.test.ts` is compile-time: a grid that
 * renders correctly renders exactly as correctly with a cast added back. The
 * defect is that a read is unchecked, and nothing observable at runtime
 * distinguishes `(col as any).prefix` from `col.prefix`. What CAN be measured
 * is the source, so the source is what this reads — and every anchor it needs
 * is asserted present first, because a scanner that silently matches nothing
 * is a green test that measures nothing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The schema comes from the spec, which is where the AUTHORING surface is
// defined; the type comes from `@object-ui/types`, which is what `ObjectGrid`
// itself imports. `packages/types` re-exports the spec schema BY REFERENCE
// (pinned by `types/src/__tests__/spec-subschema-parity.test.ts`), so the two
// sides of this test cannot drift apart.
import { ListColumnSchema } from '@objectstack/spec/ui';
import type { ListColumn } from '@object-ui/types';

const here = path.dirname(fileURLToPath(import.meta.url));
// packages/plugin-grid/src/__tests__ -> repo root
const repoRoot = path.resolve(here, '../../../..');
const GRID_SOURCE = path.join(repoRoot, 'packages/plugin-grid/src/ObjectGrid.tsx');

const gridSource = readFileSync(GRID_SOURCE, 'utf8');

/**
 * The bounds of the `ListColumn` branch of `generateColumns()`. The scan is
 * scoped to it on purpose: `col` names a DIFFERENT thing further down the file
 * (a generated column, in the grouped-width pass), and a cast read there is a
 * separate question owned by objectui#6424 — pulling it in here would make this
 * guard fail for a reason it has no verdict on.
 */
const REGION_START = '(cols as ListColumn[])';
const REGION_END = '// String array format - enrich with objectDef field metadata';

/**
 * Any cast spelling, not just `as any` — `(col as unknown as X).k` and
 * `(col as ListColumn & { k })` would dodge a narrower pattern while doing the
 * same thing.
 */
const CAST_READ = /\(\s*col\s+as\s+[^)]*\)\s*\.\s*([A-Za-z_$][\w$]*)/g;

function castReadKeys(source: string): string[] {
  return [...source.matchAll(CAST_READ)].map((m) => m[1]);
}

/** The keys `ListColumnSchema` admits — read from the schema, never hand-listed. */
const DECLARED_KEYS = Object.keys(
  (ListColumnSchema as unknown as { shape: Record<string, unknown> }).shape
);

/**
 * The undeclared reads objectui#6458 measured and escalated. A SUBSET bound,
 * not an equality: retiring one as its verdict lands must not turn this red,
 * but a fifth key arriving through a cast must.
 */
const ESCALATED_UNDECLARED_READS = ['format', 'options', 'appearance', 'essential'];

describe('objectui#6458 — the read boundary of ObjectGrid.generateColumns()', () => {
  it('the scan region is anchored — both bounds present exactly once', () => {
    // Anti-vacuity. Every "no such key" claim below is worthless if the region
    // resolved to an empty string, so the anchors are asserted first and by
    // count: a moved or duplicated anchor fails HERE, loudly, rather than
    // turning the assertions that follow into green no-ops.
    expect(gridSource.split(REGION_START).length - 1).toBe(1);
    expect(gridSource.split(REGION_END).length - 1).toBe(1);
  });

  it('the scanner extracts a cast read (control on a synthetic input)', () => {
    // The regex proved able to find what it is looking for, on an input whose
    // answer is known — so a zero from the real source is a measurement and not
    // a broken pattern.
    expect(castReadKeys('const x = (col as any).someKey;')).toEqual(['someKey']);
    expect(castReadKeys('const y = (col as unknown as Foo).other;')).toEqual(['other']);
    expect(castReadKeys('const z = col.declaredKey;')).toEqual([]);
  });

  it('the scanner finds cast reads in the real region (control on the real file)', () => {
    const region = gridSource.slice(
      gridSource.indexOf(REGION_START),
      gridSource.indexOf(REGION_END)
    );
    expect(region.length).toBeGreaterThan(1000);
    // Today this is the four escalated keys. If it ever reaches zero, every
    // read in this branch is declared, objectui#6458 is closed, and this file
    // goes with it — a red here is that news, not a regression.
    expect(castReadKeys(region).length).toBeGreaterThan(0);
  });

  it('⭐ no key `ListColumn` DECLARES is read through a cast', () => {
    // The one closable half of objectui#6458. `prefix` failed this before the
    // fix: declared by `ListColumnSchema`, read as `(col as any).prefix`.
    const region = gridSource.slice(
      gridSource.indexOf(REGION_START),
      gridSource.indexOf(REGION_END)
    );
    const castDeclared = castReadKeys(region).filter((k) => DECLARED_KEYS.includes(k));
    expect(
      castDeclared,
      'A declared ListColumn key read through a cast buys nothing and hides the ' +
        'undeclared ones among lookalikes — read it directly (objectui#6458).'
    ).toEqual([]);
  });

  it('no FIFTH undeclared read may arrive anonymously', () => {
    const region = gridSource.slice(
      gridSource.indexOf(REGION_START),
      gridSource.indexOf(REGION_END)
    );
    const undeclared = [...new Set(castReadKeys(region))].filter(
      (k) => !DECLARED_KEYS.includes(k)
    );
    for (const key of undeclared) {
      expect(
        ESCALATED_UNDECLARED_READS,
        `\`${key}\` is read off the authored column and \`ListColumnSchema\` refuses ` +
          'it, so an author who writes it gets `unrecognized_keys` at publish while ' +
          'this renderer honours it. Adjudicate it on objectui#6458 (declare on ' +
          '`@objectstack/spec`, or stop reading it) — do not add a renderer-side ' +
          'tolerance, and do not widen this list to make the build green.'
      ).toContain(key);
    }
  });

  it('the split is real — the schema refuses `essential` while the renderer reads it', () => {
    // The card's core measurement, executable. `essential` is the clearest of
    // the four: it is not a `ListColumn` member, it has no second road (nothing
    // else can mark a column mobile-essential), and the repo authors it nowhere.
    const refused = ListColumnSchema.safeParse({ field: 'name', essential: true });
    expect(refused.success).toBe(false);
    if (!refused.success) {
      const issue = refused.error.issues.find((i) => i.code === 'unrecognized_keys');
      expect(issue).toBeDefined();
      expect((issue as unknown as { keys: string[] }).keys).toContain('essential');
    }

    // DECLARED CONTROL, same query shape: the key this producer now reads
    // WITHOUT a cast is genuinely admitted, so the refusal above is about
    // `essential` and not about the fixture being malformed.
    const admitted = ListColumnSchema.safeParse({
      field: 'name',
      prefix: { field: 'stage', type: 'badge' },
    });
    expect(admitted.success).toBe(true);
  });

  it('dropping the cast restored the type — `ListColumn["prefix"]` is not `any`', () => {
    /** True only for `any`: the one type both branches of a conditional accept. */
    type IsAny<T> = 0 extends 1 & T ? true : false;
    type Expect<T extends true> = T;
    type _PrefixIsTyped = Expect<IsAny<ListColumn['prefix']> extends true ? false : true>;

    // What the cast was throwing away, spelled out: `field` is a `string` the
    // compiler now checks at every use in the prefix cell renderer.
    const col: ListColumn = { field: 'name', prefix: { field: 'stage', type: 'badge' } };
    expect(col.prefix?.field).toBe('stage');
  });
});
