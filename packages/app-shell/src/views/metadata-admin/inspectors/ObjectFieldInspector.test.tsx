// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// The inspector loads the object list (published + drafts) for the lookup
// picker; stub both surfaces.
vi.mock('../useMetadata', () => ({
  useMetadataClient: () => ({
    list: vi.fn().mockResolvedValue([]),
    listDrafts: vi.fn().mockResolvedValue([]),
  }),
}));

// Lookup picker config reads the referenced object's fields; stub the catalog.
vi.mock('../previews/useObjectFields', () => ({
  useObjectFields: (obj?: string) => ({
    fields: obj
      ? [
          { name: 'name', label: 'Name', type: 'text', hidden: false },
          { name: 'status', label: 'Status', type: 'select', hidden: false },
        ]
      : [],
    loading: false,
    error: null,
  }),
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

describe('ObjectFieldInspector — label derives API name until customised', () => {
  it('syncs field_<N> (the nextFieldName() auto-name) to the label live, per keystroke', () => {
    const { onPatch, onSelectionChange } = renderField(
      { field_2: { type: 'text', label: '' } },
      'field_2',
    );
    fireEvent.change(controlFor('Label'), { target: { value: 'Status' } });
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(Object.keys(patch.fields)).toEqual(['status']);
    expect(patch.fields.status).toMatchObject({ label: 'Status' });
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'field', id: 'status' }),
    );
  });

  it('stops deriving once the API name has been hand-edited', () => {
    // Simulate the real parent, which feeds each onPatch back into `draft` —
    // a single static-props render (like the other cases here) can't observe
    // this, since the second edit needs the FIRST edit's rename reflected in
    // `entry.name` before it decides whether the name is still auto-generated.
    function Stateful() {
      const [fields, setFields] = React.useState<Record<string, Record<string, unknown>>>({
        field_2: { type: 'text', label: '' },
      });
      return (
        <ObjectFieldInspector
          type="object"
          name="account"
          draft={{ name: 'account', fields }}
          selection={{ kind: 'field', id: Object.keys(fields)[0] }}
          onPatch={(patch: any) => setFields(patch.fields)}
          onClearSelection={() => {}}
          onSelectionChange={() => {}}
          readOnly={false}
          locale={'en-US'}
        />
      );
    }
    render(<Stateful />);
    fireEvent.change(controlFor('API name'), { target: { value: 'ticket_status' } });
    fireEvent.change(controlFor('Label'), { target: { value: 'Status' } });
    expect(controlFor('API name')).toHaveValue('ticket_status');
  });

  it('leaves an already-meaningful name untouched when the label changes', () => {
    const { onPatch } = renderField({ priority: { type: 'text', label: 'Priority' } }, 'priority');
    fireEvent.change(controlFor('Label'), { target: { value: 'Urgency' } });
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(Object.keys(patch.fields)).toEqual(['priority']);
    expect(patch.fields.priority.label).toBe('Urgency');
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

describe('ObjectFieldInspector — power props (conditional & validation)', () => {
  it('commits inline help text', () => {
    const { onPatch } = renderField({ note: { type: 'text', label: 'Note' } }, 'note');
    fireEvent.change(controlFor('Help text'), { target: { value: 'Enter the note' } });
    expect(onPatch.mock.calls.at(-1)![0].fields.note.inlineHelpText).toBe('Enter the note');
  });

  it('commits min length for text fields (alongside max length)', () => {
    const { onPatch } = renderField({ note: { type: 'text' } }, 'note');
    expect(screen.getByText('Min length')).toBeInTheDocument();
    expect(screen.getByText('Max length')).toBeInTheDocument();
    fireEvent.change(controlFor('Min length'), { target: { value: '3' } });
    expect(onPatch.mock.calls.at(-1)![0].fields.note.minLength).toBe(3);
  });

  it('commits a conditional-required CEL predicate', () => {
    const { onPatch } = renderField({ note: { type: 'text' } }, 'note');
    fireEvent.change(controlFor('Required when (CEL)'), { target: { value: 'record.x == 1' } });
    expect(onPatch.mock.calls.at(-1)![0].fields.note.conditionalRequired).toBe('record.x == 1');
  });

  it('offers conditional-required for non-text types too', () => {
    renderField({ active: { type: 'boolean' } }, 'active');
    expect(screen.getByText('Required when (CEL)')).toBeInTheDocument();
    // Min length is text-only, so it should not show for a boolean.
    expect(screen.queryByText('Min length')).not.toBeInTheDocument();
  });
});

describe('ObjectFieldInspector — read-only', () => {
  it('hides the duplicate action when read-only', () => {
    renderField({ email: { type: 'email' } }, 'email', { readOnly: true });
    expect(screen.queryByRole('button', { name: 'Duplicate field' })).not.toBeInTheDocument();
  });

  it('disables the power-prop inputs when read-only', () => {
    renderField({ note: { type: 'text' } }, 'note', { readOnly: true });
    expect(controlFor('Help text')).toBeDisabled();
    expect(controlFor('Required when (CEL)')).toBeDisabled();
  });
});

describe('ObjectFieldInspector — lookup picker config', () => {
  const lookupFields = {
    account: { type: 'lookup', label: 'Account', reference: 'crm_account' },
    name: { type: 'text' },
  };

  it('surfaces displayField / selectable-records / depends-on for a lookup field', () => {
    renderField(lookupFields, 'account');
    expect(screen.getByText('Picker config')).toBeInTheDocument();
    expect(screen.getByText('Display field')).toBeInTheDocument();
    expect(screen.getByText('Description field')).toBeInTheDocument();
    expect(screen.getByText('Selectable records')).toBeInTheDocument();
    expect(screen.getByText(/Depends on/)).toBeInTheDocument();
    expect(screen.getByText('Allow quick-create')).toBeInTheDocument();
  });

  it('does NOT render picker config for a non-lookup field', () => {
    renderField({ amount: { type: 'number' } }, 'amount');
    expect(screen.queryByText('Picker config')).not.toBeInTheDocument();
  });

  it('adds a structured lookupFilters row via onPatch', () => {
    const { onPatch } = renderField(lookupFields, 'account');
    fireEvent.click(screen.getByText('Add filter'));
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(patch.fields.account.lookupFilters).toEqual([{ field: '', operator: 'eq', value: '' }]);
  });

  it('reads an existing structured filter and renders its row', () => {
    renderField(
      { account: { type: 'lookup', reference: 'crm_account', lookupFilters: [{ field: 'status', operator: 'eq', value: 'active' }] } },
      'account',
    );
    expect(screen.getByText('Filter 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('active')).toBeInTheDocument();
  });
});

describe('ObjectFieldInspector — API name derives from label while auto-named', () => {
  it('derives from a generic field_N auto name (Data pillar "+ Add field")', () => {
    const { onPatch, onSelectionChange } = renderField(
      { field_2: { type: 'text', label: 'New field' } },
      'field_2',
    );
    fireEvent.change(screen.getByTestId('field-label-input'), { target: { value: 'Status' } });
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(Object.keys(patch.fields)).toContain('status');
    expect(Object.keys(patch.fields)).not.toContain('field_2');
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'field', id: 'status' }),
    );
  });

  it('derives from a type-based auto name (canvas add)', () => {
    const { onPatch } = renderField(
      { text_2: { type: 'text', label: 'New field' }, name: { type: 'text' } },
      'text_2',
    );
    fireEvent.change(screen.getByTestId('field-label-input'), { target: { value: 'Serial No' } });
    const patch = onPatch.mock.calls.at(-1)![0];
    expect(Object.keys(patch.fields)).toContain('serial_no');
    expect(Object.keys(patch.fields)).not.toContain('text_2');
  });

  it('does NOT rename once the user customised the API name', () => {
    const { onPatch } = renderField(
      { my_field: { type: 'text', label: 'New field' } },
      'my_field',
    );
    fireEvent.change(screen.getByTestId('field-label-input'), { target: { value: 'Status' } });
    const renamed = onPatch.mock.calls.some((c) => Object.keys(c[0].fields ?? {}).includes('status'));
    expect(renamed).toBe(false);
  });

  it('keeps the unique auto name for a CJK-only label (slugify yields nothing)', () => {
    const { onPatch } = renderField(
      { field_2: { type: 'text', label: 'New field' } },
      'field_2',
    );
    fireEvent.change(screen.getByTestId('field-label-input'), { target: { value: '状态' } });
    const renamed = onPatch.mock.calls.some((c) => !Object.keys(c[0].fields ?? {}).includes('field_2'));
    expect(renamed).toBe(false);
  });

  it('does not steal an existing sibling name on collision', () => {
    const { onPatch } = renderField(
      { status: { type: 'select' }, field_2: { type: 'text', label: 'New field' } },
      'field_2',
    );
    fireEvent.change(screen.getByTestId('field-label-input'), { target: { value: 'Status' } });
    const stolen = onPatch.mock.calls.some((c) => !Object.keys(c[0].fields ?? {}).includes('field_2'));
    expect(stolen).toBe(false);
  });
});
