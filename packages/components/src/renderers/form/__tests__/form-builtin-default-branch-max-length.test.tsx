/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The built-in `default` FALLBACK branch honours a declared ceiling in BOTH
 * authored spellings — objectui#5253.
 *
 * ## Which branch this is
 *
 * The last arm of the field switch, serving a `type` that is neither a
 * `BUILTIN_FIELD_TYPES` member (`input`/`textarea`/`checkbox`/`switch`/
 * `select`) nor resolvable from the registry under `field:<type>` or `<type>`.
 * The tests below pin that routing explicitly rather than assuming it: if a
 * future card registers the probe type, the guard fails loudly instead of
 * quietly measuring a different render path.
 *
 * ## What was measured on `origin/main` (87d9202b1, i.e. AFTER #5201 landed)
 *
 * The branch spread `stripRendererOnlyProps(fieldProps)` onto the element and
 * never read the declared ceiling, so one declaration split into two outcomes
 * depending on how it was spelled:
 *
 * | declaration | `maxlength` on the element | effect |
 * |---|---|---|
 * | `maxLength: 50` | `"50"` | capped — but by COINCIDENCE: `maxLength` happens to name a real DOM attribute |
 * | `max_length: 50` | `null`, plus a stray `max_length="50"` | NO cap at all, and invalid HTML |
 *
 * Verbatim probe output from that tree:
 *
 *   max_length: 50 → attrs=["class","max_length","id","aria-describedby","aria-invalid","type","name"]  maxlength=null
 *   maxLength: 50 → attrs=["class","maxlength","id","aria-describedby","aria-invalid","type","name"]    maxlength="50"
 *
 * This is the same defect #5201 fixed one arm earlier in the same switch, and
 * the fix here is the same shape: a LOCAL destructure, never a widening of
 * `stripRendererOnlyProps` (that helper feeds `checkbox`, `switch`, `select`
 * and this fallback alike, so widening it would change three branches this
 * card does not test).
 *
 * `max_length` is a live authoring spelling, not a fossil: the registered
 * widgets dual-read `maxLength ?? max_length` (framework#1878 §3), all three
 * producers of a form field normalize it (`ObjectForm`, `sectionFields`,
 * `EmbeddableForm.applyDefaultMaxLengths`) and `packages/types` declares it on
 * several field types. This branch, like the `input` one, is a path with no
 * producer in between — a hand-written `FormSchema` fed straight to the
 * renderer — so on it the author IS the producer and nothing normalizes the
 * spelling.
 *
 * ## Why the assertions read `getAttributeNames()` AND `getAttribute()`
 *
 * The missing cap and the stray attribute are two DISTINCT defects, and a test
 * that only checked the cap would let the invalid attribute survive the fix —
 * demonstrably so: with BOTH spellings declared, `getAttribute('maxlength')`
 * was already `"50"` before the fix while the stray `max_length` was still on
 * the element. Reading the attribute NAMES is what makes that half observable,
 * and it is how the card measured it.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentRegistry } from '@object-ui/core';
// Module scope, not `beforeAll` — the cold transform must not be billed to
// `hookTimeout`. See object-ui/no-dynamic-import-in-test-hook (objectui#3010).
import '../../../renderers';

/**
 * A `type` no builtin arm claims and nothing registers, so the field switch
 * falls through to `default`. Same probe type the card measured with.
 */
const FALLBACK_TYPE = 'zzunknown';

/** Render the built-in branch: no `registerAllFields()`, so nothing resolves from the registry. */
function renderForm(fields: any[]) {
  const Form = ComponentRegistry.get('form')!;
  return render(
    <Form schema={{ type: 'form', showSubmit: false, showCancel: false, fields }} />,
  );
}

const fallbackField = (extra: Record<string, unknown> = {}) => ({
  name: 'title',
  label: 'Title',
  type: FALLBACK_TYPE,
  ...extra,
});

const input = () => document.querySelector('input') as HTMLInputElement;

afterEach(cleanup);

describe('built-in default fallback — the declared ceiling (objectui#5253)', () => {
  it('is really reached through the DEFAULT arm — nothing resolves this type', () => {
    // The routing guard for everything below. `ComponentRegistry.get('form')`
    // in `renderForm` is the counter-probe: the registry IS populated by the
    // `../../../renderers` import, so these two `undefined`s are a reading,
    // not an empty registry.
    expect(ComponentRegistry.get('form')).toBeTruthy();
    expect(ComponentRegistry.get(`field:${FALLBACK_TYPE}`)).toBeUndefined();
    expect(ComponentRegistry.get(FALLBACK_TYPE)).toBeUndefined();
  });

  it('applies a camelCase maxLength as the native attribute', () => {
    // This spelling worked before the fix, by the coincidence that it names a
    // real DOM attribute. Pinned so resolving the ceiling explicitly cannot
    // break the spelling that accidentally worked.
    renderForm([fallbackField({ maxLength: 50 })]);
    expect(input().getAttribute('maxlength')).toBe('50');
  });

  it('applies the LEGACY max_length spelling too — it capped nothing before', () => {
    renderForm([fallbackField({ max_length: 50 })]);
    expect(input().getAttribute('maxlength')).toBe('50');
  });

  it('never leaks max_length onto the DOM as a stray attribute', () => {
    renderForm([fallbackField({ max_length: 50 })]);
    // Not a DOM attribute in any spelling. Left in the pass-through it renders
    // invalid HTML that looks like a working cap to the next reader — the
    // second, independent half of this defect.
    expect(input().getAttributeNames()).not.toContain('max_length');
  });

  it('lets the canonical spelling win when both are declared', () => {
    // `maxLength ?? max_length` — the resolution order every other reader in
    // the repo already uses. Note the two halves fail independently here: the
    // cap assertion passed before the fix, the stray one did not.
    renderForm([fallbackField({ maxLength: 50, max_length: 80 })]);
    expect(input().getAttribute('maxlength')).toBe('50');
    expect(input().getAttributeNames()).not.toContain('max_length');
  });

  it('leaves an uncapped field exactly as it was — no attribute either way', () => {
    renderForm([fallbackField()]);
    expect(input().getAttributeNames()).not.toContain('maxlength');
    expect(input().getAttributeNames()).not.toContain('max_length');
  });
});
