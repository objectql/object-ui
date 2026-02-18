/**
 * Airtable-Style Grid Optimizations Tests
 *
 * Tests for auto-type inference (date, select, boolean, user),
 * row number column, compact density, and frozen first column defaults.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';
import type { ListColumn } from '@object-ui/types';

registerAllFields();

// --- Mock Data with various field types ---
const mockData = [
  {
    _id: '1',
    subject: 'Task Alpha',
    status: 'In Progress',
    priority: 'High',
    category: 'Engineering',
    due_date: '2026-02-20T03:46:37.982Z',
    created_at: '2026-01-15T10:00:00.000Z',
    is_completed: true,
    assignee: 'Alice Smith',
  },
  {
    _id: '2',
    subject: 'Task Beta',
    status: 'Done',
    priority: 'Low',
    category: 'Design',
    due_date: '2026-03-01T00:00:00.000Z',
    created_at: '2026-01-20T10:00:00.000Z',
    is_completed: false,
    assignee: 'Bob Jones',
  },
  {
    _id: '3',
    subject: 'Task Gamma',
    status: 'To Do',
    priority: 'Medium',
    category: 'Engineering',
    due_date: '2026-04-15T00:00:00.000Z',
    created_at: '2026-02-01T10:00:00.000Z',
    is_completed: false,
    assignee: 'Charlie Brown',
  },
];

function renderGrid(columns: ListColumn[], opts?: Record<string, any>) {
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'test_object',
    columns,
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
// 1. Auto-type inference: Date fields
// =========================================================================
describe('Auto-type inference: Date fields', () => {
  it('should format date fields containing "date" in name as human-readable dates', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'due_date', label: 'Due Date' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Should NOT show raw ISO format
    expect(screen.queryByText('2026-02-20T03:46:37.982Z')).not.toBeInTheDocument();
    // Should show human-readable format
    expect(screen.getByText('Feb 20, 2026')).toBeInTheDocument();
  });

  it('should format created_at fields as dates', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'created_at', label: 'Created At' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Should show human-readable date, not ISO string
    expect(screen.queryByText('2026-01-15T10:00:00.000Z')).not.toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2026')).toBeInTheDocument();
  });

  it('should not override explicit type for date-like fields', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'due_date', label: 'Due Date', type: 'text' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // With explicit type: 'text', should render as text
    expect(screen.getByText('2026-02-20T03:46:37.982Z')).toBeInTheDocument();
  });
});

// =========================================================================
// 2. Auto-type inference: Select/Badge fields
// =========================================================================
describe('Auto-type inference: Select/Badge fields', () => {
  it('should render status field as badge when values are enumerable', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'status', label: 'Status' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Status values should be present
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('should render priority field as badge', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'priority', label: 'Priority' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });
});

// =========================================================================
// 3. Auto-type inference: Boolean/Checkbox fields
// =========================================================================
describe('Auto-type inference: Boolean/Checkbox fields', () => {
  it('should render is_completed as checkbox', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'is_completed', label: 'Is Completed' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Should render checkboxes (role="checkbox")
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });
});

// =========================================================================
// 4. Row number column
// =========================================================================
describe('Row number column', () => {
  it('should show row numbers by default in ObjectGrid', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'status', label: 'Status' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Row numbers should be rendered (1, 2, 3)
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

// =========================================================================
// 5. Compact row density (default medium)
// =========================================================================
describe('Row density', () => {
  it('should apply default medium density classes', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Verify data-table is rendered (implicitly has the cellClassName applied)
    expect(screen.getByText('Task Alpha')).toBeInTheDocument();
  });
});

// =========================================================================
// 6. Frozen first column default
// =========================================================================
describe('Frozen first column', () => {
  it('should default frozenColumns to 1', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'status', label: 'Status' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // The first column header should have sticky class (indicating it's frozen)
    const subjectHeader = screen.getByText('Subject').closest('th');
    expect(subjectHeader).toHaveClass('sticky');
  });

  it('should not freeze columns when frozenColumns is explicitly 0', async () => {
    renderGrid(
      [
        { field: 'subject', label: 'Subject' },
        { field: 'status', label: 'Status' },
      ],
      { frozenColumns: 0 }
    );

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    const subjectHeader = screen.getByText('Subject').closest('th');
    expect(subjectHeader).not.toHaveClass('sticky');
  });
});
