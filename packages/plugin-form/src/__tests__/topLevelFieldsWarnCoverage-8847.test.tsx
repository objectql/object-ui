/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8847 — MEASURES, rather than assumes, whether route 1's warning
 * (objectui#8738, `warnUnresolvedTopLevelField` in `sectionFields.ts`) reaches
 * the two surfaces #8847 named beyond `object-form` itself:
 *
 *   1. `form` / `view:form` — registered on the exact same `ObjectFormRenderer`
 *      component as `object-form` (`index.tsx`), so it is the SAME code path
 *      by construction, not merely a similar one. No render test needed to
 *      "prove" a React component warns differently depending on the string
 *      key it happens to be registered under — it cannot.
 *   2. `object-master-detail-form`'s parent `fields` — routed differently
 *      (`MasterDetailForm` builds a `parentSchema` and renders it through
 *      `<ObjectForm>`, `MasterDetailForm.tsx`), so THIS one is measured here.
 *
 * Result: route 1 covers both for free. `MasterDetailForm`'s `parentSchema`
 * carries `fields: schema.fields` straight through with no `sections`
 * (`fields` is documented as ignored once `sections` is given), so
 * `ObjectForm`'s formType routing (`ObjectForm.tsx`, the `schema.sections?.length`
 * guards on every sectioned branch) falls through to `SimpleObjectForm` — the
 * exact read site route 1 patches — regardless of the master-detail
 * `formType` ('simple' | 'tabbed'). ⇒ #8847's remaining work for both
 * surfaces is documentation only (see the `description` added in `index.tsx`).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { registerAllFields } from '@object-ui/fields';
import { MasterDetailForm } from '../MasterDetailForm';

registerAllFields();

const PARENT_SCHEMA = {
  name: 'invoice',
  fields: {
    status: { type: 'text', label: 'Status' },
    note: { type: 'text', label: 'Note' },
  },
};

function makeDataSource() {
  return {
    getObjectSchema: vi.fn().mockResolvedValue(PARENT_SCHEMA),
    find: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulk: vi.fn(),
  } as any;
}

describe('object-master-detail-form parent `fields` inherits route 1 for free (objectui#8847)', () => {
  it('warns when a parent-fields member resolves to no name — the spec FormFieldSchema object', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { container } = render(
        <MasterDetailForm
          schema={
            {
              objectName: 'invoice',
              mode: 'create',
              fields: [{ field: 'note' }], // the #8738 trap shape — legal in sections[].fields, not here
              details: [
                {
                  childObject: 'invoice_line',
                  relationshipField: 'invoice',
                  columns: [{ key: 'qty', label: 'Qty', type: 'number' } as any],
                },
              ],
            } as any
          }
          dataSource={makeDataSource()}
        />,
      );
      await waitFor(() => expect(container.querySelector('form')).toBeTruthy());
      // Filtered rather than an exact call count: this render also fires an
      // unrelated `react-i18next` "no i18next instance" warning in this test
      // harness (no I18nextProvider is mounted), which is not this pin's
      // concern.
      const said = warn.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => m.includes('top-level `fields`'));
      expect(said).toHaveLength(1);
      expect(said[0]).toContain("{ field: 'note' }");
      expect(said[0]).toContain('sections[].fields');
      // The trapped field never rendered — route 1 warns, it does not resolve.
      expect(container.querySelector('label')?.textContent ?? '').not.toContain('Note');
    } finally {
      warn.mockRestore();
    }
  });

  it('does NOT warn for a legal bare parent field name — the firing control', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { container } = render(
        <MasterDetailForm
          schema={
            {
              objectName: 'invoice',
              mode: 'create',
              fields: ['status'],
              details: [
                {
                  childObject: 'invoice_line',
                  relationshipField: 'invoice',
                  columns: [{ key: 'qty', label: 'Qty', type: 'number' } as any],
                },
              ],
            } as any
          }
          dataSource={makeDataSource()}
        />,
      );
      await waitFor(() => {
        const el = container.querySelector('input[name="status"], label');
        expect(el).toBeTruthy();
      });
      // Filtered for the same reason as the row above (unrelated i18next
      // warning fires regardless of the `fields` shape under test).
      const said = warn.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => m.includes('top-level `fields`'));
      expect(said).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });
});
