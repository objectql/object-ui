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
 */
import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { manifestFromConfigs, validateTree } from '@object-ui/sdui-parser';
import type { Diagnostic, SchemaElement } from '@object-ui/sdui-parser';
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
