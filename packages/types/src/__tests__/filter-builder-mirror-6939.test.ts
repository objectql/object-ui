/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#6939, the `filter-builder` group — the VALIDATOR half. The render
 * half is
 * `examples/schema-catalog/test/filter-builder-mirror-6939.test.tsx`.
 *
 * ## The defect
 *
 * Three independent mis-declarations in one member, each a key-name or
 * vocabulary MOVE rather than a missing optional key:
 *
 *   1. `FilterFieldSchema` required `name`. Every read site matches an entry by
 *      `value` — `fields.find((f) => f.value === …)` in `getOperatorsForField`,
 *      `changeField`, `getInputType` and `renderValueInput`, `fields[0]?.value`
 *      in `addCondition`, and `<SelectItem value={field.value}>` in the field
 *      dropdown. `name` had zero.
 *   2. Its `type` enum was `string | number | date | boolean | select`.
 *      `string` is a phantom; `text`, `datetime` and `time` — three of the six
 *      `FilterValueFamily` members the component actually folds a column into —
 *      were all refused.
 *   3. `FilterGroupSchema` was `{ operator, conditions }`. The gate is
 *      `isValidGroup` (`custom/filter-builder.tsx:1060`), which reads
 *      `conditions` and `logic` and nothing else.
 *
 * All five `components-complex-filter-builder/*` catalog entries author
 * `{ value, label, type }` fields and a `{ id, logic, conditions }` group — the
 * registration's own `inputs`/`defaultProps` spelling — so the mirror refused
 * every one of them while the renderer drew them.
 *
 * ## Ruling
 *
 * Maintainer, 2026-09-02, via the director seat (summon #8), verbatim 「同意」,
 * recorded as objectui#6939 comment 5510084784. Its `filter-builder` row:
 * *field key is `value`; type vocabulary `text` / `number` / `boolean` /
 * `date` / `datetime` / `time`; group shape `{ id, logic, conditions }`.*
 *
 * ## Two places this implementation departs from a LITERAL reading, and why
 *
 * Both are measured, both are declared here rather than made quietly, and both
 * are flagged on the PR for contract review.
 *
 *   - **`select` is retained.** The ruling's six-member list inherits the
 *     finding card's description of `select` as "extra". It is not: it has its
 *     own operator bucket (`selectLikeTypes`, `custom/filter-builder.tsx:935`,
 *     read by `operatorsForFieldType` and `isOptionDrivenValueControl`) and
 *     draws the option-driven Select instead of a text box. Dropping it would
 *     refuse a spelling this mirror accepts TODAY and the renderer draws
 *     distinctly — a fresh instance of the class this card closes.
 *   - **Group `id` is declared OPTIONAL.** `isValidGroup` never consults it and
 *     nothing reads `filterGroup.id`; deleting it from an authored group
 *     renders byte-identically (the render half measures that). Requiring it
 *     would invent a refusal the renderer does not make.
 *
 * ## What this change does NOT reach, stated rather than left as an absence
 *
 * Two of the four census entries — `product-search` and `with-conditions`, plus
 * the `filter-builder` nested inside `search-interface` — still refuse
 * afterwards, on a FOURTH divergence the ruling does not address: they author
 * `conditions[].operator` as `eq` / `gt` / `lt`, and `FilterOperatorSchema` is
 * the spec's canonical `equals` / `greater_than` / `less_than`.
 * `assertion the residual refusal is the operator alias and nothing else`
 * pins that mechanically — swapping only those three spellings makes both
 * entries parse — so the claim "the three ruled divergences are gone from all
 * four" is measured rather than asserted. The operator vocabulary is a genuine
 * fork (the builder's own dropdown ids are `notEquals` / `greaterThan`, which
 * this mirror ALSO refuses, while the canonical spellings it accepts render a
 * blank operator trigger) and needs its own ruling.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { FilterBuilderSchema, FilterFieldSchema, FilterGroupSchema } from '../zod/complex.zod';
import { safeValidateSchema } from '../zod/index.zod';
import type { FilterField as TsFilterField, FilterGroup as TsFilterGroup } from '../complex';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const CATALOG = join(REPO_ROOT, 'examples/schema-catalog/src/schemas/components-complex-filter-builder');
const READER = 'packages/components/src/custom/filter-builder.tsx';

/** The four entries `node packages/cli/dist/cli.js check` counts for this row. */
const CENSUS = ['empty-filter-builder', 'product-search', 'user-filters', 'with-conditions'] as const;

function entry(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CATALOG, `${name}.json`), 'utf8')) as Record<string, unknown>;
}

/** The `filter-builder` node nested inside the `stack`-rooted fifth entry. */
function nestedSearchInterface(): Record<string, unknown> {
  const doc = entry('search-interface') as { children: Record<string, unknown>[] };
  const node = doc.children.find((c) => c.type === 'filter-builder');
  if (!node) throw new Error('search-interface no longer carries a filter-builder child');
  return node;
}

/** Report the issues rather than `false`, so a red run says what broke. */
function reasons(schema: unknown): string[] {
  const r = safeValidateSchema(schema);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

/** The three alias spellings the fixtures use, mapped to what this mirror declares. */
const CANONICAL: Record<string, string> = { eq: 'equals', gt: 'greater_than', lt: 'less_than' };

function withCanonicalOperators(doc: Record<string, unknown>): Record<string, unknown> {
  const group = doc.value as { conditions: { operator: string }[] };
  return {
    ...doc,
    value: {
      ...group,
      conditions: group.conditions.map((c) => ({ ...c, operator: CANONICAL[c.operator] ?? c.operator })),
    },
  };
}

/* ── Type-level pins (invariant equality, house form) ─────────────────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function expectType<T extends true>(_: T = true as T): void { /* compile-time only */ }

// The TS twin moved WITH the mirror. These fail to compile if either face
// drifts back, which is the half a runtime assertion cannot cover.
expectType<Equal<TsFilterField['value'], string>>();
expectType<Equal<TsFilterField['type'],
  'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'select'>>();
expectType<Equal<TsFilterGroup['logic'], 'and' | 'or'>>();
expectType<Equal<TsFilterGroup['id'], string | undefined>>();
// `id` is OPTIONAL, not merely typed `string | undefined`: an object that omits
// the key must be assignable, which only this annotation proves.
const groupWithoutId: TsFilterGroup = { logic: 'and', conditions: [] };
// `name` is gone from the declaration — `@ts-expect-error` is the assertion.
// @ts-expect-error `FilterField.name` was renamed to `value` (objectui#6939)
const legacyNamedField: TsFilterField = { name: 'a', label: 'A', type: 'text' };

describe('objectui#6939 — the field key is `value`', () => {
  it('accepts the spelling every read site matches on', () => {
    expect(FilterFieldSchema.safeParse({ value: 'a', label: 'A', type: 'text' }).success).toBe(true);
  });

  it('REFUSES the former `name` spelling — this half of the move is breaking', () => {
    // The accept set MOVES here, it does not merely widen: a document authored
    // against the old mirror stops validating. Named in the changeset.
    expect(FilterFieldSchema.safeParse({ name: 'a', label: 'A', type: 'text' }).success).toBe(false);
  });

  it('`name` is not silently tolerated as a passthrough hole either', () => {
    // A plain `z.object` STRIPS unknown keys, so an undeclared `name` would be
    // accepted-and-discarded rather than refused. What makes the refusal real
    // is that `value` is REQUIRED, so the old shape has no identity at all.
    const parsed = FilterFieldSchema.safeParse({ value: 'a', label: 'A', type: 'text', name: 'a' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'name' in parsed.data).toBe(false);
  });

  it('the reader still matches on `value`', () => {
    // Text-anchored, so a rename in the component turns this red instead of
    // leaving the prose above quietly false.
    const src = readFileSync(join(REPO_ROOT, READER), 'utf8');
    expect(src).toContain('fields.find((f) => f.value === fieldValue)');
    expect(src).toContain('fields[0]?.value');
    expect(src).toContain('value: string');
  });
});

/** The ruling's six. */
const RULED = ['text', 'number', 'boolean', 'date', 'datetime', 'time'] as const;

/**
 * Live field-type spellings this mirror refuses BEFORE this change and still
 * refuses after — each with its own bucket in `custom/filter-builder.tsx`
 * (`numberLikeTypes` for the first four, `selectLikeTypes`/`lookupLikeTypes`
 * for the rest) and its own value control.
 */
const UNRULED_LIVE_TYPES = ['status', 'currency', 'percent', 'rating', 'lookup', 'master_detail', 'user'] as const;

describe('objectui#6939 — the type vocabulary', () => {

  it.each(RULED)('accepts the ruled member `%s`', (type) => {
    expect(FilterFieldSchema.safeParse({ value: 'a', label: 'A', type }).success).toBe(true);
  });

  it('accepts `select`, which this implementation RETAINS against a literal reading', () => {
    // ⚠️ Declared departure — see the header. `selectLikeTypes` gives `select`
    // its own operator bucket and the option-driven value control, so dropping
    // it would refuse a live spelling. If contract review rules the other way,
    // this is the assertion that flips, together with the enum.
    expect(FilterFieldSchema.safeParse({ value: 'a', label: 'A', type: 'select' }).success).toBe(true);
    const src = readFileSync(join(REPO_ROOT, READER), 'utf8');
    expect(src).toContain('const selectLikeTypes = ["select", "status"]');
  });

  it('REFUSES `string` — the phantom the enum used to carry', () => {
    // Breaking half #2. `string` reached the text control only by the
    // unrecognised-word fallthrough in `valueFamilyForFieldType`, so it was
    // indistinguishable from a nonsense spelling; the render half measures that.
    expect(FilterFieldSchema.safeParse({ value: 'a', label: 'A', type: 'string' }).success).toBe(false);
  });

  it.each(UNRULED_LIVE_TYPES)(
    'still refuses the live-but-unruled spelling `%s` — a PRE-EXISTING gap, not a regression here',
    (type) => {
      // ⚠️ Each of these has its own bucket in the component and draws its own
      // control, and each was refused by this mirror BEFORE this change as well
      // as after. Widening to them is an accept-set change the ruling does not
      // cover; reported on objectui#6939 instead of taken here. This assertion
      // exists so the gap is a recorded decision rather than an absence.
      expect(FilterFieldSchema.safeParse({ value: 'a', label: 'A', type }).success).toBe(false);
    },
  );

  it('the gap is measured against the PUBLISHED doc, not against a private opinion', () => {
    // `content/docs/components/complex/filter-builder.mdx` is a THIRD
    // declaration of this component's authoring surface, independent of both
    // faces repaired here, and it already agrees with the renderer: `value` as
    // the field key, `{ id, logic, conditions }` as the group, and a FOURTEEN
    // member `type?` union. This assertion is what makes "the mirror is the odd
    // one out" a reading rather than a claim — and it turns red if someone
    // narrows the DOC to match the mirror, which is the wrong direction.
    const doc = readFileSync(join(REPO_ROOT, 'content/docs/components/complex/filter-builder.mdx'), 'utf8');
    expect(doc).toContain("logic: 'and' | 'or';");
    expect(doc).toMatch(/value: string;\s+\/\/ Field identifier/);
    for (const type of [...RULED, 'select', ...UNRULED_LIVE_TYPES]) {
      expect(doc, `the published doc no longer offers \`${type}\``).toContain(`'${type}'`);
    }
    // …and the doc declares `type` OPTIONAL, which this mirror still does not.
    // A fourth pre-existing gap, recorded for the same reason as the seven.
    expect(doc).toContain('type?:');
    expect(FilterFieldSchema.safeParse({ value: 'a', label: 'A' }).success).toBe(false);
  });
});

describe('objectui#6939 — the group shape is `{ id, logic, conditions }`', () => {
  it('accepts the shape the catalog authors and `EMPTY_GROUP` emits', () => {
    expect(FilterGroupSchema.safeParse({ id: 'root', logic: 'and', conditions: [] }).success).toBe(true);
  });

  it('`id` is OPTIONAL — the renderer never reads it', () => {
    // ⚠️ Declared departure — see the header. `isValidGroup` gates on
    // `conditions` and `logic` only, so a group without `id` renders
    // identically; requiring it would invent a refusal.
    expect(FilterGroupSchema.safeParse({ logic: 'or', conditions: [] }).success).toBe(true);
    const src = readFileSync(join(REPO_ROOT, READER), 'utf8');
    expect(src).toContain('Array.isArray((v as FilterGroup).conditions) &&');
    expect(src).toContain('((v as FilterGroup).logic === "and" || (v as FilterGroup).logic === "or")');
  });

  it('`id` is DECLARED, so it is type-checked rather than admitted unvalidated', () => {
    // The reason for declaring a key with no read site: `z.object` strips
    // unknown keys in silence, so an undeclared `id` would accept `42`.
    expect(FilterGroupSchema.safeParse({ id: 42, logic: 'and', conditions: [] }).success).toBe(false);
  });

  it('REFUSES the former `{ operator, conditions }` shape', () => {
    // Breaking half #3, and the loudest of the three at render time: a group
    // spelled this way fails `isValidGroup`, falls back to `EMPTY_GROUP`, and
    // the board empties.
    expect(FilterGroupSchema.safeParse({ operator: 'and', conditions: [] }).success).toBe(false);
  });

  it('`logic` is still a closed vocabulary', () => {
    expect(FilterGroupSchema.safeParse({ id: 'r', logic: 'xor', conditions: [] }).success).toBe(false);
  });
});

describe('objectui#6939 — the catalog entries the mirror refused', () => {
  it.each(['empty-filter-builder', 'user-filters'])(
    '%s now validates under safeValidateSchema',
    (name) => {
      expect(reasons(entry(name))).toEqual([]);
    },
  );

  it.each(['product-search', 'with-conditions'])(
    '%s: the residual refusal is the operator alias and NOTHING else',
    (name) => {
      // ⛔ Do NOT "repair" this by widening `FilterOperatorSchema` or by
      // rewriting the fixtures. Both are outside the ruling and both need one:
      // the builder's dropdown ids (`greaterThan`) and the spec's canonical
      // spellings (`greater_than`) are a genuine fork, and this mirror refuses
      // the former while the RENDERER draws a blank operator trigger for the
      // latter. Reported on objectui#6939.
      expect(reasons(entry(name))).not.toEqual([]);
      expect(reasons(withCanonicalOperators(entry(name)))).toEqual([]);
    },
  );

  it('the `stack`-rooted fifth entry: its nested filter-builder behaves the same way', () => {
    // `search-interface.json` roots at `stack`, so `objectui check` (which runs
    // `safeValidateSchema` on the ROOT only — `packages/cli/src/commands/check.ts:137`)
    // counts four entries for this row, not five. The nested node is measured
    // here so the fifth file is not silently unexamined.
    const node = nestedSearchInterface();
    expect(reasons(node)).not.toEqual([]);
    expect(reasons(withCanonicalOperators(node))).toEqual([]);
  });

  it.each(CENSUS)('%s: none of the THREE ruled divergences is left in it', (name) => {
    // The positive statement behind the split above, key by key.
    const doc = entry(name) as {
      fields: Record<string, unknown>[];
      value: Record<string, unknown>;
    };
    for (const f of doc.fields) {
      expect(FilterFieldSchema.safeParse(f).success).toBe(true);
      expect('name' in f).toBe(false);
    }
    expect(doc.value.logic).toMatch(/^(and|or)$/);
    expect('operator' in doc.value).toBe(false);
  });
});

describe('objectui#6939 — the controls are legal in BOTH states of this change', () => {
  // Every assertion above that changes verdict is paired with a carrier that
  // does not, so a red run cannot be read as "the repair broke something
  // unrelated". These documents parse before AND after: they carry both key
  // spellings at once (the extra one is stripped in each state) and a `type`
  // that is a member of both enums.
  const bothWays = {
    type: 'filter-builder',
    name: 'x',
    fields: [{ name: 'a', value: 'a', label: 'A', type: 'select' }],
    value: { id: 'r', operator: 'and', logic: 'and', conditions: [] },
  };

  it('the both-spellings carrier validates', () => {
    expect(reasons(bothWays)).toEqual([]);
  });

  it('and it is genuinely reaching FilterBuilderSchema, not some other union arm', () => {
    expect(FilterBuilderSchema.safeParse(bothWays).success).toBe(true);
  });

  it('a `fields` entry that is not an object still refuses, in either state', () => {
    expect(FilterBuilderSchema.safeParse({ ...bothWays, fields: ['a'] }).success).toBe(false);
  });
});

describe('objectui#6939 — the keys are DECLARED, not passthrough holes', () => {
  it('both mirrors expose the ruled keys and no stale one', () => {
    expect(Object.keys((FilterFieldSchema as unknown as { shape: Record<string, unknown> }).shape))
      .toEqual(['value', 'label', 'type', 'operators', 'options']);
    // `FilterGroupSchema` is a `z.lazy`, so its shape is behind the thunk.
    const group = (FilterGroupSchema as unknown as { _def: { getter: () => { shape: Record<string, unknown> } } })
      ._def.getter();
    expect(Object.keys(group.shape)).toEqual(['id', 'logic', 'conditions']);
  });

  it('the unused type-level bindings above are referenced, so lint keeps them', () => {
    expect(groupWithoutId.conditions).toEqual([]);
    expect(legacyNamedField).toBeDefined();
  });
});
