// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WIDGETS } from './widgets';

afterEach(cleanup);

const FilterMode = WIDGETS['filter-mode'];
const ctx = {
  objectFields: [
    { name: 'status', label: 'Status' },
    { name: 'priority', label: 'Priority' },
    { name: 'owner', label: 'Owner' },
  ],
};

/**
 * ADR-0047 filter-mode widget. None is a first-class UI state that maps to
 * ABSENCE of userFilters (onChange(undefined)) — the protocol stores "no
 * filter bar" as omission, not a literal element: 'none'.
 */
describe('filter-mode widget', () => {
  it('shows None active when value is absent', () => {
    render(<FilterMode value={undefined} onChange={() => {}} context={ctx} schema={{}} />);
    expect(screen.getByTestId('filter-mode-none')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('filter-mode-fields')).not.toBeInTheDocument();
  });

  it('offers None / Tabs / Dropdown only — Toggle is deprecated and not authorable (ADR-0047 §3.4a)', () => {
    render(<FilterMode value={undefined} onChange={() => {}} context={ctx} schema={{}} />);
    expect(screen.getByTestId('filter-mode-none')).toBeInTheDocument();
    expect(screen.getByTestId('filter-mode-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('filter-mode-dropdown')).toBeInTheDocument();
    expect(screen.queryByTestId('filter-mode-toggle')).not.toBeInTheDocument();
  });

  it('keeps a deprecated element:"toggle" config editable (field picker still shows)', () => {
    render(<FilterMode value={{ element: 'toggle', fields: [{ field: 'is_active' }] }} onChange={() => {}} context={ctx} schema={{}} />);
    // No Toggle button to re-select, but its fields remain editable.
    expect(screen.queryByTestId('filter-mode-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('filter-mode-fields')).toBeInTheDocument();
  });

  it('selecting None removes the config (onChange undefined)', () => {
    const onChange = vi.fn();
    render(<FilterMode value={{ element: 'dropdown', fields: [{ field: 'status' }] }} onChange={onChange} context={ctx} schema={{}} />);
    fireEvent.click(screen.getByTestId('filter-mode-none'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('selecting Dropdown sets element and reveals the field picker', () => {
    const onChange = vi.fn();
    render(<FilterMode value={undefined} onChange={onChange} context={ctx} schema={{}} />);
    fireEvent.click(screen.getByTestId('filter-mode-dropdown'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ element: 'dropdown' }));
  });

  it('dropdown mode renders existing fields and an add-field picker from the source object', () => {
    render(
      <FilterMode
        value={{ element: 'dropdown', fields: [{ field: 'status' }] }}
        onChange={() => {}}
        context={ctx}
        schema={{}}
      />,
    );
    const box = screen.getByTestId('filter-mode-fields');
    expect(box.textContent).toContain('status');
    expect(screen.getByTestId('filter-mode-add-field')).toBeInTheDocument();
  });

  it('tabs mode shows the source-view hint, not a field picker', () => {
    render(<FilterMode value={{ element: 'tabs' }} onChange={() => {}} context={ctx} schema={{}} />);
    expect(screen.getByTestId('filter-mode-tabs-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('filter-mode-fields')).not.toBeInTheDocument();
  });
});
