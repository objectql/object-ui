/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ObjectSettingsPanel } from './ObjectSettingsPanel';

const baseDraft = {
  fields: {
    name: { type: 'text', label: 'Name' },
    status: { type: 'select', label: 'Status' },
  },
};

function renderPanel(draft: Record<string, unknown>, onPatch = vi.fn()) {
  render(
    <ObjectSettingsPanel name="leave_request" draft={draft} onPatch={onPatch} locale="en-US" />,
  );
  return onPatch;
}

describe('ObjectSettingsPanel — record sharing (OWD)', () => {
  it('exposes the sharing model control with the four canonical OWD options', () => {
    renderPanel(baseDraft);
    // The section header is present.
    expect(screen.getByText('Record sharing (OWD)')).toBeTruthy();
    // Canonical OWD options are all offered.
    expect(screen.getByRole('option', { name: 'Private — owner only' })).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'Public read — everyone reads, only the owner writes' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'Public read/write — everyone reads and writes' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('option', { name: 'Controlled by parent — inherited from the master record' }),
    ).toBeTruthy();
  });

  it('warns that an unset sharing model means fully public records', () => {
    renderPanel(baseDraft);
    expect(
      screen.getByText(/records are fully public/i),
    ).toBeTruthy();
  });

  it('patches sharingModel when a model is picked', () => {
    const onPatch = renderPanel(baseDraft);
    const select = screen.getByDisplayValue('(not set)') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'private' } });
    expect(onPatch).toHaveBeenCalledWith({ sharingModel: 'private' });
  });

  it('clears sharingModel back to unset', () => {
    const onPatch = renderPanel({ ...baseDraft, sharingModel: 'private' });
    const select = screen.getByDisplayValue('Private — owner only') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(onPatch).toHaveBeenCalledWith({ sharingModel: undefined });
  });

  it('normalises legacy aliases (read → public_read) for display', () => {
    renderPanel({ ...baseDraft, sharingModel: 'read' });
    const select = screen.getByDisplayValue(
      'Public read — everyone reads, only the owner writes',
    ) as HTMLSelectElement;
    expect(select.value).toBe('public_read');
  });
});
