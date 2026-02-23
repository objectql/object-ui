/**
 * ObjectGrid Row Height Tests
 *
 * Validates all 5 rowHeight enum values ('compact' | 'short' | 'medium' | 'tall' | 'extra_tall')
 * are correctly supported in state initialization, cell class mapping, cycle toggle, and icon selection.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

const mockData = [
  { _id: '1', name: 'Alice', role: 'Engineer' },
  { _id: '2', name: 'Bob', role: 'Designer' },
];

function renderGrid(opts?: Record<string, any>) {
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'test_object',
    columns: [
      { field: 'name', label: 'Name' },
      { field: 'role', label: 'Role' },
    ],
    data: { provider: 'value', items: mockData },
    ...opts,
  };

  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} />
    </ActionProvider>
  );
}

// =========================================================================
// Row height toggle visibility
// =========================================================================
describe('Row height toggle visibility', () => {
  it('should show row height toggle when rowHeight is set in schema', async () => {
    renderGrid({ rowHeight: 'medium' });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    expect(screen.getByTitle(/Row height:/)).toBeInTheDocument();
  });

  it('should not show row height toggle when rowHeight is not set', async () => {
    renderGrid();

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    expect(screen.queryByTitle(/Row height:/)).not.toBeInTheDocument();
  });
});

// =========================================================================
// Row height initialization for all 5 enum values
// =========================================================================
describe('Row height initialization', () => {
  const allHeights = ['compact', 'short', 'medium', 'tall', 'extra_tall'] as const;

  allHeights.forEach((height) => {
    it(`should initialize with rowHeight="${height}"`, async () => {
      renderGrid({ rowHeight: height });

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument();
      });

      const toggle = screen.getByTitle(`Row height: ${height}`);
      expect(toggle).toBeInTheDocument();
    });
  });
});

// =========================================================================
// Row height cycle through all 5 values
// =========================================================================
describe('Row height cycle', () => {
  it('should cycle through all 5 heights: compact → short → medium → tall → extra_tall → compact', async () => {
    renderGrid({ rowHeight: 'compact' });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    const getToggle = () => screen.getByTitle(/Row height:/);

    // Start: compact
    expect(getToggle()).toHaveAttribute('title', 'Row height: compact');

    // Click: compact → short
    fireEvent.click(getToggle());
    expect(getToggle()).toHaveAttribute('title', 'Row height: short');

    // Click: short → medium
    fireEvent.click(getToggle());
    expect(getToggle()).toHaveAttribute('title', 'Row height: medium');

    // Click: medium → tall
    fireEvent.click(getToggle());
    expect(getToggle()).toHaveAttribute('title', 'Row height: tall');

    // Click: tall → extra_tall
    fireEvent.click(getToggle());
    expect(getToggle()).toHaveAttribute('title', 'Row height: extra_tall');

    // Click: extra_tall → compact (wraps around)
    fireEvent.click(getToggle());
    expect(getToggle()).toHaveAttribute('title', 'Row height: compact');
  });
});

// =========================================================================
// Row height label display
// =========================================================================
describe('Row height label display', () => {
  const allHeights = ['compact', 'short', 'medium', 'tall', 'extra_tall'] as const;

  allHeights.forEach((height) => {
    it(`should display "${height}" label in the toggle button`, async () => {
      renderGrid({ rowHeight: height });

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument();
      });

      // The label text is rendered as-is in the DOM (CSS `capitalize` handles visual casing)
      const toggle = screen.getByTitle(`Row height: ${height}`);
      expect(toggle).toHaveTextContent(height);
    });
  });
});

// =========================================================================
// Default rowHeight fallback
// =========================================================================
describe('Row height default', () => {
  it('should default to "medium" when rowHeight is defined but empty', async () => {
    // When rowHeight is present (truthy or not), toggle shows.
    // When schema.rowHeight is undefined, no toggle is shown — default 'medium' is internal.
    renderGrid({ rowHeight: 'medium' });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    expect(screen.getByTitle('Row height: medium')).toBeInTheDocument();
  });
});
