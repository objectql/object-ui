/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7946 — the `widget-schema-anchors` family's third widget.
 *
 * `widget-schema-anchors-6576.test.ts` beside this file did the gallery and the
 * data table: two `Object*Props` whose `schema` anchored to a hand-rolled
 * literal. `ObjectChart` was the harder case of the same shape — its prop type
 * anchored to nothing at all, because the component was published as
 * `(props: any)`. Maintainer ruling 2026-09-09 (director seat, summon #20,
 * decision batch #108 item 3) applied #6576's option A to it: anchor the props,
 * declare the four keys the producers write and the renderer reads, converge
 * the `colors` drift, and pin the read census here.
 *
 * ## What this file pins, and where the rest lives
 *
 * 1. TYPE-LEVEL, on `ObjectChartSchema` in this package: it extends
 *    `BaseSchema`, carries the registry key as its `type` literal, inherits the
 *    base members with their DECLARED types (not `any`), and declares the four
 *    keys with the value types measured at their READ sites — `ChartRendererProps`
 *    for `xAxisKey`/`series`, `ObjectChart.tsx` for `aggregate`/`filter` — not
 *    copied from any producer's literal, which is what the ruling asked for.
 * 2. MIRROR PARITY, per key: the zod copy declares the same four, and `colors`
 *    is now on both faces. Before this card the mirror declared `colors` and
 *    the interface did not, and NOTHING ratcheted that direction —
 *    `zod-mirror-parity.test.ts` measures declared-but-unmirrored and
 *    mirror-wider-than-declared, and a key present ONLY on the mirror is in
 *    neither. That is why the drift survived from objectui#3913 to here.
 * 3. READ CENSUS, source-level, on the widget file: every key read off `schema`
 *    is declared by the mirror or ledgered by name below. Read off disk the way
 *    `widget-schema-anchors-6576.test.ts` reads its widgets — this package
 *    cannot import the plugins.
 *
 * The anchoring of the PROP type to the schema type is pinned where it can be
 * compiled, beside the widget:
 * `plugin-charts/src/__tests__/ObjectChart.schemaAnchor-7946.test.ts`.
 *
 * ## AUTHORABLE vs INTERNAL — the ruling asked for the reading, per key
 *
 * The four keys do not share one verdict, and the ledger below records the two
 * that are INTERNAL so the declaration is not mistaken for new authorable
 * vocabulary. Ground for each is in `ObjectChartSchema`'s own docblock; the
 * short form:
 *
 *   - `aggregate`, `filter` — AUTHORABLE. `@objectstack/spec` names their
 *     carrier as this component's own react props and parses `aggregate` at the
 *     react-page publish gate; the registry `inputs` advertises both.
 *   - `xAxisKey`, `series` — INTERNAL. All five producers COMPUTE them, the
 *     spec's author-facing vocabulary spells the same slots `xAxis`/`{ name }`
 *     and REFUSES the internal spellings by name, and neither appears in the
 *     registry `inputs`. They are declared anyway because they are already
 *     passed through `.passthrough()` unvalidated; declaring buys the VALUE
 *     check without minting authorable vocabulary.
 *
 * ## The ceiling, stated rather than assumed (objectui#5155)
 *
 * `BaseSchema` still carries `[key: string]: any`, so anchoring buys DECLARED
 * members their declared types and does NOT buy rejection of a misspelling.
 * The counter-probe below pins that honestly, as #6576's does.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BaseSchema } from '../base.js';
import type { ObjectChartSchema } from '../objectql.js';
import { ObjectChartSchema as ObjectChartMirror } from '../zod/objectql.zod.js';
import type { ExpressionWire } from '../expression';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const WIDGET_FILE = 'packages/plugin-charts/src/ObjectChart.tsx';

/* ── Type-level pins (compiled by `tsc -p tsconfig.test.json`) ─────────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
/** Tuple-wrapped so a union declared type is judged whole, not limb by limb. */
type ExtendsBase<T> = [T] extends [BaseSchema] ? true : false;

export type assertionChartExtendsBase = Expect<ExtendsBase<ObjectChartSchema>>;
export type assertionChartTypeIsRegistryKey = Expect<Equal<ObjectChartSchema['type'], 'object-chart'>>;
/**
 * Inherited members resolve to their DECLARED types. `Equal`, not `extends`:
 * through the index signature a missing member reads `any`, which a one-way
 * check would accept (the objectui#7087 disabled-twin lesson).
 */
export type assertionChartInheritsVisible = Expect<Equal<ObjectChartSchema['visible'], boolean | ExpressionWire | undefined>>;
export type assertionChartInheritsBind = Expect<Equal<ObjectChartSchema['bind'], string | undefined>>;
/** The four declared keys keep the types measured at their read sites. */
export type assertionXAxisKeyDeclared = Expect<Equal<ObjectChartSchema['xAxisKey'], string | undefined>>;
export type assertionColorsConverged = Expect<Equal<ObjectChartSchema['colors'], string[] | Record<string, string> | undefined>>;
export type assertionFilterAdmitsBothArms = Expect<Equal<ObjectChartSchema['filter'], any[] | Record<string, any> | undefined>>;
/**
 * `series`' element type is `ChartRendererProps.schema.series`' INTERNAL arm.
 * Spelled here as the two facts a reader needs — the binding key is `dataKey`
 * and it is required — rather than as a copy of the whole arm, which would pin
 * the shape twice and drift.
 */
export type assertionSeriesBindsDataKey = Expect<Equal<NonNullable<ObjectChartSchema['series']>[number]['dataKey'], string>>;
export type assertionAggregateGroupByAdmitsStructuredNode =
  Expect<Equal<NonNullable<NonNullable<ObjectChartSchema['aggregate']>['groupBy']>, string | { field?: string; dateGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year'; alias?: string }>>;
/** The helpers can FAIL — synthetic controls. */
export type assertionExtendsBaseCanFail = Expect<Equal<ExtendsBase<{ objectName: string }>, false>>;
export type assertionEqualCanFail = Expect<Equal<Equal<any, string | undefined>, false>>;

describe('ObjectChartSchema — compile-time pins (objectui#7946)', () => {
  it('refuses a wrong-typed inherited base member for the declared reason', () => {
    // @ts-expect-error — `visible` is `boolean | ExpressionWire | undefined` through `BaseSchema`.
    const chart: ObjectChartSchema = { type: 'object-chart', chartType: 'bar', visible: 42 };
    expect(chart.visible).toBe(42);
  });

  it('declares the four keys the producers write and the renderer reads', () => {
    const chart: ObjectChartSchema = {
      type: 'object-chart',
      objectName: 'crm_opportunity',
      chartType: 'bar',
      aggregate: { field: 'amount', function: 'sum', groupBy: 'stage' },
      filter: [['stage', '=', 'won']],
      xAxisKey: 'stage',
      series: [{ dataKey: 'amount', label: 'Amount' }],
      colors: { won: '#10B981' },
    };
    expect([chart.aggregate?.groupBy, chart.xAxisKey, chart.series?.[0].dataKey]).toEqual(['stage', 'stage', 'amount']);
  });

  it('still accepts a MISSPELLING — the ceiling, pinned honestly (objectui#5155)', () => {
    const chart: ObjectChartSchema = { type: 'object-chart', chartType: 'bar', xAxisKy: 'stage' };
    expect(chart.xAxisKy).toBe('stage');
  });
});

/* ── Mirror parity, per key ────────────────────────────────────────────────── */

describe('the zod mirror declares the same keys (objectui#7946)', () => {
  it.each(['xAxisKey', 'series', 'aggregate', 'filter'])('the mirror declares `%s`', (key) => {
    expect(Object.keys(ObjectChartMirror.shape)).toContain(key);
  });

  it('`colors` is on BOTH faces now — the drift the ratchets could not see', () => {
    // The mirror has declared it since objectui#3913. This is the assertion
    // that fails if the interface loses it again; the interface side is the
    // `assertionColorsConverged` type pin above.
    expect(Object.keys(ObjectChartMirror.shape)).toContain('colors');
  });

  it('the mirror CHECKS the declared values, not just their presence', () => {
    // Non-vacuity for the four `.toContain` assertions above: a key declared
    // as `z.any()` would satisfy them and validate nothing.
    const ok = ObjectChartMirror.safeParse({ type: 'object-chart', chartType: 'bar', xAxisKey: 'stage', series: [{ dataKey: 'amount' }] });
    expect(ok.success).toBe(true);
    const bad = ObjectChartMirror.safeParse({ type: 'object-chart', chartType: 'bar', xAxisKey: 0 });
    expect(bad.success).toBe(false);
    const badSeries = ObjectChartMirror.safeParse({ type: 'object-chart', chartType: 'bar', series: [{ label: 'no binding key' }] });
    expect(badSeries.success).toBe(false);
    const badFn = ObjectChartMirror.safeParse({ type: 'object-chart', chartType: 'bar', aggregate: { function: 'average', groupBy: 'stage' } });
    expect(badFn.success).toBe(false);
  });
});

/* ── Read census on the widget file ────────────────────────────────────────── */

/**
 * Keys read off `schema` in `ObjectChart.tsx` that the mirror deliberately does
 * NOT declare, each with the reason it is out of objectui#7946's ruled scope.
 * Every entry must still be READ — a stale exception is a hole, so the census
 * below re-checks that too.
 *
 * All three are the objectui#6914 class (a key read behind a cast and declared
 * on neither published face), which is what that card fixed for
 * `ObjectDataTableSchema`. They are the successor's inventory, not this card's
 * remit: the 2026-09-09 ruling named exactly four keys plus `colors`, and
 * widening past them would be a second contract decision taken without one.
 */
const LEDGERED_UNDECLARED_READS = [
  // `(schema as any).compareTo` — a `CompareToConfig` (the spec's converged
  // `{ kind, dimension? }`), written by `DashboardRenderer` and read to
  // synthesise the comparison overlay series.
  'compareTo',
  // `(schema as { drillDown?: DrillDownConfig }).drillDown` — declared by this
  // component's own registry `inputs` and by the spec's `ChartDrillDownSchema`,
  // and by neither published copy of this shape.
  'drillDown',
  // `schema.title || 'Details'` — the drill drawer heading. Not a `BaseSchema`
  // member either, so it rides the index signature as `any`.
  'title',
] as const;

/**
 * Comments are STRIPPED before the census, and that is load-bearing rather than
 * tidiness: `ObjectChart.tsx` discusses `schema.chart` in prose — explaining
 * that the upstream list-view resolver could NOT be called here because that
 * key is `undefined` on every schema this component receives. A census that
 * reads comments would report a read that does not exist, and the only ways to
 * clear it are to declare a dead key or to ledger a phantom.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Every key read off `schema`, cast-aware: `schema.x`, `schema?.x`, `(schema as T).x`, `schema['x']`. */
function schemaReads(src: string): Set<string> {
  const re = /\bschema(?:\?)?\.([A-Za-z_$][\w$]*)|\(\s*schema as [^)]*\)\.([A-Za-z_$][\w$]*)|\bschema\[['"]([A-Za-z_$][\w$]*)['"]\]/g;
  const out = new Set<string>();
  for (const m of src.matchAll(re)) out.add(m[1] ?? m[2] ?? m[3]);
  return out;
}

describe('ObjectChart.tsx — the prop type anchors `schema`, and every read is declared or ledgered (objectui#7946)', () => {
  const source = readFileSync(join(REPO_ROOT, WIDGET_FILE), 'utf8');

  it('`ObjectChartProps.schema` is `ObjectChartSchema`, with no `props: any` left on the component', () => {
    const start = source.indexOf('export interface ObjectChartProps {');
    expect(start, `${WIDGET_FILE} no longer declares \`export interface ObjectChartProps\``).toBeGreaterThan(-1);
    const iface = source.slice(start, source.indexOf('\n}', start) + 2);
    expect(iface).toMatch(/\bschema:\s*ObjectChartSchema;/);
    expect(iface, 'a hand-rolled inline literal is back').not.toMatch(/\bschema:\s*\{/);
    expect(iface, 'a local `bind` re-declaration is back — it is inherited from BaseSchema (objectui#6357)').not.toMatch(/\bbind\?:/);
    // The exact before-state this card removed.
    expect(source, 'the component is published as `(props: any)` again').not.toContain('export const ObjectChart = (props: any)');
    expect(source).toContain('export const ObjectChart = (props: ObjectChartProps)');
  });

  it('the `type` literal on ObjectChartSchema is the key the widget registers', () => {
    expect(source).toMatch(new RegExp(`ComponentRegistry\\.register\\(\\s*'object-chart'`));
  });

  it('every key read off `schema` is declared by the mirror, or ledgered by name', () => {
    const reads = schemaReads(stripComments(source));
    // Non-vacuity: a widget that reads nothing off `schema` would pass vacuously.
    expect(reads.size).toBeGreaterThan(10);
    expect(reads.has('objectName')).toBe(true);
    // The four the ruling declared are READ — otherwise the declarations are dead.
    for (const key of ['xAxisKey', 'series', 'aggregate', 'filter']) {
      expect(reads.has(key), `${key} is declared by objectui#7946 but no longer read`).toBe(true);
    }

    const declared = new Set([...Object.keys(ObjectChartMirror.shape), ...LEDGERED_UNDECLARED_READS]);
    const readNotDeclared = [...reads].filter((k) => !declared.has(k)).sort();
    expect(readNotDeclared, `${WIDGET_FILE} reads keys its schema type does not declare (objectui#6914 class)`).toEqual([]);

    // Each ledgered exception must still be READ — a stale exception is a hole.
    for (const key of LEDGERED_UNDECLARED_READS) {
      expect(reads.has(key), `${key} is ledgered as undeclared but no longer read`).toBe(true);
    }
  });

  it('the census can see a drifted key, and does not see one that only a COMMENT mentions (non-vacuity controls)', () => {
    // A census that returned an empty set for any input would pass the pin
    // above while measuring nothing.
    const reads = schemaReads(stripComments(
      "const a = schema.objectName; const b = (schema as any).xAxisKy; const c = schema?.filter; const d = schema['data'];",
    ));
    expect([...reads].sort()).toEqual(['data', 'filter', 'objectName', 'xAxisKy']);
    expect([...reads].filter((k) => !new Set(Object.keys(ObjectChartMirror.shape)).has(k))).toEqual(['xAxisKy']);

    // The comment half, which is the control the 6576 census does not have and
    // this file needs (see `stripComments`). Both a block and a line comment,
    // and a `//` inside a URL, which must NOT eat the code after it.
    const commented = schemaReads(stripComments(
      "/** asked for `schema.chart` it would read undefined */\n// see schema.phantom\nconst u = 'https://example.test/x'; const a = schema.objectName;",
    ));
    expect([...commented].sort()).toEqual(['objectName']);
  });
});
