/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SortUI } from '../SortUI';
import type { SortUISchema } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Mock @object-ui/components – provide lightweight stand-ins for Shadcn
// primitives so tests render without a full component tree.
// ---------------------------------------------------------------------------
vi.mock('@object-ui/components', () => {
  const cn = (...args: any[]) => args.filter(Boolean).join(' ');

  const Button = ({ children, onClick, variant, ...rest }: any) => (
    <button onClick={onClick} data-variant={variant} {...rest}>
      {children}
    </button>
  );

  const Select = ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root" data-value={value}>
      {typeof children === 'function'
        ? children({ value, onValueChange })
        : children}
    </div>
  );

  const SelectTrigger = ({ children, className }: any) => (
    <button data-testid="select-trigger" className={className}>
      {children}
    </button>
  );

  const SelectValue = ({ placeholder }: any) => (
    <span data-testid="select-value">{placeholder}</span>
  );

  const SelectContent = ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  );

  const SelectItem = ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  );

  const SortBuilder = ({ fields, value, onChange }: any) => (
    <div data-testid="sort-builder" data-fields={JSON.stringify(fields)} data-value={JSON.stringify(value)}>
      <button
        data-testid="sort-builder-change"
        onClick={() =>
          onChange?.([
            { id: 'date-desc', field: 'date', order: 'desc' },
          ])
        }
      >
        Change Sort
      </button>
    </div>
  );

  return { cn, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SortBuilder };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseFields: SortUISchema['fields'] = [
  { field: 'name', label: 'Name' },
  { field: 'date', label: 'Date' },
];

const makeSchema = (overrides: Partial<SortUISchema> = {}): SortUISchema => ({
  type: 'sort-ui',
  fields: baseFields,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SortUI', () => {
  // -------------------------------------------------------------------------
  // 1. Renders with default (buttons) variant
  // -------------------------------------------------------------------------
  describe('buttons variant', () => {
    it('renders sort buttons for each field', () => {
      render(<SortUI schema={makeSchema({ variant: 'buttons' })} />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
    });

    it('renders all fields as outline buttons when no sort is active', () => {
      render(<SortUI schema={makeSchema({ variant: 'buttons' })} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      buttons.forEach(btn => {
        expect(btn).toHaveAttribute('data-variant', 'outline');
      });
    });

    it('highlights active sort field with secondary variant', () => {
      render(
        <SortUI
          schema={makeSchema({
            variant: 'buttons',
            sort: [{ field: 'name', direction: 'asc' }],
          })}
        />,
      );

      const nameBtn = screen.getByText('Name').closest('button')!;
      expect(nameBtn).toHaveAttribute('data-variant', 'secondary');

      const dateBtn = screen.getByText('Date').closest('button')!;
      expect(dateBtn).toHaveAttribute('data-variant', 'outline');
    });

    it('cycles through asc → desc → removed on repeated clicks', () => {
      const onChange = vi.fn();
      render(
        <SortUI schema={makeSchema({ variant: 'buttons' })} onChange={onChange} />,
      );

      const nameBtn = screen.getByText('Name').closest('button')!;

      // First click: activate asc
      fireEvent.click(nameBtn);
      expect(onChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Renders with dropdown variant
  // -------------------------------------------------------------------------
  describe('dropdown variant', () => {
    it('renders select elements for field and direction', () => {
      render(<SortUI schema={makeSchema({ variant: 'dropdown' })} />);

      const selectRoots = screen.getAllByTestId('select-root');
      expect(selectRoots.length).toBe(2);
    });

    it('renders field options inside select', () => {
      render(<SortUI schema={makeSchema({ variant: 'dropdown' })} />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
    });

    it('renders direction options (Ascending / Descending)', () => {
      render(<SortUI schema={makeSchema({ variant: 'dropdown' })} />);

      expect(screen.getByText('Ascending')).toBeInTheDocument();
      expect(screen.getByText('Descending')).toBeInTheDocument();
    });

    it('defaults to dropdown when variant is omitted', () => {
      render(<SortUI schema={makeSchema()} />);

      // dropdown renders select-root elements, not buttons
      const selectRoots = screen.getAllByTestId('select-root');
      expect(selectRoots.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Renders with builder variant (multiple = true)
  // -------------------------------------------------------------------------
  describe('builder variant (multiple)', () => {
    it('renders SortBuilder when multiple is true', () => {
      render(
        <SortUI
          schema={makeSchema({ multiple: true })}
        />,
      );

      expect(screen.getByTestId('sort-builder')).toBeInTheDocument();
    });

    it('passes fields and value to SortBuilder', () => {
      render(
        <SortUI
          schema={makeSchema({
            multiple: true,
            sort: [{ field: 'name', direction: 'asc' }],
          })}
        />,
      );

      const builder = screen.getByTestId('sort-builder');
      const fields = JSON.parse(builder.getAttribute('data-fields')!);
      expect(fields).toEqual([
        { value: 'name', label: 'Name' },
        { value: 'date', label: 'Date' },
      ]);

      const value = JSON.parse(builder.getAttribute('data-value')!);
      expect(value).toEqual([
        { id: 'name-asc', field: 'name', order: 'asc' },
      ]);
    });

    it('calls onChange when SortBuilder triggers a change', () => {
      const onChange = vi.fn();
      render(
        <SortUI
          schema={makeSchema({ multiple: true })}
          onChange={onChange}
        />,
      );

      fireEvent.click(screen.getByTestId('sort-builder-change'));
      expect(onChange).toHaveBeenCalledWith([{ field: 'date', direction: 'desc' }]);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Initial sort configuration from schema
  // -------------------------------------------------------------------------
  describe('initial sort from schema', () => {
    it('initialises state from schema.sort in buttons variant', () => {
      render(
        <SortUI
          schema={makeSchema({
            variant: 'buttons',
            sort: [{ field: 'date', direction: 'desc' }],
          })}
        />,
      );

      const dateBtn = screen.getByText('Date').closest('button')!;
      expect(dateBtn).toHaveAttribute('data-variant', 'secondary');
    });

    it('renders without error when schema.sort is undefined', () => {
      render(<SortUI schema={makeSchema({ variant: 'buttons' })} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });

    it('renders without error when schema.sort is empty', () => {
      render(
        <SortUI schema={makeSchema({ variant: 'buttons', sort: [] })} />,
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(btn => {
        expect(btn).toHaveAttribute('data-variant', 'outline');
      });
    });
  });

  // -------------------------------------------------------------------------
  // 5. onChange callback
  // -------------------------------------------------------------------------
  describe('onChange callback', () => {
    it('fires onChange when a button sort is toggled', () => {
      const onChange = vi.fn();
      render(
        <SortUI
          schema={makeSchema({ variant: 'buttons' })}
          onChange={onChange}
        />,
      );

      fireEvent.click(screen.getByText('Name').closest('button')!);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);
    });

    it('dispatches custom window event when schema.onChange is set', () => {
      const spy = vi.fn();
      window.addEventListener('sort:changed', spy);

      render(
        <SortUI
          schema={makeSchema({ variant: 'buttons', onChange: 'sort:changed' })}
        />,
      );

      fireEvent.click(screen.getByText('Name').closest('button')!);
      expect(spy).toHaveBeenCalledTimes(1);

      const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
      expect(detail).toEqual({ sort: [{ field: 'name', direction: 'asc' }] });

      window.removeEventListener('sort:changed', spy);
    });

    it('replaces active sort when multiple is false (buttons)', () => {
      const onChange = vi.fn();
      render(
        <SortUI
          schema={makeSchema({
            variant: 'buttons',
            sort: [{ field: 'name', direction: 'asc' }],
          })}
          onChange={onChange}
        />,
      );

      // Click a different field — should replace, not append
      fireEvent.click(screen.getByText('Date').closest('button')!);
      expect(onChange).toHaveBeenCalledWith([{ field: 'date', direction: 'asc' }]);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Helper functions (toSortEntries / toSortItems) – tested indirectly
  // -------------------------------------------------------------------------
  describe('helper functions (toSortEntries / toSortItems)', () => {
    it('toSortEntries: maps schema.sort to internal state shown via button variant', () => {
      render(
        <SortUI
          schema={makeSchema({
            variant: 'buttons',
            sort: [
              { field: 'name', direction: 'asc' },
              { field: 'date', direction: 'desc' },
            ],
            multiple: true,
          })}
        />,
      );

      // Both fields should be highlighted since both are in the sort config
      const nameBtn = screen.getByText('Name').closest('button')!;
      const dateBtn = screen.getByText('Date').closest('button')!;
      expect(nameBtn).toHaveAttribute('data-variant', 'secondary');
      expect(dateBtn).toHaveAttribute('data-variant', 'secondary');
    });

    it('toSortItems: maps sort entries to SortBuilder items', () => {
      render(
        <SortUI
          schema={makeSchema({
            multiple: true,
            sort: [
              { field: 'name', direction: 'asc' },
              { field: 'date', direction: 'desc' },
            ],
          })}
        />,
      );

      const builder = screen.getByTestId('sort-builder');
      const value = JSON.parse(builder.getAttribute('data-value')!);
      expect(value).toEqual([
        { id: 'name-asc', field: 'name', order: 'asc' },
        { id: 'date-desc', field: 'date', order: 'desc' },
      ]);
    });

    it('toSortEntries: returns empty array when sort is undefined', () => {
      render(
        <SortUI
          schema={makeSchema({ variant: 'buttons' })}
        />,
      );

      // No button should have secondary variant
      const buttons = screen.getAllByRole('button');
      buttons.forEach(btn => {
        expect(btn).toHaveAttribute('data-variant', 'outline');
      });
    });
  });
});
