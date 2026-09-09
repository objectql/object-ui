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
 * The accepted `filter` value, in ONE place because five assertions read it.
 *
 * A `ViewFilterRule` list — what objectstack#14406 converged this key onto
 * (objectui#7663), and the orthography every array-declared `filter` door in
 * `ComponentPropsMap` shares. ⚠️ `operator` is spelled `equals` rather than the
 * `eq` alias on purpose: the spec NORMALISES `eq` to `equals` on parse, so a
 * fixture written with the alias would make the round-trip assertion below
 * (`parsed.data?.filter` equals what went in) fail for a reason that has
 * nothing to do with the key being reachable.
 */
const RULE_ARRAY = [{ field: 'status', operator: 'equals', value: 'open' }];

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
    const parsed = ElementRecordPickerPropsSchema.safeParse(withFilter(RULE_ARRAY));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.filter).toEqual(RULE_ARRAY);

    // The contrast that makes the criterion meaningful: the SAME payload plus a
    // key the spec does not declare. Two contract spellings, one verdict — the
    // undeclared key never becomes authoring surface (see
    // `specRefusesUnknownTopLevelKeys`). Carrying `filter` alongside is
    // load-bearing rather than tidy: it is what makes either arm attributable
    // to `notASpecKey` instead of to the declared key having gone bad, and the
    // green parse asserted just above is what proves the base is valid.
    const undeclared = ElementRecordPickerPropsSchema.safeParse({
      ...withFilter(RULE_ARRAY),
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
      expect(undeclared.data?.filter).toEqual(RULE_ARRAY);
    }

    expect(inputNames()).toContain('filter');
    expect(filterDescription()).not.toBe('');
  });

  it('declares `array` as the type the spec actually accepts, not `object`', () => {
    // ⚠️ This pin was the mirror image of itself until objectui#7663.
    // objectui#3830's landing sketch guessed `'array'`, flagged the guess as
    // needing checking against the resolved pin, and the check said `'object'`:
    // `ElementRecordPickerProps.filter` was `FilterConditionSchema`
    // (`z.record(z.string(), z.unknown()).and(z.object({ $and, $or, $not }))`),
    // so the rule ARRAY was the shape rejected outright.
    //
    // objectstack#14406 CONVERGED the key onto `z.array(ViewFilterRuleSchema)`
    // — the last record-form `filter` in `ComponentPropsMap`, under the
    // maintainer's one-orthography ruling (objectui#6206-B, 2026-08-25). The
    // sketch's guess is the answer now, and the verdicts below simply swap
    // sides. ⛔ The refusals are asserted as an ENVELOPE (kind and path), not as
    // a bare `success === false`, so a parse that fails for some unrelated
    // reason cannot stand in for the contract refusing the record form.
    const accepted = ElementRecordPickerPropsSchema.safeParse(withFilter(RULE_ARRAY));
    expect(accepted.success).toBe(true);

    // The RECORD form — every spelling of it — is now refused BY KIND, at the
    // key itself.
    for (const recordForm of [{ status: 'open' }, { $and: [{ a: 1 }] }]) {
      const refused = ElementRecordPickerPropsSchema.safeParse(withFilter(recordForm));
      expect(refused.success, JSON.stringify(recordForm)).toBe(false);
      expect(refused.error?.issues.map((i) => i.code)).toContain('invalid_type');
      expect(refused.error?.issues.map((i) => i.path.join('.'))).toContain('filter');
    }

    // Still refused, and for the same reason as before: neither is an array.
    expect(ElementRecordPickerPropsSchema.safeParse(withFilter('a = 1')).success).toBe(false);
    expect(ElementRecordPickerPropsSchema.safeParse(withFilter(42)).success).toBe(false);

    // An array whose MEMBERS are not rule objects is refused too — at
    // `filter.0`, not at `filter`. The coarse `'array'` declaration cannot say
    // this, which is why the input's description spells the member shape out.
    const tuples = ElementRecordPickerPropsSchema.safeParse(withFilter([['a', '=', 1]]));
    expect(tuples.success).toBe(false);
    expect(tuples.error?.issues.map((i) => i.path.join('.'))).toContain('filter.0');

    expect(input('filter')?.type).toBe('array');
  });

  it('the coarse `array` type agrees with the spec at the KIND boundary, and stops there', () => {
    // The `element:text_input.defaultValue` sibling declares TWO arms, because
    // the spec's type there is the union `string | number` (objectui#3832). This
    // key still needs only one — `checkType`'s `'array'` arm in
    // `sdui-parser/src/validate.ts` passes an array and warns `type-mismatch` on
    // everything else, which is the same KIND partition `safeParse` draws above
    // now that objectstack#14406 converged the key onto a rule array
    // (objectui#7663). Asserted through the real validator, not by reading its
    // source, so a future widening of either side shows up here as a
    // disagreement.
    const manifest = manifestFromConfigs([
      { type: TYPE, namespace: 'element', inputs: [{ name: 'filter', type: 'array' }] },
    ]);
    const codesFor = (literal: string) =>
      compile(`<${TYPE} filter={${literal}} />`, manifest).diagnostics.map((d) => d.code);

    expect(codesFor('[{"field":"status","operator":"equals","value":"open"}]')).toEqual([]);
    // The record form is now the refused kind on BOTH authorities — this is the
    // assertion that flipped, and the reason the declaration had to move with
    // the spec rather than stay `'object'` and disagree with it.
    expect(codesFor('{"status":"open"}')).toContain('type-mismatch');
    expect(codesFor('{"$and":[{"a":1}]}')).toContain('type-mismatch');
    expect(codesFor('42')).toContain('type-mismatch');
    expect(codesFor('null')).toContain('type-mismatch');

    // ⚠️ WHERE THE AGREEMENT ENDS, stated rather than left to be discovered.
    // The coarse vocabulary has no member arm, so a tuple list passes the
    // manifest check and is refused by the spec at `filter.0` (asserted above).
    // That is a KNOWN gap in the declaration's resolution, not a disagreement to
    // repair here: the description carries what the type cannot say.
    expect(codesFor('[["a","=",1]]')).toEqual([]);
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

  it('declares no default for `filter` — the spec parses none in', () => {
    // A filter's default is not "empty object", it is "no filter at all", which
    // `undefined` already is, and the spec declares no default. (This used to
    // also assert the registration carried no `ComponentInput.defaultValue`;
    // that key is an ADR-0049 tombstone since objectui#7493, so the spec's
    // parse is the one channel a default could reach an author through.)
    expect(input('filter')).toBeDefined();
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
      `<${TYPE} object="account" filter={[{"field":"status","operator":"equals","value":"open"}]} searchFields={["name"]} />`,
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
    expect(r.tree).toMatchObject({ type: TYPE, filter: RULE_ARRAY });
    expect(r.diagnostics.some((d) => d.severity === 'error')).toBe(false);
  });
});
