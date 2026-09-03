// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * A static lookup option's `description` is SEARCHED by the popover typeahead
 * (objectui#6153, instance 2).
 *
 * The behaviour predates the card — `filteredOptions` has always matched
 * `opt.description` alongside the label, and `recordToOption` emits the same
 * key for fetched records. What the card changed is the CONTRACT:
 * `SelectOptionMetadata` (the declared type of `LookupFieldMetadata.options`)
 * now declares `description?: string` as an objectui-side extension - the
 * installed `@objectstack/spec` 17.2.0 has no such key and REFUSES it BY NAME
 * on `SelectOptionSchema` (objectui#7014) - so the fixture below is an ANNOTATED
 * literal — the excess-property check that used to refuse this exact document
 * is the compile half of the pin, and the search behaviour is the runtime
 * half. Behaviour unchanged by design; the test would have passed before the
 * declaration only with the literal laundered through a cast.
 */

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import type { LookupFieldMetadata } from '@object-ui/types';
import { LookupField } from './LookupField';

afterEach(cleanup);

const priorityField: LookupFieldMetadata = {
  type: 'lookup',
  name: 'priority',
  label: 'Priority',
  reference_to: 'priorities',
  options: [
    { label: 'High', value: 'high', description: 'Blocks the release' },
    { label: 'Normal', value: 'normal' },
  ],
};

describe('LookupField — static option `description` search (#6153)', () => {
  it('offers an option whose DESCRIPTION matches the query, and drops the rest', async () => {
    render(<LookupField value={undefined} onChange={vi.fn()} field={priorityField as never} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /select/i }));
    });

    // Both static options offered before any query.
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();

    // 'blocks' matches neither LABEL — only High's description.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'blocks' } });

    await waitFor(() => {
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.queryByText('Normal')).not.toBeInTheDocument();
    });
  });

  it('still matches on the label — description WIDENS the search, never replaces it', async () => {
    render(<LookupField value={undefined} onChange={vi.fn()} field={priorityField as never} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /select/i }));
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'normal' } });

    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.queryByText('High')).not.toBeInTheDocument();
    });
  });
});
