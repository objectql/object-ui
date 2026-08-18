/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The built-in (unregistered) `input` branch honours a declared ceiling in
 * BOTH authored spellings — objectui#5201.
 *
 * ## What was measured on `origin/main`
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
 * `max_length` is a live authoring spelling, not a fossil: the registered
 * widgets dual-read `maxLength ?? max_length` (framework#1878 §3), all three
 * producers of a form field normalize it (`ObjectForm`, `sectionFields`,
 * `EmbeddableForm.applyDefaultMaxLengths`) and `packages/types` declares it on
 * several field types. This branch is the one path with no producer in
 * between — a hand-written `FormSchema` fed straight to the renderer — so on
 * it the author IS the producer and nothing normalizes the spelling.
 *
 * ## Why the assertions read `getAttributeNames()` / `getAttribute()`
 *
 * The missing cap and the stray attribute are two DISTINCT defects, and a test
 * that only checked the cap would let the invalid attribute survive the fix.
 * Reading the attribute NAMES is what makes the stray half observable at all —
 * it is how the card measured it.
 *
 * ## Scope
 *
 * The ceiling only. Whether a single-line input should also carry the visible
 * `{n}/{max}` counter and the announced limit that the built-in `textarea`
 * branch grew in objectui#3439 is an independent design trade-off that does
 * not follow from that card's conclusion; the #5201 triage ruling explicitly
 * left it undecided, so nothing here asserts a counter either way.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentRegistry } from '@object-ui/core';
// Module scope, not `beforeAll` — the cold transform must not be billed to
// `hookTimeout`. See object-ui/no-dynamic-import-in-test-hook (objectui#3010).
import '../../../renderers';

/** Render the built-in branch: no `registerAllFields()`, so nothing resolves from the registry. */
function renderForm(fields: any[]) {
  const Form = ComponentRegistry.get('form')!;
  return render(
    <Form schema={{ type: 'form', showSubmit: false, showCancel: false, fields }} />,
  );
}

const textField = (extra: Record<string, unknown> = {}) => ({
  name: 'title',
  label: 'Title',
  type: 'input',
  ...extra,
});

const input = () => document.querySelector('input') as HTMLInputElement;

afterEach(cleanup);

describe('built-in input — the declared ceiling (objectui#5201)', () => {
  it('applies a camelCase maxLength as the native attribute', () => {
    // This spelling worked before the fix, by the coincidence that it names a
    // real DOM attribute. Pinned so resolving the ceiling explicitly cannot
    // break the spelling that accidentally worked.
    renderForm([textField({ maxLength: 50 })]);
    expect(input().getAttribute('maxlength')).toBe('50');
  });

  it('applies the LEGACY max_length spelling too — it capped nothing before', () => {
    renderForm([textField({ max_length: 50 })]);
    expect(input().getAttribute('maxlength')).toBe('50');
  });

  it('never leaks max_length onto the DOM as a stray attribute', () => {
    renderForm([textField({ max_length: 50 })]);
    // Not a DOM attribute in any spelling. Left in the pass-through it renders
    // invalid HTML that reads like a working cap to the next reader — the
    // second, independent half of this defect.
    expect(input().getAttributeNames()).not.toContain('max_length');
  });

  it('lets the canonical spelling win when both are declared', () => {
    // `maxLength ?? max_length` — the resolution order every other reader in
    // the repo already uses.
    renderForm([textField({ maxLength: 50, max_length: 80 })]);
    expect(input().getAttribute('maxlength')).toBe('50');
    expect(input().getAttributeNames()).not.toContain('max_length');
  });

  it('leaves an uncapped field exactly as it was — no attribute either way', () => {
    renderForm([textField()]);
    expect(input().getAttributeNames()).not.toContain('maxlength');
    expect(input().getAttributeNames()).not.toContain('max_length');
  });
});
