/**
 * objectui#7632 — the shared record-source LADDER is BEHAVIOUR-NEUTRAL at every
 * site that delegates to it.
 *
 * Five view plugins each hand-copied `getDataConfig` — the ruled three-rung
 * ladder `data` -> `staticData` -> `objectName`, published on both faces of the
 * contract (objectui#6939) and pinned by
 * `objectql-record-source-refinement-6939.test.ts`. Collapsing them onto
 * {@link resolveRecordSourceConfig} is only legitimate if it changes nothing any
 * of them resolves, so this file TRANSCRIBES each site's pre-collapse body
 * verbatim from `origin/main` 1ec291c0 and asserts the post-collapse spelling
 * agrees with it across the whole input matrix. A future edit to the shared
 * reader that moves any site turns this red.
 *
 * ## The population is NOT four-identical-plus-one
 *
 * The card measured "four byte-identical modulo the parameter type, plus
 * calendar's `in` guards". Re-measuring on 1ec291c0 found THREE shapes, and the
 * third one is behavioural:
 *
 *  - `ObjectGantt`, `ObjectTree` — the bare ladder.
 *  - `ObjectCalendar` — `'data' in schema && schema.data` guards, because its
 *    parameter is `ObjectGridSchema | CalendarSchema` and `CalendarSchema`
 *    declares neither `data` nor `staticData`. Type-level only: an absent
 *    property reads `undefined`, which is falsy either way. `CALENDAR_IN_GUARD`
 *    below pins that equivalence directly, on a schema that really lacks both
 *    keys.
 *  - `ObjectGrid`, `ObjectMap` — a bare-array `data` shorthand normalized to
 *    `{ provider: 'value', items }`, which the other three do NOT have. This is
 *    a REAL divergence on off-contract input: those three return the array
 *    verbatim, so `dataConfig.provider` is `undefined` downstream and the block
 *    draws nothing. It is preserved, not flattened — the two sites keep the
 *    head locally and the shared rung stays contract-strict (AGENTS.md #0.1),
 *    the same way objectui#7627 left the off-contract `{ provider: 'object' }`
 *    tails at their sites.
 */
import { describe, it, expect } from 'vitest';
import { resolveRecordSourceConfig } from '../record-source.js';

type Schema = { objectName?: string; data?: any; staticData?: any[] };
type Cfg = { provider?: string; object?: string; items?: unknown[] } | null;

/** The bare ladder — `ObjectGantt:321` and `ObjectTree:93`, verbatim. */
const beforeBare = (schema: Schema): Cfg => {
  if (schema.data) return schema.data;
  if (schema.staticData) return { provider: 'value', items: schema.staticData };
  if (schema.objectName) return { provider: 'object', object: schema.objectName };
  return null;
};

/** `ObjectCalendar:118`, verbatim — the `in`-guarded ladder. */
const beforeCalendar = (schema: Schema): Cfg => {
  if ('data' in schema && schema.data) return schema.data;
  if ('staticData' in schema && schema.staticData) {
    return { provider: 'value', items: schema.staticData };
  }
  if (schema.objectName) return { provider: 'object', object: schema.objectName };
  return null;
};

/** `ObjectGrid:428`, verbatim — the ladder with the array shorthand inside rung 1. */
const beforeGrid = (schema: Schema): Cfg => {
  if (schema.data) {
    if (Array.isArray(schema.data)) return { provider: 'value', items: schema.data };
    return schema.data;
  }
  if (schema.staticData) return { provider: 'value', items: schema.staticData };
  if (schema.objectName) return { provider: 'object', object: schema.objectName };
  return null;
};

/** `ObjectMap:128`, verbatim — same shape as grid, spelled through `authored`. */
const beforeMap = (schema: Schema): Cfg => {
  if (schema.data) {
    const authored: unknown = schema.data;
    if (Array.isArray(authored)) return { provider: 'value', items: authored };
    return schema.data;
  }
  if (schema.staticData) return { provider: 'value', items: schema.staticData };
  if (schema.objectName) return { provider: 'object', object: schema.objectName };
  return null;
};

/** The post-collapse spelling now compiled into grid and map: head, then shared rung. */
const afterArrayHead = (schema: Schema): Cfg => {
  if (Array.isArray(schema.data)) return { provider: 'value', items: schema.data };
  return resolveRecordSourceConfig(schema);
};

const SITES: { id: string; before: (s: Schema) => Cfg; after: (s: Schema) => Cfg }[] = [
  { id: 'ObjectGantt:321', before: beforeBare, after: resolveRecordSourceConfig },
  { id: 'ObjectTree:93', before: beforeBare, after: resolveRecordSourceConfig },
  { id: 'ObjectCalendar:118', before: beforeCalendar, after: resolveRecordSourceConfig },
  { id: 'ObjectGrid:428', before: beforeGrid, after: afterArrayHead },
  { id: 'ObjectMap:128', before: beforeMap, after: afterArrayHead },
];

/**
 * Contract-valid by construction: `ViewDataSchema` is a
 * `z.discriminatedUnion('provider', [...])` over object variants whose `object`
 * member declares `object` REQUIRED.
 */
const CONTRACT_VALID: [string, Schema][] = [
  ['both-bindings', { objectName: 'Y', data: { provider: 'object', object: 'X' } }],
  ['data-only', { data: { provider: 'object', object: 'X' } }],
  ['objectName-only', { objectName: 'Y' }],
  ['empty-objectName', { objectName: '', data: { provider: 'object', object: 'X' } }],
  ['api-provider', { objectName: 'Y', data: { provider: 'api', read: { url: '/x' } } }],
  ['api-provider-no-name', { data: { provider: 'api', read: { url: '/x' } } }],
  ['value-provider', { objectName: 'Y', data: { provider: 'value', items: [1] } }],
  ['value-provider-empty-items', { objectName: 'Y', data: { provider: 'value', items: [] } }],
  ['staticData+objectName', { objectName: 'Y', staticData: [1] }],
  ['staticData-only', { staticData: [1] }],
  ['staticData-empty', { objectName: 'Y', staticData: [] }],
  ['data-object-empty-string', { objectName: 'Y', data: { provider: 'object', object: '' } }],
  ['empty-objectName-only', { objectName: '' }],
  ['nothing-bound', {}],
  ['all-three', { objectName: 'Y', staticData: [1], data: { provider: 'object', object: 'X' } }],
];

describe('resolveRecordSourceConfig — behaviour neutrality on contract-valid input (objectui#7632)', () => {
  for (const [name, schema] of CONTRACT_VALID) {
    for (const site of SITES) {
      it(`${site.id} is unchanged for "${name}"`, () => {
        expect(site.after(schema)).toEqual(site.before(schema));
      });
    }
  }

  it('the matrix is a LIT control: every rung of the ladder is actually exercised', () => {
    const reached = new Set(
      CONTRACT_VALID.map(([, s]) => {
        const cfg = resolveRecordSourceConfig(s);
        if (cfg === null) return 'null';
        if (s.data) return 'data';
        if (s.staticData) return 'staticData';
        return 'objectName';
      }),
    );
    // A matrix that never reaches a rung cannot prove that rung neutral.
    expect([...reached].sort()).toEqual(['data', 'null', 'objectName', 'staticData']);
  });
});

/**
 * The OFF-CONTRACT fork: a bare array under `data`. `ViewData` admits no array
 * variant, so this cannot be published — but grid and map normalize it anyway
 * and the other three do not. The collapse deliberately does NOT unify them;
 * these cases pin BOTH sides of the fork, so neither a "fold the head into the
 * shared reader" simplification nor a "drop the redundant head" cleanup can
 * happen silently.
 */
const ARRAY_SHORTHAND: [string, Schema][] = [
  ['array-shorthand', { objectName: 'Y', data: [1, 2] }],
  ['array-shorthand-empty', { objectName: 'Y', data: [] }],
  ['array-shorthand-no-name', { data: [{ id: 1 }] }],
  ['array-shorthand+staticData', { staticData: [9], data: [1] }],
];

describe('the off-contract bare-array `data` shorthand (objectui#7632)', () => {
  for (const [name, schema] of ARRAY_SHORTHAND) {
    it(`grid and map still normalize it for "${name}"`, () => {
      expect(afterArrayHead(schema)).toEqual({ provider: 'value', items: schema.data });
      expect(afterArrayHead(schema)).toEqual(beforeGrid(schema));
      expect(afterArrayHead(schema)).toEqual(beforeMap(schema));
    });

    it(`gantt, tree and calendar still return it verbatim for "${name}"`, () => {
      expect(resolveRecordSourceConfig(schema)).toBe(schema.data);
      expect(resolveRecordSourceConfig(schema)).toEqual(beforeBare(schema));
      expect(resolveRecordSourceConfig(schema)).toEqual(beforeCalendar(schema));
    });
  }

  it('an empty array is truthy, which is why hoisting the head is neutral', () => {
    // The whole neutrality of the hoist rests on this: `if (schema.data)` could
    // never let an array fall through to rung 2 or 3, so checking the array
    // FIRST cannot change which rung is taken.
    expect(Boolean([])).toBe(true);
    expect(beforeGrid({ objectName: 'Y', staticData: [9], data: [] })).toEqual({
      provider: 'value',
      items: [],
    });
  });
});

/**
 * `ObjectCalendar`'s `in` guards, on the schema shape that motivated them:
 * `CalendarSchema` declares neither `data` nor `staticData`, so the guard is a
 * TypeScript narrowing device with no runtime effect. Pinned directly rather
 * than argued, because "the guard is load-bearing" was the card's claim.
 */
describe('the `in`-guard divergence is type-level, not behavioural (objectui#7632)', () => {
  const CALENDAR_IN_GUARD: [string, Schema][] = [
    ['no data/staticData keys at all', { objectName: 'Y' }],
    ['keys present but undefined', { objectName: 'Y', data: undefined, staticData: undefined }],
    ['keys absent, nothing bound', {}],
    ['staticData only, no data key', { staticData: [1] }],
  ];

  for (const [name, schema] of CALENDAR_IN_GUARD) {
    it(`the guarded and unguarded ladders agree for "${name}"`, () => {
      expect(resolveRecordSourceConfig(schema)).toEqual(beforeCalendar(schema));
      expect(beforeCalendar(schema)).toEqual(beforeBare(schema));
    });
  }

  it('is a LIT control: the fixtures really do lack the keys', () => {
    expect('data' in CALENDAR_IN_GUARD[0][1]).toBe(false);
    expect('staticData' in CALENDAR_IN_GUARD[0][1]).toBe(false);
    expect('data' in CALENDAR_IN_GUARD[1][1]).toBe(true);
  });
});
