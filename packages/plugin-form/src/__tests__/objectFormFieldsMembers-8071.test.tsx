/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `object-form.fields` — the MEMBER shape this renderer reads (objectui#8071,
 * criterion from objectui#8068).
 *
 * The registration declares `{ name: 'fields', type: 'array' }` with no `of`
 * and no description, and the spec's `object-form.fields` row is
 * `z.array(z.unknown())` carrying the prose "Limit/order the fields shown". So
 * NOTHING on either declared side says what a member is: every coarse member
 * kind parses, and the read site is the whole member contract. That is exactly
 * the population objectui#8068 refuses to leave unwatched, and this file is
 * this key's answer.
 *
 * WHAT THE RENDERER READS, measured at `ObjectForm.tsx`'s `SimpleObjectForm`
 * (the `const fieldsToShow = schema.fields || Object.keys(objectSchema.fields)`
 * loop) and at `flatFields.ts`'s `buildFlatFields`, which the drawer and modal
 * presentations share:
 *
 *     a member is a BARE FIELD NAME, looked up in the object schema.
 *
 * The pin is that sentence made falsifiable, plus the ONE distinction that
 * makes this key worth a pin of its own rather than a note: `object-form` has a
 * SECOND authoring surface spelled `fields` — `sections[].fields` — and the two
 * do NOT share a member vocabulary. A section field may be the spec's
 * `FormFieldSchema` object, whose identity key is `field` (see
 * `sectionFields.ts`, and `sectionFields.spec-parity.test.ts` for its key set).
 * That same object as a member of the TOP-LEVEL `fields` resolves to no name
 * and is dropped in silence — no throw, no console warning, no empty-state.
 *
 * ⛔ NOT a restatement of the declaration: the declaration says `array` and
 * stops. Every row below is a render whose outcome would change if the read
 * site changed — the ablation objectui#8071 ran on this file removed the
 * `typeof fieldName === 'string'` name resolution and reddened rows 1, 3 and 5.
 *
 * The `{ name }` spelling in row 5 is recorded as the renderer's tolerance, not
 * as a second contract (AGENTS.md #0.1): it is what `buildFlatFields` documents
 * ("field names or objects carrying one") and what the loop's
 * `(fieldName as any).name` fallback does. Pinned so that a future edit removing
 * it is a decision rather than an accident, and so the contrast with the
 * REJECTED `{ field }` spelling above it cannot quietly invert.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { registerAllFields } from '@object-ui/fields';
import { ObjectForm } from '../ObjectForm';

registerAllFields();

const OBJECT_SCHEMA = {
  name: 'invoice',
  fields: {
    status: { type: 'text', label: 'Status' },
    sent_at: { type: 'text', label: 'Sent at' },
    note: { type: 'text', label: 'Note' },
  },
};

const makeDataSource = () =>
  ({
    getObjectSchema: vi.fn().mockResolvedValue(OBJECT_SCHEMA),
    getRecord: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }) as any;

/** Render `object-form` and hand back the field labels in DOM order. */
async function renderedFieldLabels(schema: Record<string, unknown>): Promise<string[]> {
  const { container } = render(
    <ObjectForm
      schema={{ type: 'object-form', objectName: 'invoice', mode: 'create', ...schema } as any}
      dataSource={makeDataSource()}
    />,
  );
  // The form resolves the object schema in an effect; wait for the first field
  // to land rather than for a fixed set, so a row asserting an EMPTY result
  // still waits for the same settle point as the others.
  await waitFor(() => expect(container.querySelector('form')).toBeTruthy());
  await waitFor(() =>
    expect(container.querySelector('[data-loading], .animate-pulse')).toBeFalsy(),
  );
  return Array.from(container.querySelectorAll('label')).map((l) =>
    (l.textContent ?? '').replace(/\s*\*\s*$/, '').trim(),
  );
}

describe('object-form `fields` members are BARE FIELD NAMES (objectui#8071)', () => {
  it('1. resolves each member against the object schema, in AUTHORED order', async () => {
    expect(await renderedFieldLabels({ fields: ['note', 'status'] })).toEqual(['Note', 'Status']);
  });

  it('2. control: with no `fields` every declared field renders, in schema order', async () => {
    // Without this the row above could pass on a renderer that ignored the key
    // entirely and happened to agree — it does not: the orders differ.
    expect(await renderedFieldLabels({})).toEqual(['Status', 'Sent at', 'Note']);
  });

  it('3. drops a member the object schema does not declare — no untyped stub', async () => {
    expect(await renderedFieldLabels({ fields: ['status', 'not_a_field'] })).toEqual(['Status']);
  });

  it('4. the spec SECTION-field object is NOT a member of this key, and is dropped silently', async () => {
    // `{ field }` is the spec `FormFieldSchema` identity key — legal in
    // `sections[].fields`, meaningless here. The renderer reads `.name` off a
    // non-string member, finds nothing, and skips it without a word.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await renderedFieldLabels({ fields: [{ field: 'note' }] })).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('5. the SAME entry inside `sections[].fields` DOES resolve — two vocabularies, one word', async () => {
    // The live control for row 4. Without it "dropped" could mean "this object
    // schema never renders `note`", which is the failure mode a one-sided
    // negative cannot tell apart from the claim.
    //
    // The section SELECTS from the fields the top-level key already resolved,
    // so `status` dropping out is the second half of the reading: the section's
    // `{ field: 'note' }` really was resolved to the name `note`. A section
    // whose members resolved to nothing renders no field at all (the loop
    // `return`s on an empty `sectionFields`), which is the outcome row 4 sees.
    // The section heading is a `section-divider` pseudo-field, not a `<label>`,
    // so it is deliberately absent from this list.
    expect(
      await renderedFieldLabels({
        fields: ['note', 'status'],
        sections: [{ label: 'Detail', fields: [{ field: 'note' }] }],
      }),
    ).toEqual(['Note']);
  });

  it('6. tolerates the `{ name }` spelling — recorded as drift, not a second contract', async () => {
    expect(await renderedFieldLabels({ fields: [{ name: 'note' }] })).toEqual(['Note']);
  });
});
