/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The selection bar's built-in **Delete** honours
 * `userActions.delete.visibleWhen` PER SELECTED RECORD (objectui#4420).
 *
 * The bar used to read that key as a bare boolean — bucket ∧ `userActions`
 * ∧ `apiOperations` ∧ the principal's `allowDelete`, all of which describe the
 * OBJECT — with no per-record layer at all. Tick only a record the predicate
 * excludes and the bar still offered the red Delete, and pressing it deleted
 * the record the author had written the predicate to protect. The row kebab
 * on the very same screen hid its Delete correctly, so one declared key meant
 * two different things on two surfaces.
 *
 * ## The ruled behaviour (maintainer, 2026-08-17 — behaviour 1 of three)
 *
 * Filter the operation and report the skipped: evaluate per record, run over
 * the allowed subset, report the excluded ones through `BulkActionDialog`'s
 * `bulk-skipped-notice` slot. Behaviour 2 (gate the button) and behaviour 3
 * (declare the key out of scope for sets) were rejected. So the button is
 * **never hidden or disabled** by the predicate, and an all-excluded selection
 * still opens the dialog — "a legible refusal, not a hidden button whose
 * absence is unexplained".
 *
 * ## The fixture, and which row is the excluded one
 *
 * The card's repro verbatim: `showcase_invoice` declares
 * `delete: { visibleWhen: "record.status != 'paid'" }`. **`INV-1011` is the
 * excluded row** — it is the one with `status: 'paid'`, and it is the row
 * every assertion below is really about. The all-eligible case is a deliberate
 * DEGENERATE CONTROL: its fixture has no excluded row, so it passes against
 * the unfixed code too. That is what it is for — it pins the untouched path,
 * and it is the mixed / none-eligible cases that carry the regression.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

vi.mock('@object-ui/permissions', () => ({
  usePermissions: () => ({
    isLoaded: false,
    checkField: () => true,
    getObjectApiOperations: () => undefined,
    can: () => true,
  }),
}));

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';

registerAllFields();

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn() as any;
  }
});

const OBJECT = 'showcase_invoice';

/** `INV-1011` is paid — the row `visibleWhen` excludes. */
const PAID = { id: 'inv-1011', name: 'INV-1011', status: 'paid' };
/** `INV-1010` is a draft — the row `visibleWhen` admits. */
const DRAFT = { id: 'inv-1010', name: 'INV-1010', status: 'draft' };

/**
 * The object's declared per-record delete gate, in the OBJECT `userActions`
 * vocabulary (`{ enabled?, visibleWhen?, disabledWhen? }`, objectui#2614) — not
 * the VIEW's same-named toolbar block.
 */
const DELETE_VISIBLE_WHEN = { visibleWhen: "record.status != 'paid'" };

interface Harness {
  onBulkDelete: ReturnType<typeof vi.fn>;
  dataSource: any;
}

function renderGrid(opts: {
  rows: Array<Record<string, unknown>>;
  /** Omit to declare NO per-record gate — the ungated control. */
  userActionsDelete?: unknown;
}): Harness {
  const onBulkDelete = vi.fn();
  const dataSource: any = {
    find: vi.fn(async () => ({
      data: opts.rows.map(r => ({ ...r })),
      total: opts.rows.length,
      hasMore: false,
      pageSize: 50,
    })),
    delete: vi.fn(async () => ({ success: true })),
    update: vi.fn(async () => ({ success: true })),
    getObjectSchema: async (name: string) => ({
      name,
      fields: {
        id: { type: 'text' },
        name: { type: 'text', label: 'Number' },
        status: { type: 'text', label: 'Status' },
      },
      ...(opts.userActionsDelete === undefined
        ? {}
        : { userActions: { delete: opts.userActionsDelete } }),
    }),
  };
  render(
    <ObjectGrid
      schema={{
        type: 'object-grid',
        objectName: OBJECT,
        columns: [{ field: 'name', label: 'Number' }],
        pagination: { pageSize: 50 },
        operations: { delete: true },
      } as any}
      dataSource={dataSource}
      // Both handlers wired: `onDelete` is the row kebab's, `onBulkDelete` the
      // bar's. They are separate callbacks on purpose — the bulk gate must not
      // be judged by whether the ROW handler happens to be present.
      onDelete={() => {}}
      onBulkDelete={onBulkDelete}
    />,
  );
  return { onBulkDelete, dataSource };
}

/** Every `role="checkbox"` on screen; index 0 is the header's select-all. */
function checkboxes(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role="checkbox"]')) as HTMLElement[];
}

/** Render, wait for rows AND the async object-schema fetch, then tick rows. */
async function renderAndSelect(
  opts: Parameters<typeof renderGrid>[0] & { selectRowNames: string[] },
): Promise<Harness> {
  const harness = renderGrid(opts);
  for (const row of opts.rows) {
    await waitFor(() => expect(screen.getByText(String(row.name))).toBeInTheDocument());
  }
  // The delete affordance is derived from `getObjectSchema`, so an assertion
  // taken before it lands would read the pre-fetch (underived) state.
  await waitFor(() => expect(checkboxes().length).toBeGreaterThan(opts.rows.length));
  const all = checkboxes();
  for (const name of opts.selectRowNames) {
    const index = opts.rows.findIndex(r => r.name === name);
    // +1 skips the header select-all checkbox.
    fireEvent.click(all[index + 1]);
  }
  return harness;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('selection-bar Delete vs `userActions.delete.visibleWhen` (objectui#4420)', () => {
  it('ALL-ELIGIBLE: deletes the whole selection through the host handler — the degenerate control', async () => {
    // No excluded row in this fixture, so this case passes against the unfixed
    // code as well. It is here to pin that an all-eligible selection keeps the
    // consumer's own delete flow (confirm + toast + refresh) untouched.
    const { onBulkDelete, dataSource } = await renderAndSelect({
      rows: [DRAFT, { id: 'inv-1012', name: 'INV-1012', status: 'draft' }],
      userActionsDelete: DELETE_VISIBLE_WHEN,
      selectRowNames: ['INV-1010', 'INV-1012'],
    });

    fireEvent.click(await screen.findByTestId('bulk-action-delete'));

    await waitFor(() => expect(onBulkDelete).toHaveBeenCalledTimes(1));
    expect(onBulkDelete.mock.calls[0][0].map((r: any) => r.id)).toEqual(['inv-1010', 'inv-1012']);
    // Nothing was excluded, so nothing to report: no dialog interposes.
    expect(screen.queryByTestId('bulk-skipped-notice')).not.toBeInTheDocument();
    expect(dataSource.delete).not.toHaveBeenCalled();
  });

  it('MIXED: deletes only the allowed subset AND reports the skipped row', async () => {
    const { onBulkDelete, dataSource } = await renderAndSelect({
      rows: [DRAFT, PAID],
      userActionsDelete: DELETE_VISIBLE_WHEN,
      selectRowNames: ['INV-1010', 'INV-1011'],
    });

    fireEvent.click(await screen.findByTestId('bulk-action-delete'));

    // Half one — the excluded row is REPORTED, through the slot built for this
    // shape rather than by silently shrinking the count.
    expect(await screen.findByTestId('bulk-skipped-notice')).toBeInTheDocument();
    // The dialog previews what it will actually act on: the draft, not the
    // paid invoice.
    expect(screen.getByText('• INV-1010')).toBeInTheDocument();
    expect(screen.queryByText('• INV-1011')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Run' }));

    // Half two — the allowed subset was deleted, and ONLY it. `INV-1011` is
    // the row the predicate excludes; before this fix it was deleted too.
    await waitFor(() => expect(dataSource.delete).toHaveBeenCalledTimes(1));
    expect(dataSource.delete).toHaveBeenCalledWith(OBJECT, 'inv-1010');
    expect(dataSource.delete).not.toHaveBeenCalledWith(OBJECT, 'inv-1011');
    // The host's whole-selection handler is not the executor on this path —
    // routing back through it would confirm the same delete twice.
    expect(onBulkDelete).not.toHaveBeenCalled();
  });

  it('NONE-ELIGIBLE: the button still renders, and leads to a dialog that refuses', async () => {
    const { onBulkDelete, dataSource } = await renderAndSelect({
      rows: [DRAFT, PAID],
      userActionsDelete: DELETE_VISIBLE_WHEN,
      // The card's repro exactly: tick ONLY the paid invoice.
      selectRowNames: ['INV-1011'],
    });

    // Ruled: never hidden, never disabled by the predicate.
    const button = await screen.findByTestId('bulk-action-delete');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    // …and the refusal is legible: the dialog opens, says what it skipped, and
    // declines to run over zero records.
    expect(await screen.findByTestId('bulk-skipped-notice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(dataSource.delete).not.toHaveBeenCalled();
    expect(onBulkDelete).not.toHaveBeenCalled();
  });

  it('an object declaring NO per-record gate keeps the whole selection', async () => {
    // Control group for the fold itself: with no `visibleWhen` the partition is
    // a no-op, so the paid invoice is deleted like any other row. This is what
    // makes the exclusions above attributable to the predicate rather than to
    // some new blanket filter.
    const { onBulkDelete } = await renderAndSelect({
      rows: [DRAFT, PAID],
      selectRowNames: ['INV-1010', 'INV-1011'],
    });

    fireEvent.click(await screen.findByTestId('bulk-action-delete'));

    await waitFor(() => expect(onBulkDelete).toHaveBeenCalledTimes(1));
    expect(onBulkDelete.mock.calls[0][0].map((r: any) => r.id)).toEqual(['inv-1010', 'inv-1011']);
    expect(screen.queryByTestId('bulk-skipped-notice')).not.toBeInTheDocument();
  });
});
