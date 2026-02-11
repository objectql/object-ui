/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterUI } from '../FilterUI';
import type { FilterUISchema } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Mock @object-ui/components – provide lightweight stand-ins for Shadcn
// primitives so tests render without a full component tree.
// ---------------------------------------------------------------------------
vi.mock('@object-ui/components', () => {
  const cn = (...args: any[]) => args.filter(Boolean).join(' ');

  const Button = ({ children, onClick, variant, size, type, ...rest }: any) => (
    <button onClick={onClick} data-variant={variant} data-size={size} type={type} {...rest}>
      {children}
    </button>
  );

  const Input = ({ value, onChange, placeholder, type, ...rest }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      data-testid={`input-${type || 'text'}`}
      {...rest}
    />
  );

  const Label = ({ children, className }: any) => (
    <label className={className}>{children}</label>
  );

  const Checkbox = ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked}
      onChange={(e: any) => onCheckedChange?.(e.target.checked)}
    />
  );

  // Store onValueChange callbacks by a global map keyed on a unique id
  let selectCallback: ((v: string) => void) | undefined;

  const Select = ({ children, value, onValueChange }: any) => {
    selectCallback = onValueChange;
    return (
      <div data-testid="select-root" data-value={value}>
        {children}
      </div>
    );
  };

  const SelectTrigger = ({ children }: any) => (
    <button data-testid="select-trigger">{children}</button>
  );

  const SelectValue = ({ placeholder }: any) => (
    <span data-testid="select-value">{placeholder}</span>
  );

  const SelectContent = ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  );

  const SelectItem = ({ children, value }: any) => (
    <div
      data-testid="select-item"
      data-value={value}
      role="option"
      onClick={() => selectCallback?.(String(value))}
    >
      {children}
    </div>
  );

  const Popover = ({ children, open }: any) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  );

  const PopoverTrigger = ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  );

  const PopoverContent = ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  );

  const Drawer = ({ children, open }: any) => (
    <div data-testid="drawer" data-open={open}>
      {children}
    </div>
  );

  const DrawerContent = ({ children }: any) => (
    <div data-testid="drawer-content">{children}</div>
  );

  const DrawerHeader = ({ children }: any) => (
    <div data-testid="drawer-header">{children}</div>
  );

  const DrawerTitle = ({ children }: any) => (
    <h2 data-testid="drawer-title">{children}</h2>
  );

  const DrawerDescription = ({ children }: any) => (
    <p data-testid="drawer-description">{children}</p>
  );

  return {
    cn,
    Button,
    Input,
    Label,
    Checkbox,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Popover,
    PopoverTrigger,
    PopoverContent,
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseFilters: FilterUISchema['filters'] = [
  {
    field: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ],
  },
  { field: 'name', label: 'Name', type: 'text' },
];

const makeSchema = (overrides: Partial<FilterUISchema> = {}): FilterUISchema => ({
  type: 'filter-ui',
  filters: baseFilters,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FilterUI', () => {
  // -------------------------------------------------------------------------
  // 1. Renders with inline layout
  // -------------------------------------------------------------------------
  describe('inline layout', () => {
    it('renders the filter form inline by default', () => {
      const { container } = render(<FilterUI schema={makeSchema()} />);

      // Labels should be visible
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();

      // No popover or drawer elements
      expect(screen.queryByTestId('popover')).not.toBeInTheDocument();
      expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
    });

    it('renders with explicit inline layout', () => {
      render(<FilterUI schema={makeSchema({ layout: 'inline' })} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Renders filter fields
  // -------------------------------------------------------------------------
  describe('filter fields', () => {
    it('renders a label for each filter', () => {
      render(<FilterUI schema={makeSchema()} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('falls back to field name when label is omitted', () => {
      render(
        <FilterUI
          schema={makeSchema({
            filters: [{ field: 'email', type: 'text' }],
          })}
        />,
      );

      expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('renders select options for select-type filters', () => {
      render(<FilterUI schema={makeSchema()} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('renders a text input for text-type filters', () => {
      render(
        <FilterUI
          schema={makeSchema({
            filters: [{ field: 'search', label: 'Search', type: 'text' }],
          })}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Search');
      expect(input).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Handles text filter values
  // -------------------------------------------------------------------------
  describe('text filter values', () => {
    it('calls onChange when a text input is changed', () => {
      const onChange = vi.fn();
      render(
        <FilterUI
          schema={makeSchema({
            filters: [{ field: 'name', label: 'Name', type: 'text' }],
          })}
          onChange={onChange}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Name');
      fireEvent.change(input, { target: { value: 'Alice' } });

      expect(onChange).toHaveBeenCalledWith({ name: 'Alice' });
    });

    it('renders with pre-set values from schema', () => {
      render(
        <FilterUI
          schema={makeSchema({
            filters: [{ field: 'name', label: 'Name', type: 'text' }],
            values: { name: 'Bob' },
          })}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Name') as HTMLInputElement;
      expect(input.value).toBe('Bob');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Handles select filter values
  // -------------------------------------------------------------------------
  describe('select filter values', () => {
    it('calls onChange when a select value is changed', () => {
      const onChange = vi.fn();
      render(
        <FilterUI
          schema={makeSchema({
            filters: [
              {
                field: 'status',
                label: 'Status',
                type: 'select',
                options: [
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                ],
              },
            ],
          })}
          onChange={onChange}
        />,
      );

      const activeOption = screen.getByText('Active');
      fireEvent.click(activeOption);

      expect(onChange).toHaveBeenCalledWith({ status: 'active' });
    });

    it('renders with pre-set select value from schema', () => {
      render(
        <FilterUI
          schema={makeSchema({
            values: { status: 'inactive' },
          })}
        />,
      );

      const selectRoot = screen.getAllByTestId('select-root')[0];
      expect(selectRoot).toHaveAttribute('data-value', 'inactive');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Renders with popover layout
  // -------------------------------------------------------------------------
  describe('popover layout', () => {
    it('renders a Filters button with popover wrapper', () => {
      render(<FilterUI schema={makeSchema({ layout: 'popover' })} />);

      expect(screen.getByTestId('popover')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('renders the filter form inside popover content', () => {
      render(<FilterUI schema={makeSchema({ layout: 'popover' })} />);

      const popoverContent = screen.getByTestId('popover-content');
      expect(popoverContent).toBeInTheDocument();

      // Filter labels should still be rendered within popover
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('shows active filter count badge when filters have values', () => {
      render(
        <FilterUI
          schema={makeSchema({
            layout: 'popover',
            values: { status: 'active' },
          })}
        />,
      );

      // The active count should be rendered
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Renders with empty / no filters
  // -------------------------------------------------------------------------
  describe('empty / no filters', () => {
    it('renders without error when filters array is empty', () => {
      render(<FilterUI schema={makeSchema({ filters: [] })} />);

      // Should not throw; no labels rendered
      expect(screen.queryByText('Status')).not.toBeInTheDocument();
      expect(screen.queryByText('Name')).not.toBeInTheDocument();
    });

    it('renders without error when values are empty', () => {
      render(<FilterUI schema={makeSchema({ values: {} })} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('renders without error when values are undefined', () => {
      render(<FilterUI schema={makeSchema()} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 7. isEmptyValue edge cases (tested indirectly via active count badge)
  // -------------------------------------------------------------------------
  describe('isEmptyValue edge cases', () => {
    it('treats null as empty — no active count badge', () => {
      render(
        <FilterUI
          schema={makeSchema({
            layout: 'popover',
            values: { status: null },
          })}
        />,
      );

      // No badge with count should appear
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('treats undefined as empty — no active count badge', () => {
      render(
        <FilterUI
          schema={makeSchema({
            layout: 'popover',
            values: { status: undefined },
          })}
        />,
      );

      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('treats empty string as empty — no active count badge', () => {
      render(
        <FilterUI
          schema={makeSchema({
            layout: 'popover',
            values: { status: '' },
          })}
        />,
      );

      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('treats empty array as empty — no active count badge', () => {
      render(
        <FilterUI
          schema={makeSchema({
            layout: 'popover',
            values: { tags: [] },
          })}
        />,
      );

      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('counts non-empty values for the active count badge', () => {
      render(
        <FilterUI
          schema={makeSchema({
            layout: 'popover',
            values: { status: 'active', name: 'Alice' },
          })}
        />,
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 8. onChange callback
  // -------------------------------------------------------------------------
  describe('onChange callback', () => {
    it('fires onChange immediately when showApply is not set', () => {
      const onChange = vi.fn();
      render(
        <FilterUI
          schema={makeSchema({
            filters: [{ field: 'name', label: 'Name', type: 'text' }],
          })}
          onChange={onChange}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Name');
      fireEvent.change(input, { target: { value: 'Test' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ name: 'Test' });
    });

    it('defers onChange until Apply is clicked when showApply is true', () => {
      const onChange = vi.fn();
      render(
        <FilterUI
          schema={makeSchema({
            filters: [{ field: 'name', label: 'Name', type: 'text' }],
            showApply: true,
          })}
          onChange={onChange}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Name');
      fireEvent.change(input, { target: { value: 'Deferred' } });

      // onChange should NOT have been called yet
      expect(onChange).not.toHaveBeenCalled();

      // Click Apply
      fireEvent.click(screen.getByText('Apply'));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ name: 'Deferred' });
    });

    it('clears all values when Clear is clicked', () => {
      const onChange = vi.fn();
      render(
        <FilterUI
          schema={makeSchema({
            filters: [{ field: 'name', label: 'Name', type: 'text' }],
            values: { name: 'Existing' },
            showClear: true,
          })}
          onChange={onChange}
        />,
      );

      fireEvent.click(screen.getByText('Clear'));
      expect(onChange).toHaveBeenCalledWith({});
    });

    it('dispatches custom window event when schema.onChange is set', () => {
      const spy = vi.fn();
      window.addEventListener('filter:changed', spy);

      render(
        <FilterUI
          schema={makeSchema({
            filters: [{ field: 'name', label: 'Name', type: 'text' }],
            onChange: 'filter:changed',
          })}
        />,
      );

      const input = screen.getByPlaceholderText('Filter by Name');
      fireEvent.change(input, { target: { value: 'Event' } });

      expect(spy).toHaveBeenCalledTimes(1);
      const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
      expect(detail).toEqual({ values: { name: 'Event' } });

      window.removeEventListener('filter:changed', spy);
    });
  });
});
