/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `object-grid.bulkActions` and `object-grid.bulkActionDefs` — the MEMBER
 * shapes this renderer reads (objectui#8071, criterion from objectui#8068).
 *
 * Both keys are declared `type: 'array'` with no `of`, and both spec rows are
 * `z.array(z.unknown())`: every coarse member kind parses on both declared
 * sides, so the read site is the whole member contract. And these two are the
 * pair where that matters most, because they are ONE affordance authored in TWO
 * vocabularies that land in the same selection bar:
 *
 *   - `bulkActions` members are BARE ACTION NAMES. `ObjectGrid.tsx` hands them
 *     to `resolveBulkActions`, which resolves each against `objectDef.actions`
 *     and PROMOTES the match to a full def — so a promoted button carries the
 *     object action's own label, icon and gates. A member that is not a string
 *     is skipped outright (`if (typeof name !== 'string') continue`).
 *   - `bulkActionDefs` members are FULL `BulkActionDef` OBJECTS, left as
 *     authored and never resolved against the object's action set.
 *
 * ⚠️ THE HAZARD, and why the negatives below are the load-bearing half. This is
 * the `page:header.actions` shape (objectui#6252 / objectstack#11592) with a
 * second key beside it: an author who writes the DEF vocabulary into
 * `bulkActions`, or a bare NAME into `bulkActionDefs`, is refused by nothing —
 * not the registration, not the spec, not `tsc` on a JSON view — and gets
 * silence at runtime rather than a diagnostic. Rows 2 and 4 are what keep that
 * silence from becoming an accepted second dialect (AGENTS.md #0.1), and what
 * would red if either read site started coercing.
 *
 * ⛔ NOT a restatement of the declaration. The registration's prose ("Names of
 * actions offered once rows are selected" / "Full inline bulk-action
 * definitions") is the CLAIM; every row here is a render that would change if
 * the read site stopped honouring it. The unit-level resolution is covered by
 * `resolveBulkActions.test.ts`; this file is the block-level half — the same
 * facts observed through the registered `object-grid` renderer, which is the
 * surface an author actually writes against.
 *
 * `selection` is declared explicitly on every row so the ONLY variable between
 * them is the member shape. Left implicit, the grid auto-enables multi-select
 * from `hasBulkActions`, which is itself derived from these two keys — so a
 * negative row would lose its selection UI for the very reason under test and
 * pass without ever reaching the bar.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn() as any;
  }
});

const OBJECT = 'os_invoice';

/**
 * The object declares ONE action, `approve`, with a label that is NOT the
 * humanized form of its name. That gap is the instrument: a button reading
 * "Approve the invoice" can only have come from resolving the member as a NAME
 * against `objectDef.actions`; a renderer that treated the member as a display
 * string would show "Approve".
 */
const OBJECT_ACTIONS = [
  { name: 'approve', label: 'Approve the invoice', variant: 'primary' },
];

function makeDataSource() {
  const rows = [
    { id: 'r1', name: 'INV-1', status: 'draft' },
    { id: 'r2', name: 'INV-2', status: 'draft' },
  ];
  return {
    find: vi.fn(async () => ({
      data: rows.map((r) => ({ ...r })),
      total: rows.length,
      hasMore: false,
      pageSize: 50,
    })),
    getObjectSchema: async (name: string) => ({
      name,
      fields: { id: { type: 'text' }, name: { type: 'text' }, status: { type: 'text' } },
      actions: OBJECT_ACTIONS,
    }),
  } as any;
}

async function renderAndSelectAll(schema: Record<string, unknown>) {
  render(
    <ActionProvider handlers={{}}>
      <ObjectGrid
        schema={
          {
            type: 'object-grid',
            objectName: OBJECT,
            columns: [{ field: 'name', label: 'Name' }],
            pagination: { pageSize: 50 },
            selection: { type: 'multiple' },
            ...schema,
          } as any
        }
        dataSource={makeDataSource()}
      />
    </ActionProvider>,
  );
  await waitFor(() => expect(screen.getByText('INV-1')).toBeInTheDocument());
  const headerCheckbox = document.querySelector('thead [role="checkbox"]') as HTMLElement;
  expect(headerCheckbox, 'the multi-select header checkbox').toBeTruthy();
  fireEvent.click(headerCheckbox);
  await waitFor(() => expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument());
}

describe('object-grid `bulkActions` members are BARE ACTION NAMES (objectui#8071)', () => {
  it('1. a name member is resolved against `objectDef.actions` and promoted', async () => {
    await renderAndSelectAll({ bulkActions: ['approve'] });
    const button = await screen.findByTestId('bulk-action-approve');
    // The object action's OWN label, not `formatActionLabel('approve')`.
    expect(button).toHaveTextContent('Approve the invoice');
  });

  it('2. an object member is NOT this key\'s shape — skipped, and in silence', async () => {
    // The `page:header.actions` hole, checked on this key: `{ name }` is what
    // an author transplanting the def vocabulary would write, and
    // `resolveBulkActions` steps over any non-string member. Nothing reports it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await renderAndSelectAll({ bulkActions: [{ name: 'approve' }] });
      expect(screen.queryByTestId('bulk-action-approve')).not.toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('3. a name matching no declared action still reaches the bar, by name', async () => {
    // Not a hole: `resolveBulkActions` keeps unresolved names so a consumer's
    // `runner.registerHandler('<name>', …)` stays reachable. Pinned because it
    // is the one case where the member is read as a name AND stays one — which
    // is what makes row 1's promotion an observable event rather than the only
    // path a string could take.
    await renderAndSelectAll({ bulkActions: ['no_such_action'] });
    expect(await screen.findByTestId('bulk-action-no_such_action')).toHaveTextContent(
      'No Such Action',
    );
  });
});

describe('object-grid `bulkActionDefs` members are FULL DEFS (objectui#8071)', () => {
  it('4. a def member renders as authored, without resolving against the object', async () => {
    // `archive` is declared by NO object action, and the button still carries
    // the authored label: the def was read as-is, not resolved.
    await renderAndSelectAll({
      bulkActionDefs: [{ name: 'archive', operation: 'custom', label: 'Put it away' }],
    });
    expect(await screen.findByTestId('bulk-action-archive')).toHaveTextContent('Put it away');
  });

  it('5. a bare-name member is NOT this key\'s shape — it TAKES THE BAR DOWN', async () => {
    // The mirror of row 2, and the sharper of the pair: the two vocabularies do
    // not swap, and this direction does not fail quietly. A string member has
    // no `name`, reaches `BulkActionBar` as a def with no identity, and
    // `formatActionLabel(undefined)` throws `TypeError: Cannot read properties
    // of undefined (reading 'replace')` DURING RENDER — so the whole selection
    // bar unmounts on the author's first multi-row selection.
    //
    // ⚠️ Pinned as the CURRENT behaviour, not as the contract: this is a defect
    // (objectui#8730), filed from this row. It is asserted rather than left out
    // so that the crash cannot be mistaken for the silence of row 2, and so
    // that landing the fix REDS this row and forces it to be rewritten to the
    // corrected behaviour instead of quietly describing nothing.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(renderAndSelectAll({ bulkActionDefs: ['approve'] })).rejects.toThrow(
        /Cannot read properties of undefined \(reading 'replace'\)/,
      );
    } finally {
      error.mockRestore();
    }
  });

  it('6. both keys reach ONE bar, authored defs first, and neither shadows the other', async () => {
    await renderAndSelectAll({
      bulkActions: ['approve'],
      bulkActionDefs: [{ name: 'archive', operation: 'custom', label: 'Put it away' }],
    });
    const bar = screen.getByTestId('bulk-actions-bar');
    const ids = Array.from(bar.querySelectorAll('[data-testid^="bulk-action-"]')).map((n) =>
      n.getAttribute('data-testid'),
    );
    expect(ids).toEqual(['bulk-action-archive', 'bulk-action-approve']);
  });
});
