/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * The five measured specimens of objectui#3832: a `ComponentInput` whose spec
 * type is a UNION, declared with one arm, so the repo's own manifest gate
 * reported `type-mismatch` on the OTHER arm — a legal write.
 *
 * Four of them are the inline-translation-map shapes, and they are the loud
 * ones: the input's own `description` teaches the author to write
 * `{ en, "zh-CN" }` while the same input's `type: 'string'` made
 * `sdui-parser`'s `checkType` warn about it. One platform authority, two halves,
 * contradicting each other on the write it had just recommended. The fifth is
 * `element:text_input.defaultValue`, whose spec type is `string | number`
 * (measured against `ElementTextInputPropsSchema` in
 * `packages/components/src/__tests__/text-input-inputs-spec-parity.test.ts`).
 *
 * The maintainer ruling (2026-08-09) picked direction (a): `ComponentInput.type`
 * learns to express unions, `checkType` passes when ANY arm matches, and these
 * five declare their real unions. This file is the user-visible acceptance face
 * of that ruling — it drives the SAME `manifestFromConfigs` + `validateTree`
 * pair the JSX-page compiler (`packages/components/src/renderers/layout/page.tsx:462`)
 * and the save gate use, over the registry the console really registers.
 *
 * ## Why every specimen comes with a control
 *
 * "No diagnostic" is also what a SILENCED check looks like, and this change is
 * a widening: if `checkType` stopped reporting `type-mismatch` at all, or if the
 * array-valued `type` fell through the switch into `default: return null` (which
 * is exactly what the pre-#3832 `switch (input.type)` does when handed an
 * array), every positive assertion here would still pass. So each specimen is
 * paired with a value that matches NEITHER arm and must still be reported. That
 * pairing is what the mutation runs in the PR body key off: reverting the
 * any-arm logic alone leaves the positives GREEN (vacuously — the switch
 * swallows the array) and turns the CONTROLS red.
 *
 * Module-scope imports, not `beforeAll` (AGENTS.md §测试纪律): the specimens
 * resolve through registration side-effects, and paying that at import time
 * keeps it out of every test/hook timeout budget.
 *
 * ## Specimens 6 and 7 — objectui#4970
 *
 * `element:text.content` and `element:button.label` are the same shape and were
 * measured during #3832's implementation, after the ruling had already fixed its
 * scope at "the five measured specimens" — so they were filed separately rather
 * than folded in, and land here in their own `describe` below. Their arms are
 * derived from the spec's own verdicts rather than restated, which is the
 * discipline `text-input-inputs-spec-parity.test.ts` adopted for the fifth
 * specimen: the gap #3832 closed is EXPRESSIVENESS, and whether a declared arm
 * matches the contract is nobody's gate (objectui#4971), so per-key derivation
 * is what stands in for one.
 */
import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { manifestFromConfigs, validateTree } from '@object-ui/sdui-parser';
import type { Diagnostic, SchemaElement } from '@object-ui/sdui-parser';
import { ElementButtonPropsSchema, ElementTextPropsSchema } from '@objectstack/spec/ui';
import '@object-ui/components';
import '../register-plugins';

/**
 * The manifest built from the WHOLE registry, not just the public tier.
 * `element:text_input` is `tier:'internal'` and so never reaches
 * `sdui.manifest.json`, but `page.tsx:462` builds the JSX-page compiler's prop
 * whitelist from `getKnownTypes()` + these same `inputs` — which is where its
 * `defaultValue` diagnostic was reaching authors.
 */
const manifest = manifestFromConfigs(
  ComponentRegistry.getAllConfigs() as unknown as Parameters<typeof manifestFromConfigs>[0],
);

const diagnose = (node: unknown): Diagnostic[] =>
  validateTree(node as SchemaElement, manifest).diagnostics;

const codesFor = (node: unknown): string[] => diagnose(node).map((d) => d.code);

/** The inline translation map an author is told to write, verbatim from the descriptions. */
const I18N_MAP = { en: 'Account', 'zh-CN': '客户' };

const declaredArms = (type: string, input: string): string[] => {
  const declared = manifest.components[type]?.inputs.find((i) => i.name === input)?.type;
  return Array.isArray(declared) ? declared : [declared as string];
};

/**
 * One representative value per coarse arm, in the vocabulary `checkType`'s
 * `armAccepts` uses (`packages/sdui-parser/src/validate.ts`).
 *
 * `['Account']` earns its place: the `'object'` arm accepts a non-null non-array
 * object and nothing else, so an array is the value that tells "declares the
 * object arm" apart from "stopped checking non-primitives".
 */
const COARSE_ARM_PROBES: ReadonlyArray<readonly [string, unknown]> = [
  ['string', 'Account'],
  ['object', I18N_MAP],
  ['number', 42],
  ['boolean', true],
  ['array', ['Account']],
];

type SpecPropsSchema = { safeParse: (value: unknown) => { success: boolean } };

/**
 * The coarse arms a spec props schema ACCEPTS for one key — derived from the
 * schema's own verdicts, not read off its Zod internals and not restated here
 * (objectui#4970).
 *
 * Restating them would pin the declaration and leave the fact the declaration
 * exists FOR — that the arms are the ones the contract accepts — unmeasured,
 * which is the disposition `text-input-inputs-spec-parity.test.ts` took for the
 * fifth specimen. Derived, either side moving turns the comparison red: a spec
 * release that drops an arm, or a declaration that grows one the spec rejects.
 */
const specAcceptedArms = (schema: SpecPropsSchema, key: string): string[] =>
  COARSE_ARM_PROBES.filter(([, value]) => schema.safeParse({ [key]: value }).success).map(
    ([arm]) => arm,
  );

describe('objectui#3832 — the five measured specimens declare their real unions', () => {
  it('every specimen block is registered (reachability before absence)', () => {
    // Without this, a renamed or unregistered block would satisfy every
    // "no type-mismatch" assertion below by never being validated at all —
    // `unknown-component` is a different code, and the filters here are
    // per-code by design.
    for (const type of ['page:header', 'page:card', 'record:alert', 'element:text_input']) {
      expect(manifest.components[type], `${type} is not registered`).toBeDefined();
    }
  });

  it('`page:header.title` / `.subtitle` accept the inline translation map', () => {
    // The spec union, measured: `ComponentPropsMap['page:header'].title` is
    // `string | Record< string, string >` and `.subtitle` the same.
    expect(declaredArms('page:header', 'title')).toEqual(
      expect.arrayContaining(['string', 'object']),
    );

    const mapped = { type: 'page:header', title: I18N_MAP, subtitle: I18N_MAP };
    expect(diagnose(mapped).filter((d) => d.code === 'type-mismatch')).toEqual([]);

    // …and the plain-string arm keeps validating clean (that half must not move).
    expect(
      diagnose({ type: 'page:header', title: 'Account', subtitle: 'All accounts' }).filter(
        (d) => d.code === 'type-mismatch',
      ),
    ).toEqual([]);

    // CONTROL — a value matching NEITHER arm is still reported.
    expect(codesFor({ type: 'page:header', title: true })).toContain('type-mismatch');
    expect(codesFor({ type: 'page:header', title: 'ok', subtitle: 42 })).toContain(
      'type-mismatch',
    );
  });

  it('`page:card.title` accepts the inline translation map', () => {
    expect(declaredArms('page:card', 'title')).toEqual(
      expect.arrayContaining(['string', 'object']),
    );
    expect(
      diagnose({ type: 'page:card', title: I18N_MAP }).filter((d) => d.code === 'type-mismatch'),
    ).toEqual([]);
    expect(
      diagnose({ type: 'page:card', title: 'Account' }).filter((d) => d.code === 'type-mismatch'),
    ).toEqual([]);

    // CONTROL
    expect(codesFor({ type: 'page:card', title: ['Account'] })).toContain('type-mismatch');
  });

  it('`record:alert.title` / `.body` accept the inline translation map', () => {
    // These two have no spec props schema at rc.6 (`ComponentPropsMap` carries
    // no `record:alert` entry — measured), so the union comes from the RENDERER:
    // `record-alert.tsx:126-127` resolves both through `pickLocalized`, which is
    // what the descriptions already teach.
    expect(declaredArms('record:alert', 'title')).toEqual(
      expect.arrayContaining(['string', 'object']),
    );
    const mapped = { type: 'record:alert', title: I18N_MAP, body: I18N_MAP };
    expect(diagnose(mapped).filter((d) => d.code === 'type-mismatch')).toEqual([]);
    expect(
      diagnose({ type: 'record:alert', title: 'Overdue', body: 'Pay it' }).filter(
        (d) => d.code === 'type-mismatch',
      ),
    ).toEqual([]);

    // CONTROL
    expect(codesFor({ type: 'record:alert', title: 7 })).toContain('type-mismatch');
  });

  it('`element:text_input.defaultValue` accepts the number arm', () => {
    expect(declaredArms('element:text_input', 'defaultValue')).toEqual(
      expect.arrayContaining(['string', 'number']),
    );
    expect(
      diagnose({ type: 'element:text_input', defaultValue: 42, inputType: 'number' }).filter(
        (d) => d.code === 'type-mismatch',
      ),
    ).toEqual([]);
    expect(
      diagnose({ type: 'element:text_input', defaultValue: 'acme' }).filter(
        (d) => d.code === 'type-mismatch',
      ),
    ).toEqual([]);

    // CONTROL — the spec rejects a boolean here (measured in the block's own
    // spec-parity test), and so must the gate. The i18n map is a control too:
    // `ElementTextInputPropsSchema` refuses it, so this key must NOT have
    // acquired the `object` arm its neighbours got.
    expect(codesFor({ type: 'element:text_input', defaultValue: true })).toContain(
      'type-mismatch',
    );
    expect(codesFor({ type: 'element:text_input', defaultValue: I18N_MAP })).toContain(
      'type-mismatch',
    );
  });

  it('the narrowing that STAYS narrow is not swept up by the widening', () => {
    // `element:record_picker.emptyText` is the counter-example, and it is the
    // reason this widening is per-key rather than a blanket "strings may also be
    // objects": rc.6 widened the contract to the `I18nLabel` union, but the
    // renderer passes the value into a text node with no locale resolution
    // (objectui#4163), so only the plain-string form renders. Declaring the
    // object arm here would advertise a shape the renderer drops — the exact
    // mistake this repo files as a false declaration, so `emptyText` keeps its
    // single `'string'` arm until the render site catches up.
    expect(declaredArms('element:record_picker', 'emptyText')).toEqual(['string']);
    expect(codesFor({ type: 'element:record_picker', emptyText: I18N_MAP })).toContain(
      'type-mismatch',
    );
  });
});

/**
 * objectui#4970 — specimens 6 and 7, the two the #3832 table missed.
 *
 * Same contradiction, same evidence: both keys are `required: true`, both blocks
 * are in `PUBLIC_BLOCKS` (`packages/core/src/registry/public-blocks.ts:89` /
 * `:91`) so they reach `sdui.manifest.json` and `sdui-intrinsics.d.ts`, both
 * descriptions tell the author to write an inline translation map, and both
 * renderers resolve one (`elements.tsx`, `pickLocalized` at the `content` and
 * `label` read sites). Only the declared arm disagreed.
 *
 * Controls are paired per specimen for the reason the #3832 block states above,
 * and they are not decoration: reverting `checkType`'s any-arm logic leaves the
 * positives vacuously green — the array-valued `type` falls into the old
 * `switch`'s `default: return null` and the prop produces nothing at all — so the
 * controls are the only half that moves.
 */
describe('objectui#4970 — element:text.content / element:button.label declare their real unions', () => {
  it('both specimen blocks are registered (reachability before absence)', () => {
    // Without this, an unregistered or renamed block satisfies every
    // "no type-mismatch" assertion below by never being validated at all —
    // an absent block reports `unknown-component`, a different code, and the
    // filters here are per-code by design.
    for (const type of ['element:text', 'element:button']) {
      expect(manifest.components[type], `${type} is not registered`).toBeDefined();
    }
  });

  it('the installed spec accepts the string and inline-map arms on both keys, and no others', () => {
    // Guards the derivation before anything is compared against it: a schema
    // that rejected every probe (a renamed key, a new sibling required key)
    // would return `[]` and make the two comparisons below agree vacuously.
    //
    // Measured on the `@objectstack/spec` 17.0.0 GA pin, which is what makes
    // these arms honest rather than copied from the issue — #4970's own table
    // was measured at the 17.0.0-rc.6 pin, and the answer had to be re-taken
    // before the declarations moved.
    expect(specAcceptedArms(ElementTextPropsSchema, 'content')).toEqual(['string', 'object']);
    expect(specAcceptedArms(ElementButtonPropsSchema, 'label')).toEqual(['string', 'object']);
  });

  it('`element:text.content` accepts the inline translation map', () => {
    expect([...declaredArms('element:text', 'content')].sort()).toEqual(
      [...specAcceptedArms(ElementTextPropsSchema, 'content')].sort(),
    );

    expect(
      diagnose({ type: 'element:text', content: I18N_MAP }).filter(
        (d) => d.code === 'type-mismatch',
      ),
    ).toEqual([]);

    // …and the plain-string arm keeps validating clean (that half must not move).
    expect(
      diagnose({ type: 'element:text', content: 'Account' }).filter(
        (d) => d.code === 'type-mismatch',
      ),
    ).toEqual([]);

    // CONTROL — values matching NEITHER arm are still reported. The spec refuses
    // both (measured above), so the gate must too.
    expect(codesFor({ type: 'element:text', content: 42 })).toContain('type-mismatch');
    expect(codesFor({ type: 'element:text', content: ['Account'] })).toContain('type-mismatch');
  });

  it('`element:button.label` accepts the inline translation map', () => {
    expect([...declaredArms('element:button', 'label')].sort()).toEqual(
      [...specAcceptedArms(ElementButtonPropsSchema, 'label')].sort(),
    );

    expect(
      diagnose({ type: 'element:button', label: I18N_MAP }).filter(
        (d) => d.code === 'type-mismatch',
      ),
    ).toEqual([]);
    expect(
      diagnose({ type: 'element:button', label: 'Save' }).filter((d) => d.code === 'type-mismatch'),
    ).toEqual([]);

    // CONTROL
    expect(codesFor({ type: 'element:button', label: true })).toContain('type-mismatch');
    expect(codesFor({ type: 'element:button', label: ['Save'] })).toContain('type-mismatch');
  });
});
