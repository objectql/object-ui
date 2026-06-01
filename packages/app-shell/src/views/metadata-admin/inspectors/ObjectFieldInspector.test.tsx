// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// The inspector loads the object list for the lookup picker; stub it.
vi.mock('../useMetadata', () => ({
  useMetadataClient: () => ({ list: vi.fn().mockResolvedValue([]) }),
}));

import { ObjectFieldInspector } from './ObjectFieldInspector';

afterEach(cleanup);

function renderField(
  fields: Record<string, Record<string, unknown>>,
  selectedId: string,
  overrides: Record<string, unknown> = {},
) {
  const onPatch = vi.fn();
  const onSelectionChange = vi.fn();
  const utils = render(
    <ObjectFieldInspector
      type="object"
      name="account"
      draft={{ name: 'account', fields }}
      selection={{ kind: 'field', id: selectedId }}
      onPatch={onPatch}
      onClearSelection={vi.fn()}
      onSelectionChange={onSelectionChange}
      readOnly={false}
      locale={'en-US'}
      {...overrides}
    />,
  );
  return { onPatch, onSelectionChange, ...utils };
}

function controlFor(label: string): HTMLElement {
  const lab = screen.getByText(label);
  return lab.parentElement!.querySelector('input, textarea, select, [role="combobox"]') as HTMLElement;
}

describe('ObjectFieldInspector — duplicate field', () => {
  it('clones the field below itself with a unique name and selects it', () => {
    const { onPatch, onSelectionChange } = renderField(
      { email: { type: 'email', label: 'Email' } },
      'email',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate field' }));
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(Object.keys(patch.fields)).toEqual(['email', 'email_copy']);
    expect(patch.fields.email_copy).toMatchObject({ type: 'email', label: 'Email copy' });
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'field', id: 'email_copy' }),
    );
  });

  it('avoids name collisions when a copy already exists', () => {
    const { onPatch } = renderField(
      { email: { type: 'email' }, email_copy: { type: 'email' } },
      'email',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate field' }));
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(Object.keys(patch.fields)).toContain('email_copy_2');
  });
});

describe('ObjectFieldInspector — default value', () => {
  it('commits a text default for a text field', () => {
    const { onPatch } = renderField({ note: { type: 'text', label: 'Note' } }, 'note');
    fireEvent.change(controlFor('Default value'), { target: { value: 'hello' } });
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ fields: expect.anything() }),
    );
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(patch.fields.note.defaultValue).toBe('hello');
  });

  it('offers a select (not a text box) default for a boolean field', () => {
    renderField({ active: { type: 'boolean', label: 'Active' } }, 'active');
    expect(screen.getByText('Default value')).toBeInTheDocument();
    // Boolean default uses a tri-state Select (— / True / False), so the
    // control is a combobox rather than a free-text input.
    const ctrl = controlFor('Default value');
    expect(ctrl.getAttribute('role')).toBe('combobox');
  });

  it('omits the default-value editor for computed fields', () => {
    renderField({ total: { type: 'formula', label: 'Total' } }, 'total');
    expect(screen.queryByText('Default value')).not.toBeInTheDocument();
  });

  it('omits the default-value editor for lookup fields', () => {
    renderField({ owner: { type: 'lookup', label: 'Owner' } }, 'owner');
    expect(screen.queryByText('Default value')).not.toBeInTheDocument();
  });
});

describe('ObjectFieldInspector — read-only', () => {
  it('hides the duplicate action when read-only', () => {
    renderField({ email: { type: 'email' } }, 'email', { readOnly: true });
    expect(screen.queryByRole('button', { name: 'Duplicate field' })).not.toBeInTheDocument();
  });
});
