/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    // Canonical OWD options are all offered (scoped to the internal dial —
    // the external D11 dial offers the same set).
    const internal = within(screen.getByTestId('owd-internal-select'));
    expect(internal.getByRole('option', { name: 'Private — owner only' })).toBeTruthy();
    expect(
      internal.getByRole('option', { name: 'Public read — everyone reads, only the owner writes' }),
    ).toBeTruthy();
    expect(
      internal.getByRole('option', { name: 'Public read/write — everyone reads and writes' }),
    ).toBeTruthy();
    expect(
      internal.getByRole('option', { name: 'Controlled by parent — inherited from the master record' }),
    ).toBeTruthy();
  });

  it('explains that an unset sharing model defaults to private (ADR-0090 D1)', () => {
    renderPanel(baseDraft);
    expect(
      screen.getByText(/defaults to Private \(ADR-0090\)/i),
    ).toBeTruthy();
  });

  it('patches sharingModel when a model is picked', () => {
    const onPatch = renderPanel(baseDraft);
    const select = screen.getByTestId('owd-internal-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'private' } });
    expect(onPatch).toHaveBeenCalledWith({ sharingModel: 'private' });
  });

  it('clears sharingModel back to unset', () => {
    const onPatch = renderPanel({ ...baseDraft, sharingModel: 'private' });
    const select = screen.getByDisplayValue('Private — owner only') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(onPatch).toHaveBeenCalledWith({ sharingModel: undefined });
  });
});

describe('ObjectSettingsPanel — external OWD dial (ADR-0090 D11)', () => {
  it('renders the external dial defaulting to unset and patches externalSharingModel', () => {
    const onPatch = renderPanel(baseDraft);
    const select = screen.getByTestId('owd-external-select') as HTMLSelectElement;
    expect(select.value).toBe('');
    fireEvent.change(select, { target: { value: 'public_read' } });
    expect(onPatch).toHaveBeenCalledWith({ externalSharingModel: 'public_read' });
  });

  it('clears externalSharingModel back to unset', () => {
    const onPatch = renderPanel({ ...baseDraft, externalSharingModel: 'private' });
    const select = screen.getByTestId('owd-external-select') as HTMLSelectElement;
    expect(select.value).toBe('private');
    fireEvent.change(select, { target: { value: '' } });
    expect(onPatch).toHaveBeenCalledWith({ externalSharingModel: undefined });
  });

  it('warns when the external baseline is wider than the internal one', () => {
    renderPanel({ ...baseDraft, sharingModel: 'public_read', externalSharingModel: 'public_read_write' });
    expect(screen.getByTestId('owd-external-desc').textContent).toMatch(/WIDER/);
  });

  it('stays calm when external ≤ internal', () => {
    renderPanel({ ...baseDraft, sharingModel: 'public_read', externalSharingModel: 'private' });
    expect(screen.getByTestId('owd-external-desc').textContent).not.toMatch(/WIDER/);
  });
});
