// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ObjectDefaultInspector } from './ObjectDefaultInspector';

afterEach(cleanup);

const baseProps = {
  type: 'object',
  onSelectionChange: vi.fn(),
  locale: 'en-US' as const,
};

function labelledInput(label: string): HTMLInputElement {
  // The shared field renders <Label>{text}</Label> followed by the input
  // inside the same wrapper div.
  const lab = screen.getByText(label);
  const input = lab.parentElement!.querySelector('input, textarea');
  return input as HTMLInputElement;
}

describe('ObjectDefaultInspector — basics', () => {
  it('renders curated object basics (no raw fields JSON)', () => {
    const { container } = render(
      <ObjectDefaultInspector
        {...baseProps}
        name="account"
        draft={{ name: 'account', label: 'Account', pluralLabel: 'Accounts', fields: { a: { type: 'text' } } }}
        onPatch={vi.fn()}
        readOnly={false}
      />,
    );
    expect(screen.getByText('Basic info')).toBeInTheDocument();
    expect((labelledInput('Label')).value).toBe('Account');
    expect((labelledInput('Plural label')).value).toBe('Accounts');
    // The fields JSON must NOT leak into this panel.
    expect(container.textContent).not.toContain('object-fields');
    expect(container.querySelector('textarea')).toBeTruthy(); // description only
  });

  it('commits edits via onPatch', () => {
    const onPatch = vi.fn();
    render(
      <ObjectDefaultInspector
        {...baseProps}
        name="account"
        draft={{ name: 'account', label: 'Account' }}
        onPatch={onPatch}
        readOnly={false}
      />,
    );
    fireEvent.change(labelledInput('Plural label'), { target: { value: 'Accounts' } });
    expect(onPatch).toHaveBeenCalledWith({ pluralLabel: 'Accounts' });
    fireEvent.change(labelledInput('Icon'), { target: { value: 'building' } });
    expect(onPatch).toHaveBeenCalledWith({ icon: 'building' });
  });
});

describe('ObjectDefaultInspector — name editability', () => {
  it('locks the name in edit mode (existing object)', () => {
    render(
      <ObjectDefaultInspector
        {...baseProps}
        name="account"
        draft={{ name: 'account', label: 'Account' }}
        onPatch={vi.fn()}
        readOnly={false}
      />,
    );
    expect(labelledInput('Name')).toBeDisabled();
  });

  it('allows editing the name in create mode (empty host name)', () => {
    const onPatch = vi.fn();
    render(
      <ObjectDefaultInspector
        {...baseProps}
        name=""
        draft={{ name: '' }}
        onPatch={onPatch}
        readOnly={false}
      />,
    );
    const nameInput = labelledInput('Name');
    expect(nameInput).not.toBeDisabled();
    fireEvent.change(nameInput, { target: { value: 'My Thing' } });
    expect(onPatch).toHaveBeenCalledWith({ name: 'my_thing' });
  });
});

describe('ObjectDefaultInspector — create-mode name derivation', () => {
  it('auto-derives a snake_case name from the label until name is edited', () => {
    const onPatch = vi.fn();
    render(
      <ObjectDefaultInspector
        {...baseProps}
        name=""
        draft={{ name: '' }}
        onPatch={onPatch}
        readOnly={false}
      />,
    );
    // Typing a label derives name.
    fireEvent.change(labelledInput('Label'), { target: { value: 'Sales Order' } });
    expect(onPatch).toHaveBeenCalledWith({ label: 'Sales Order', name: 'sales_order' });

    onPatch.mockClear();
    // Once the user edits name, label changes no longer overwrite it.
    fireEvent.change(labelledInput('Name'), { target: { value: 'so' } });
    expect(onPatch).toHaveBeenCalledWith({ name: 'so' });
    onPatch.mockClear();
    fireEvent.change(labelledInput('Label'), { target: { value: 'Sales Orders' } });
    expect(onPatch).toHaveBeenCalledWith({ label: 'Sales Orders' }); // no name key
  });
});

describe('ObjectDefaultInspector — i18n', () => {
  it('renders Chinese labels under zh-CN', () => {
    render(
      <ObjectDefaultInspector
        {...baseProps}
        locale={'zh-CN'}
        name="account"
        draft={{ name: 'account', label: '客户' }}
        onPatch={vi.fn()}
        readOnly={false}
      />,
    );
    expect(screen.getByText('基础信息')).toBeInTheDocument();
    expect(screen.getByText('显示名')).toBeInTheDocument();
    expect(screen.getByText('复数显示名')).toBeInTheDocument();
  });
});

describe('ObjectDefaultInspector — read-only', () => {
  it('disables all inputs when readOnly', () => {
    render(
      <ObjectDefaultInspector
        {...baseProps}
        name="account"
        draft={{ name: 'account', label: 'Account' }}
        onPatch={vi.fn()}
        readOnly
      />,
    );
    expect(labelledInput('Label')).toBeDisabled();
    expect(labelledInput('Plural label')).toBeDisabled();
    expect(labelledInput('Icon')).toBeDisabled();
  });
});
