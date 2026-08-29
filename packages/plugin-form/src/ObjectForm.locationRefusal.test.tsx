/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6716, measured end to end: a refused coordinate must be ANNOUNCED,
 * and must still not be stored.
 *
 * The sibling file `ObjectForm.locationRange.test.tsx` is #6714's measurement —
 * an out-of-range pair never reaches `dataSource.create`. This file is the
 * other half: the same refusal, now visible to the person who caused it. Both
 * arms are covered, the pre-existing FORMAT one (`not a coordinate`) and the
 * RANGE one #6714 added (`999, 999`).
 *
 * ## What this measured on the base commit (`faac0d935`), before the fix
 *
 * Typing either text into this same form left `aria-invalid` at `"false"`, the
 * field rendering only its label, the box EMPTY (React restores a controlled
 * input in the same tick when no state update follows a change), and the create
 * payload carrying no `place` key at all. The refusal was total and silent.
 *
 * ## Why the announcement comes from the widget
 *
 * Triage routed the fix to `buildValidationRules`, for a single producer of the
 * published objectui#3222 `error` slot. Measured: that route cannot see a
 * refusal at all — a refusal means `onChange` never fires, so the typed text
 * never becomes a form value, and a `location` branch installed there was
 * invoked with `undefined` in both arms. The last test in this file pins the
 * consequence that keeps the sibling file's docblock true: `buildValidationRules`
 * STILL has no `location` branch, and this card did not give it one.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { valueSchemaFor } from '@objectstack/spec/data';

import { ObjectForm } from './ObjectForm';
import { registerAllFields, buildValidationRules } from '@object-ui/fields';

registerAllFields();

const LOCATION_SCHEMA = valueSchemaFor({ type: 'location' } as any)!;

const siteSchema = {
  name: 'site',
  fields: {
    title: { type: 'text', label: 'Title' },
    place: { type: 'location', label: 'Place' },
  },
};

const makeDS = () => ({
  getObjectSchema: vi.fn().mockResolvedValue(siteSchema),
  create: vi.fn(async (_o: string, d: any) => ({ id: 'r1', ...d })),
  update: vi.fn(),
  findOne: vi.fn(),
});

const waitInput = (c: HTMLElement, name: string) =>
  waitFor(() => {
    const el = c.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
    if (!el) throw new Error(`${name} not ready`);
    return el;
  });

/** The whole rendered row for `place`, so any text the field draws is seen. */
function placeRowText(container: HTMLElement): string {
  let node: HTMLElement | null = container.querySelector('input[name="place"]');
  for (let i = 0; i < 4 && node?.parentElement; i++) node = node.parentElement;
  return (node?.textContent || '').trim();
}

async function typeInto(container: HTMLElement, text: string) {
  fireEvent.change(await waitInput(container, 'place'), { target: { value: text } });
  const el = container.querySelector('input[name="place"]') as HTMLInputElement;
  return { ariaInvalid: el.getAttribute('aria-invalid'), domValue: el.value, rowText: placeRowText(container) };
}

function mountForm() {
  const ds = makeDS();
  const { container } = render(
    <ObjectForm
      schema={{ type: 'object-form', objectName: 'site', mode: 'create' } as any}
      dataSource={ds as any}
    />,
  );
  return { ds, container };
}

describe('ObjectForm shows WHY a location was refused (objectui#6716)', () => {
  it.each([
    ['the RANGE arm', '999, 999'],
    ['the FORMAT arm', 'not a coordinate'],
  ])('%s marks the control invalid and renders a reason', async (_arm, typed) => {
    const { ds, container } = mountForm();
    fireEvent.change(await waitInput(container, 'title'), { target: { value: 'HQ' } });
    const after = await typeInto(container, typed);

    // 1. The a11y state a screen reader reads — `"false"` here before the fix.
    expect(after.ariaInvalid).toBe('true');
    // 2. A reason a person can read, which the row did not carry at all before.
    expect(after.rowText).toContain('Not saved:');
    // 3. The text that was refused is still in the box to be corrected.
    expect(after.domValue).toBe(typed);

    // 4. #6714's rule is untouched: the value is still NOT stored.
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(ds.create).toHaveBeenCalled());
    expect(ds.create.mock.calls[0][1].place).toBeUndefined();
  });

  it('clears the announcement when the coordinate is corrected, and stores it', async () => {
    const { ds, container } = mountForm();
    fireEvent.change(await waitInput(container, 'title'), { target: { value: 'HQ' } });
    expect((await typeInto(container, '999, 999')).ariaInvalid).toBe('true');

    const fixed = await typeInto(container, '30.2741, 120.1551');
    expect(fixed.ariaInvalid).toBe('false');
    expect(fixed.rowText).not.toContain('Not saved:');

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(ds.create).toHaveBeenCalled());
    const stored = ds.create.mock.calls[0][1].place;
    expect(stored).toEqual({ lat: 30.2741, lng: 120.1551 });
    expect(LOCATION_SCHEMA.safeParse(stored).success).toBe(true);
  });

  it('says nothing about a coordinate it accepts', async () => {
    const { container } = mountForm();
    const after = await typeInto(container, '30.2741, 120.1551');
    expect(after.ariaInvalid).toBe('false');
    expect(after.rowText).not.toContain('Not saved:');
  });
});

describe('the fix did NOT give `buildValidationRules` a location branch (objectui#6716)', () => {
  it('compiles no rule for a `location` field', () => {
    // The sibling #6714 pin's docblock states this as fact; it stays true under
    // the widget-local route, and this is what keeps the two files honest. The
    // measured reason it is not worth changing: a refusal never becomes a form
    // value, so a rule here is handed `undefined`.
    // It compiles rules key by key and returns `undefined` when none applied —
    // so `undefined` here is "no branch matched a location field", not "the
    // helper is missing".
    expect(buildValidationRules({ type: 'location', name: 'place' })).toBeUndefined();
    // A control from the same call, so the reading above cannot be an artefact
    // of a helper that returns `undefined` for everything.
    expect(buildValidationRules({ type: 'text', name: 'title', required: true })).toEqual({ required: true });
  });
});
