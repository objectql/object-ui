/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `element:record_picker` — the published authoring surface stays in parity with
 * `@objectstack/spec` `ElementRecordPickerProps` for `filter` (objectui#3830).
 *
 * The sibling of `text-input-inputs-spec-parity.test.ts`, for the key that fell
 * out of objectui#3808's own three-class triage: `filter` appears in that
 * issue's raw key dump for this block and then in none of its A / B / C lists,
 * so the change that added the repo-wide parity gate exempted it by name instead
 * of declaring it. It is the fourth A-class gap of exactly the same shape —
 * renderer reads it, spec declares it, `inputs` omitted it.
 *
 * WHY THIS BLOCK NEEDED IT. `element:record_picker` is deliberately NOT in
 * `PUBLIC_BLOCKS` ("record picking is a field widget, not a page block",
 * `packages/core/src/registry/public-blocks.ts`), so it never reaches
 * `sdui.manifest.json` and the usual argument — "the manifest advertises it" —
 * does not apply. Its `inputs` are a live prop whitelist anyway:
 * `renderers/layout/page.tsx` builds the JSX-page compiler's whitelist from
 * `getKnownTypes()` plus these same `inputs`, so while `filter` was undeclared,
 * `sdui-parser/src/validate.ts` reported `unknown-prop` for it on every JSX
 * page — a warning against a key the renderer then filtered the picker's whole
 * candidate set by. The last test in this file is that path, end to end.
 *
 * Expectations are derived from the spec at runtime, not restated.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { compile, manifestFromConfigs } from '@object-ui/sdui-parser';
import { ElementRecordPickerPropsSchema } from '@objectstack/spec/ui';
// Module scope, not a hook: the cold transform is billed to the import phase,
// which has no test/hook timeout (AGENTS.md §测试纪律, objectui#3010).
import '../renderers';

type ShapeCarrier = { shape?: unknown; _def?: { shape?: unknown } };

/** Resolve the props object's `.shape` through both spellings, lazy or plain. */
function specTopLevelKeys(): string[] {
  const carrier = ElementRecordPickerPropsSchema as unknown as ShapeCarrier;
  const shape = carrier.shape ?? carrier._def?.shape;
  const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
  return resolved && typeof resolved === 'object' ? Object.keys(resolved) : [];
}

const TYPE = 'element:record_picker';
const config = () => ComponentRegistry.getConfig(TYPE);
const inputs = () => config()?.inputs ?? [];
const inputNames = () => inputs().map((i) => i.name);
const input = (name: string) => inputs().find((i) => i.name === name);
const filterDescription = () => input('filter')?.description ?? '';

/**
 * A minimal spec-valid props object, so a `filter` probe fails only on `filter`.
 *
 * `displayField: 'name'` used to be the second key here, and it is deliberately
 * NOT re-spelled to a survivor: @objectstack/spec 17.0.0 retired
 * `element:record_picker`'s `displayField` as an ADR-0087 D2 tombstone (#5775),
 * and rc.6 is where this repo first resolves that. A tombstone is refused BY
 * NAME, so the old fixture stopped being "minimal and valid" and started being
 * "valid except for one retired key" — which made all three `filter` assertions
 * below fail on `displayField` instead. `object` alone is a complete valid
 * shape, and keeping the fixture at the true minimum is what stops it drifting
 * into the same trap again.
 */
const withFilter = (filter: unknown) => ({ object: 'account', filter });

/**
 * Does the installed spec REFUSE an undeclared top-level key, or drop it in
 * silence? (objectui#4910, measured on both pins.)
 *
 * `@objectstack/spec` 17.0.0 GA flipped the `element:*` props schemas from
 * strip mode to strict under objectstack#4001 batch A, so an undeclared prop
 * now raises `unrecognized_keys` with a named message; the pinned
 * `17.0.0-rc.6` still drops it in silence. The VERDICT under test is identical
 * either way — an undeclared key is not an authoring surface, which is the
 * whole reason "the declared key survives the parse" says anything — but the
 * EVIDENCE differs, and asserting the wrong one turns this file red for a
 * reason that has nothing to do with what it guards.
 *
 * Probed behaviourally rather than off a version string: the strictness IS the
 * fact this file cares about, a probe cannot go stale against a pin it never
 * reads, and the probe key is a name no spec would ever declare. `object` is
 * carried because it is required, so a refusal here can only be the probe key.
 * Same shape as `recordHighlightsInputs.spec-parity.test.ts`, which took this
 * disposition first (objectui#4648 / PR #4671).
 */
const specRefusesUnknownTopLevelKeys = !ElementRecordPickerPropsSchema.safeParse({
  object: 'account',
  __objectui_4910_probe__: true,
} as never).success;

describe('element:record_picker — registry inputs vs @objectstack/spec', () => {
  it('is registered with a non-empty `inputs` surface', () => {
    expect(config()).toBeDefined();
    expect(inputNames().length).toBeGreaterThan(0);
  });

  it('resolves a non-empty spec key set', () => {
    // Guards the probe, not the subject: a Zod internals change would return `[]`
    // here and make every assertion below vacuously agreeable.
    expect(specTopLevelKeys().length).toBeGreaterThan(0);
  });

  it('publishes `filter`, which the renderer has read all along', () => {
    // A KEY-reachability claim, so the criterion is that the key SURVIVES the
    // parse — not that the parse succeeds. Neither refusal mode makes
    // `success === true` proof on its own: under rc.6's strip mode an
    // UNDECLARED key parses green as well, and under GA's strict mode a green
    // parse only reports that no undeclared key was present. Survival is the
    // claim on both pins.
    expect(specTopLevelKeys()).toContain('filter');
    const parsed = ElementRecordPickerPropsSchema.safeParse(withFilter({ status: 'open' }));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.filter).toEqual({ status: 'open' });

    // The contrast that makes the criterion meaningful: the SAME payload plus a
    // key the spec does not declare. Two contract spellings, one verdict — the
    // undeclared key never becomes authoring surface (see
    // `specRefusesUnknownTopLevelKeys`). Carrying `filter` alongside is
    // load-bearing rather than tidy: it is what makes either arm attributable
    // to `notASpecKey` instead of to the declared key having gone bad, and the
    // green parse asserted just above is what proves the base is valid.
    const undeclared = ElementRecordPickerPropsSchema.safeParse({
      ...withFilter({ status: 'open' }),
      notASpecKey: 1,
    } as never);

    if (specRefusesUnknownTopLevelKeys) {
      // 17.0.0 GA: a loud refusal, and the STRONGER guarantee — the author now
      // gets told. Asserted as an envelope (the code AND the key it names)
      // because a bare "it failed" would be satisfied just as well by a
      // rejection of `filter` or `object`, the halves that have to stay valid.
      expect(undeclared.success).toBe(false);
      expect(undeclared.error?.issues.map((i) => i.code)).toContain('unrecognized_keys');
      const refused = undeclared.error?.issues.flatMap(
        (i) => (i as unknown as { keys?: string[] }).keys ?? [],
      );
      expect(refused).toContain('notASpecKey');
      expect(refused).not.toContain('filter');
      expect(refused).not.toContain('object');
    } else {
      // The pinned rc.6: same green parse, key gone, no diagnostic. That is
      // what `filter` looked like to every manifest consumer before it was
      // declared here — and the silent-drop harm objectstack#4001 batch A
      // retired.
      expect(undeclared.success).toBe(true);
      expect(Object.keys(undeclared.data ?? {})).not.toContain('notASpecKey');
      expect(undeclared.data?.filter).toEqual({ status: 'open' });
    }

    expect(inputNames()).toContain('filter');
    expect(filterDescription()).not.toBe('');
  });

  it('declares `object` as the type the spec actually accepts, not `array`', () => {
    // objectui#3830's landing sketch guessed `'array'` and flagged the guess as
    // needing checking against the resolved pin. It is wrong, and this is why:
    // `ElementRecordPickerProps.filter` is `FilterConditionSchema`, which is
    // `z.record(z.string(), z.unknown()).and(z.object({ $and, $or, $not }))` —
    // an OBJECT. A rule array (an ObjectQL AST, a view's `ViewFilterRule[]`) is
    // rejected outright.
    expect(ElementRecordPickerPropsSchema.safeParse(withFilter({ status: 'open' })).success).toBe(true);
    expect(ElementRecordPickerPropsSchema.safeParse(withFilter({ $and: [{ a: 1 }] })).success).toBe(true);
    expect(ElementRecordPickerPropsSchema.safeParse(withFilter([['a', '=', 1]])).success).toBe(false);
    expect(ElementRecordPickerPropsSchema.safeParse(withFilter('a = 1')).success).toBe(false);
    expect(ElementRecordPickerPropsSchema.safeParse(withFilter(42)).success).toBe(false);

    expect(input('filter')?.type).toBe('object');
  });

  it('the coarse `object` type costs nothing here — it accepts exactly what the spec accepts', () => {
    // The `element:text_input.defaultValue` sibling had to name a narrowing in
    // prose, because `ComponentInput.type` is one coarse control kind and the
    // spec's type there is the union `string | number` (objectui#3832). This key
    // is the case where the two agree exactly: `checkType`'s `'object'` arm in
    // `sdui-parser/src/validate.ts` passes a non-null non-array object and warns
    // `type-mismatch` on everything else — the same partition `safeParse` draws
    // above. Asserted through the real validator, not by reading its source, so
    // a future widening of either side shows up here as a disagreement.
    const manifest = manifestFromConfigs([
      { type: TYPE, namespace: 'element', inputs: [{ name: 'filter', type: 'object' }] },
    ]);
    const codesFor = (literal: string) =>
      compile(`<${TYPE} filter={${literal}} />`, manifest).diagnostics.map((d) => d.code);

    expect(codesFor('{"status":"open"}')).toEqual([]);
    expect(codesFor('{"$and":[{"a":1}]}')).toEqual([]);
    expect(codesFor('[["a","=",1]]')).toContain('type-mismatch');
    expect(codesFor('42')).toContain('type-mismatch');
    expect(codesFor('null')).toContain('type-mismatch');
  });

  it('the `filter` description says which of the two filters an author writes wins', () => {
    // The renderer reads `composed?.filter ?? props.filter`, so a node that
    // carries a `dataSource` filter DROPS this key rather than combining with
    // it — while the binding's own filter AND-combines with the saved view it
    // names. A description saying only "filter criteria" would be true and
    // useless: an author writing both would have no way to know which one
    // decides the candidate set, which is the one thing objectui#3830 insists
    // this entry has to state.
    const description = filterDescription();
    expect(description).toMatch(/dataSource/);
    expect(description).toMatch(/precedence/i);
    expect(description).toMatch(/\$filter/);
  });

  it('carries no `defaultValue` on the filter entry', () => {
    // A default here would pre-fill every picker in the designer with a filter
    // the renderer has no opinion about — and a filter's default is not "empty
    // object", it is "no filter at all", which `undefined` already is. The spec
    // declares no default either.
    //
    // Existence asserted first: `input('filter')?.defaultValue` is also
    // `undefined` when the input is GONE, so without this line the check would
    // pass most loudly in the one case it is supposed to notice.
    expect(input('filter')).toBeDefined();
    expect(input('filter')?.defaultValue).toBeUndefined();
    expect(
      ElementRecordPickerPropsSchema.safeParse({ object: 'account' }).data,
    ).not.toHaveProperty('filter');
  });

  it('a JSX page writing `filter` no longer gets `unknown-prop` from the compiler', () => {
    // The harm objectui#3830 describes, end to end. The manifest is assembled
    // the way `renderers/layout/page.tsx` assembles the JSX-page compiler's
    // whitelist — `getKnownTypes()` mapped through each type's registered meta —
    // so this runs against the LIVE registration, not a hand-written fixture
    // that could agree with itself.
    const manifest = manifestFromConfigs(
      ComponentRegistry.getKnownTypes().map((t) => {
        const meta = ComponentRegistry.getMeta(t);
        return { type: t, namespace: meta?.namespace, isContainer: meta?.isContainer, inputs: meta?.inputs };
      }) as unknown as Parameters<typeof manifestFromConfigs>[0],
    );

    // Non-vacuity, and the reason this test can fail for the right reason: the
    // SAME compile call carries `searchFields`, a spec key this block
    // deliberately does not publish (an ADR-0087 tombstone upstream — see the
    // exemptions in `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`).
    // It must still come back as `unknown-prop`. Without this control, "no
    // unknown-prop for filter" would also be what a broken manifest, an
    // unregistered tag or a silent parse failure looks like.
    const r = compile(
      `<${TYPE} object="account" filter={{"status":"open"}} searchFields={["name"]} />`,
      manifest,
    );

    const unknownProps = r.diagnostics
      .filter((d) => d.code === 'unknown-prop')
      .map((d) => d.message);
    expect(unknownProps.join(' | ')).toMatch(/searchFields/);
    expect(unknownProps.join(' | ')).not.toMatch(/"filter"/);

    // And the key survives into the compiled tree as itself — the whole point of
    // publishing it is that the author's `filter` reaches the renderer, which
    // turns it into the picker query's `$filter`.
    expect(r.tree).toMatchObject({ type: TYPE, filter: { status: 'open' } });
    expect(r.diagnostics.some((d) => d.severity === 'error')).toBe(false);
  });
});
