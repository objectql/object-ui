/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `element:text_input` — the published authoring surface stays in parity with
 * `@objectstack/spec` `ElementTextInputProps` (objectui#3808).
 *
 * `text-input.test.tsx` next door already proves the RENDERER seeds a bound page
 * variable from `defaultValue`. This file proves the complementary and, until
 * #3808, false half: that an author can find out the key exists.
 *
 * WHY THIS BLOCK NEEDED IT MOST. `element:text_input` is deliberately NOT in
 * `PUBLIC_BLOCKS` ("bare inputs belong to a form, not a page block",
 * `packages/core/src/registry/public-blocks.ts:80`), so it never reaches
 * `sdui.manifest.json` and the usual argument — "the manifest advertises it" —
 * does not apply. Its `inputs` are a live contract anyway:
 * `renderers/layout/page.tsx:462` builds the JSX-page compiler's prop whitelist
 * from `getKnownTypes()` plus these same `inputs`, so while `defaultValue` was
 * undeclared, `sdui-parser/src/validate.ts:74` reported `unknown-prop` for it on
 * every JSX page — a warning against a key the renderer then went on to honour,
 * with no way for the author to discover which of the two was right.
 *
 * Expectations are derived from the spec at runtime, not restated.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { ElementTextInputPropsSchema } from '@objectstack/spec/ui';
// Module scope, not a hook: the cold transform is billed to the import phase,
// which has no test/hook timeout (AGENTS.md §测试纪律, objectui#3010).
import '../renderers';

type ShapeCarrier = { shape?: unknown; _def?: { shape?: unknown } };

/** Resolve the props object's `.shape` through both spellings, lazy or plain. */
function specTopLevelKeys(): string[] {
  const carrier = ElementTextInputPropsSchema as unknown as ShapeCarrier;
  const shape = carrier.shape ?? carrier._def?.shape;
  const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
  return resolved && typeof resolved === 'object' ? Object.keys(resolved) : [];
}

const config = () => ComponentRegistry.getConfig('element:text_input');
const inputs = () => config()?.inputs ?? [];
const inputNames = () => inputs().map((i) => i.name);
const input = (name: string) => inputs().find((i) => i.name === name);
const defaultValueDescription = () => input('defaultValue')?.description ?? '';

describe('element:text_input — registry inputs vs @objectstack/spec', () => {
  it('is registered with a non-empty `inputs` surface', () => {
    expect(config()).toBeDefined();
    expect(inputNames().length).toBeGreaterThan(0);
  });

  it('resolves a non-empty spec key set', () => {
    // Guards the probe, not the subject: a Zod internals change would return `[]`
    // here and make every assertion below vacuously agreeable.
    expect(specTopLevelKeys().length).toBeGreaterThan(0);
  });

  it('declares no top-level input the spec does not accept', () => {
    const allowed = new Set(specTopLevelKeys());
    expect(inputNames().filter((name) => !allowed.has(name))).toEqual([]);
  });

  it('publishes `defaultValue`, which the renderer has read all along', () => {
    // A KEY-reachability claim, so the criterion is that the key SURVIVES the
    // parse — not that the parse succeeds. This props schema is a strip-mode
    // `z.object`, so an UNDECLARED key parses green too and is simply absent from
    // `data` afterwards; asserting `success` alone would prove nothing at all.
    expect(specTopLevelKeys()).toContain('defaultValue');
    const parsed = ElementTextInputPropsSchema.safeParse({ defaultValue: 'acme' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.defaultValue).toBe('acme');

    // The contrast that makes the criterion meaningful: same green parse, key
    // gone, no diagnostic. That is what `defaultValue` looked like to every
    // manifest consumer before it was declared here.
    const undeclared = ElementTextInputPropsSchema.safeParse({ notASpecKey: 1 } as never);
    expect(undeclared.success).toBe(true);
    expect(Object.keys(undeclared.data ?? {})).not.toContain('notASpecKey');

    expect(inputNames()).toContain('defaultValue');
    expect(defaultValueDescription()).not.toBe('');
  });

  it('names the number arm the coarse `type` cannot express', () => {
    // The spec's type is the union `string | number`; `ComponentInput.type` is one
    // coarse control kind, so `'string'` is a real narrowing —
    // `sdui-parser`'s `checkType` warns `type-mismatch` on `defaultValue={42}`,
    // which the spec accepts. The narrowing is not the thing being asserted (it
    // is a `ComponentInput` limit, tracked as objectui#3832); what is asserted is
    // that the description does not hide it, so an author reaching for a numeric
    // default knows the key takes one and knows why the warning appears.
    expect(ElementTextInputPropsSchema.safeParse({ defaultValue: 42 }).success).toBe(true);
    expect(ElementTextInputPropsSchema.safeParse({ defaultValue: true } as never).success).toBe(false);

    expect(input('defaultValue')?.type).toBe('string');
    expect(defaultValueDescription()).toMatch(/number/);
  });

  it('the `defaultValue` description says which of the two behaviours an author gets', () => {
    // The seeding path and the uncontrolled-input path do different things, and
    // which one applies depends on something the block does not own: whether a
    // page variable's `source` points at this component's id. A description
    // saying only "initial value" would be true and useless — the author of a
    // form that submits `page.<var>` needs to know the seed happens once, only
    // while the variable is empty, and that the variable's own default wins.
    const description = defaultValueDescription();
    expect(description).toMatch(/source/);
    expect(description).toMatch(/once/i);
    expect(description).toMatch(/empty/i);
  });

  it('carries no `defaultValue` OF ITS OWN on the defaultValue entry', () => {
    // A `ComponentInput.defaultValue` on this input would publish a default for
    // the default — the designer would pre-fill a seed value the renderer has no
    // opinion about, and every text input in the gallery would come up carrying
    // it. The spec declares no default here either.
    //
    // Existence asserted first: `input('defaultValue')?.defaultValue` is also
    // `undefined` when the input is GONE, so without this line the check would
    // pass most loudly in the one case it is supposed to notice.
    expect(input('defaultValue')).toBeDefined();
    expect(input('defaultValue')?.defaultValue).toBeUndefined();
    expect(ElementTextInputPropsSchema.safeParse({}).data).not.toHaveProperty('defaultValue');
  });
});
