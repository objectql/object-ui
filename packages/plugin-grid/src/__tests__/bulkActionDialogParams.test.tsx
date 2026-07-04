/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * BulkActionDialog param widgets (#2185): the bulk-edit dialog previously only
 * rendered single-value controls, so a multi-value backend field (e.g. a
 * multi-user `executors`) could not be set — the picker collapsed to one value
 * and overwrote the array. These tests pin the multi-select path end-to-end
 * (empty-array required-gating → pick many → array patch → label preview) plus
 * the new date widget.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { BulkActionDialog } from '../components/BulkActionDialog';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn() as any;
  }
  // Radix Popover/cmdk probe pointer capture APIs that jsdom lacks.
  if (!(Element.prototype as any).hasPointerCapture) {
    (Element.prototype as any).hasPointerCapture = () => false;
  }
  if (!(Element.prototype as any).setPointerCapture) {
    (Element.prototype as any).setPointerCapture = () => {};
  }
});

function makeDataSource() {
  const update = vi.fn(async () => ({}));
  const del = vi.fn(async () => ({}));
  return { update, delete: del } as any;
}

describe('BulkActionDialog — multi-select param produces an array patch', () => {
  it('gates required until a value is picked, sends an array, and previews labels', async () => {
    const ds = makeDataSource();
    const def: any = {
      name: 'set_tags',
      label: 'Set tags',
      operation: 'update',
      params: [
        {
          name: 'tags',
          label: 'Tags',
          type: 'select',
          multiple: true,
          required: true,
          options: [
            { label: 'Red', value: 'red' },
            { label: 'Blue', value: 'blue' },
          ],
        },
      ],
    };
    render(
      <BulkActionDialog
        def={def}
        rows={[{ id: 'r1' }, { id: 'r2' }]}
        resource="thing"
        dataSource={ds}
        open
        onClose={() => {}}
      />,
    );

    // Required multi-select with no selection → Next is disabled (empty array
    // must count as "not filled").
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();

    // Open the multi-select popover and pick both options.
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Red'));
    fireEvent.click(await screen.findByText('Blue'));

    // Now valid → advance to confirm.
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);

    // Confirm step shows the human labels (not the raw ids) for the array value.
    const confirmRun = await screen.findByRole('button', { name: 'Run' });
    expect(screen.getByText(/Red, Blue/)).toBeInTheDocument();

    fireEvent.click(confirmRun);

    // Per-row update fires with the multi-value array intact.
    await waitFor(() => expect(ds.update).toHaveBeenCalledTimes(2));
    expect(ds.update).toHaveBeenCalledWith('thing', 'r1', { tags: ['red', 'blue'] });
    expect(ds.update).toHaveBeenCalledWith('thing', 'r2', { tags: ['red', 'blue'] });
  });
});

describe('BulkActionDialog — date param renders a date picker', () => {
  it('renders a native date input rather than a free-text box', () => {
    const ds = makeDataSource();
    const def: any = {
      name: 'set_due',
      label: 'Set due date',
      operation: 'update',
      params: [{ name: 'due', label: 'Due', type: 'date' }],
    };
    render(
      <BulkActionDialog
        def={def}
        rows={[{ id: 'r1' }]}
        resource="thing"
        dataSource={ds}
        open
        onClose={() => {}}
      />,
    );
    // Radix Dialog portals its content to document.body, not the render root.
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
  });
});
