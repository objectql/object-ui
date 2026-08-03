/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * End-to-end pin for `ObjectFormSchema.mobile.fullscreenLongText`
 * (objectui#3245) — the ONLY integration coverage this feature has.
 *
 * Everything below is real: the real `ObjectForm` (the flag's single
 * producer), the real form renderer in `@object-ui/components`, the real
 * registry, and the real `TextAreaField` from `@object-ui/fields`. Nothing is
 * mocked but the data source, because the bug this file exists to prevent
 * lived exactly in the SEAMS between those four — each end looked correct on
 * its own and the flag fell through the join:
 *
 *   1. `ObjectForm` auto-generates a FormField with `type: 'field:textarea'`
 *      and stashes the object-field metadata on `field`;
 *   2. it stamped `mobile_fullscreen` onto the FormField ITSELF;
 *   3. the form renderer forwards `field: field.field || field` — for an
 *      auto-generated field `.field` exists, so the widget received the raw
 *      metadata, WITHOUT the flag;
 *   4. the FormField-level copy was then dropped by
 *      `stripRegisteredFieldProps`.
 *
 * Result: the flag reached `TextAreaField` only on the hand-authored
 * `customFields` path (no `.field` to shadow the FormField), i.e. never on the
 * path virtually every form actually takes. Unit tests on both ends passed
 * throughout. The fix stamps the flag onto the metadata carrier the renderer
 * will forward — `f.field || f` — so there stays exactly ONE carrier
 * (objectui#3233) and it is the one the widget reads.
 *
 * `registerAllFields` registers each widget as a `React.lazy`, so the
 * assertions sit behind a dynamic-import boundary — the shape AGENTS.md's test
 * discipline says must be warmed at MODULE SCOPE (never in a `beforeAll`,
 * whose 10s budget is narrower than the timeout it would replace) so the cold
 * transform is billed to the import phase, which no test/hook timeout bounds.
 * Here the barrel import below IS that warm-up: `@object-ui/fields`'s entry
 * statically imports and re-exports `./widgets/TextAreaField`, the very
 * specifier the lazy loader uses, so by the time a test renders, the widget
 * module is already in the ESM cache and `React.lazy` resolves off it instead
 * of racing RTL's 1000ms `findBy` budget against a cold Vite transform.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { registerAllFields } from '@object-ui/fields';
import type { ObjectFormSchema } from '@object-ui/types';
import { ObjectForm } from '../ObjectForm';

registerAllFields();

const objectSchema = {
  name: 'issue_note',
  label: 'Issue Note',
  fields: {
    body: { type: 'textarea', label: 'Body' },
  },
};

function makeDataSource() {
  return {
    getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
    findOne: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
  } as any;
}

function renderForm(schema: Partial<ObjectFormSchema>) {
  return render(
    <ObjectForm
      schema={
        {
          type: 'object-form',
          objectName: 'issue_note',
          mode: 'create',
          ...schema,
        } as ObjectFormSchema
      }
      dataSource={makeDataSource()}
    />,
  );
}

describe('ObjectForm mobile.fullscreenLongText → TextAreaField (objectui#3245)', () => {
  it('reaches the widget for an AUTO-GENERATED long-text field', async () => {
    // The path almost every form takes: no `customFields`, so `ObjectForm`
    // builds the FormField from the object schema and stashes the metadata on
    // `.field`. This assertion was RED before the producer-side fix.
    renderForm({ mobile: { fullscreenLongText: true } });

    expect(await screen.findByTestId('textarea-fullscreen-toggle')).toBeInTheDocument();
  });

  it('still reaches the widget for a HAND-AUTHORED customFields long-text field, without displacing its other metadata', async () => {
    // Control for the fix: a hand-authored `customFields` entry carries no
    // `.field` metadata object, so `field.field || field` resolves to the
    // FormField ITSELF — that is the carrier, and the flag has to land on it.
    // This chain works today and must keep working.
    //
    // The extra metadata below is what makes this a real control rather than a
    // restatement of the test above. Stamping `field: { ...f.field, flag }`
    // UNCONDITIONALLY also lights the affordance up here — by conjuring a
    // metadata object out of `undefined` that contains nothing but the flag.
    // The renderer would then forward that stub as the widget's `field`, and
    // `rows` / `placeholder` (which `TextAreaField` reads off the metadata, not
    // off its props) would silently revert to their defaults. Asserting them
    // here is what makes that shortcut fail instead of pass.
    renderForm({
      mobile: { fullscreenLongText: true },
      customFields: [
        { name: 'body', label: 'Body', type: 'field:textarea', rows: 9, placeholder: 'Say more' },
      ],
    });

    expect(await screen.findByTestId('textarea-fullscreen-toggle')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('Say more');
    expect(textarea).toHaveAttribute('rows', '9');
  });

  it('does NOT render the affordance when the form did not opt in', async () => {
    // Negative control: without `mobile.fullscreenLongText` there is no
    // producer, so no carrier may conjure the flag.
    renderForm({});

    // Wait for the textarea itself so we are asserting on a SETTLED form, not
    // on a widget that simply has not resolved yet.
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('textarea-fullscreen-toggle')).not.toBeInTheDocument();
    });
  });
});
