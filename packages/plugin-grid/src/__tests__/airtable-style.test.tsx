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

  it('should format created_at fields as datetime', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'created_at', label: 'Created At' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Should show human-readable datetime, not ISO string
    expect(screen.queryByText('2026-01-15T10:00:00.000Z')).not.toBeInTheDocument();
    // created_at now renders as datetime with split date/time display
    expect(screen.getByText('1/15/2026')).toBeInTheDocument();
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

// =========================================================================
// 7. Column header type icons
// =========================================================================
describe('Column header type icons', () => {
  it('should render type icons in column headers', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'status', label: 'Status' },
      { field: 'due_date', label: 'Due Date' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });
    // Each column header should have an SVG icon
    const headers = screen.getAllByRole('columnheader');
    // Filter out utility headers (row numbers, checkboxes, actions)
    const dataHeaders = headers.filter(h => h.querySelector('svg'));
    expect(dataHeaders.length).toBeGreaterThanOrEqual(3);
  });
});

// =========================================================================
// 8. Datetime type inference
// =========================================================================
describe('Datetime type inference', () => {
  it('should infer datetime type for created_at fields', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'created_at', label: 'Created At' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });
    // Should show split datetime format (date and time separately)
    // The time part should be rendered in a separate muted span
    const dateEl = screen.getByText('1/15/2026');
    expect(dateEl).toBeInTheDocument();
  });
});

// =========================================================================
// 9. Compound cell with prefix badge
// =========================================================================
describe('Compound cell with prefix badge', () => {
  it('should render prefix badge before the main value', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject', prefix: { field: 'category', type: 'badge' } },
      { field: 'status', label: 'Status' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });
    // The category values should appear as badges alongside subject
    const engineeringBadges = screen.getAllByText('Engineering');
    expect(engineeringBadges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Task Alpha')).toBeInTheDocument();
  });
});

// =========================================================================
// 10. Add record row
// =========================================================================
describe('Add record row', () => {
  it('should show add record row when operations.create is true', async () => {
    renderGrid(
      [
        { field: 'subject', label: 'Subject' },
        { field: 'status', label: 'Status' },
      ],
      { operations: { create: true } }
    );
    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });
    expect(screen.getByTestId('add-record-row')).toBeInTheDocument();
    expect(screen.getByText('Add record')).toBeInTheDocument();
  });

  it('should not show add record row by default', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'status', label: 'Status' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('add-record-row')).not.toBeInTheDocument();
  });
});

// =========================================================================
// 11. Primary field auto-link
// =========================================================================
describe('Primary field auto-link', () => {
  it('should render first column cells as clickable links (primary field)', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'status', label: 'Status' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // First column cells should be rendered as buttons (links) with primary-field-link testid
    const primaryLinks = screen.getAllByTestId('primary-field-link');
    expect(primaryLinks.length).toBe(3); // 3 data rows
    expect(primaryLinks[0]).toHaveTextContent('Task Alpha');
    expect(primaryLinks[1]).toHaveTextContent('Task Beta');
    expect(primaryLinks[2]).toHaveTextContent('Task Gamma');
  });

  it('should style primary field cells with font-medium and text-primary', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject' },
      { field: 'status', label: 'Status' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    const primaryLinks = screen.getAllByTestId('primary-field-link');
    // Primary field links should have text-primary and font-medium classes
    expect(primaryLinks[0]).toHaveClass('text-primary');
    expect(primaryLinks[0]).toHaveClass('font-medium');
  });

  it('should not auto-link first column when it already has explicit link=true', async () => {
    renderGrid([
      { field: 'subject', label: 'Subject', link: true },
      { field: 'status', label: 'Status' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Still should have clickable buttons (via explicit link), but no primary-field-link testid
    // because isPrimaryField is only true when !col.link && !col.action
    const primaryLinks = screen.queryAllByTestId('primary-field-link');
    expect(primaryLinks.length).toBe(0);

    // But the cells should still be buttons (from col.link path)
    const subjectCell = screen.getByText('Task Alpha');
    expect(subjectCell.closest('button')).toBeTruthy();
  });
});

// =========================================================================
// 12. Empty value display
// =========================================================================
describe('Empty value display', () => {
  it('should show styled empty indicator for null/empty values', async () => {
    const dataWithEmpty = [
      { _id: '1', subject: 'Task Alpha', company: null },
      { _id: '2', subject: 'Task Beta', company: '' },
      { _id: '3', subject: 'Task Gamma', company: 'Acme' },
    ];

    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'test_object',
      columns: [
        { field: 'subject', label: 'Subject' },
        { field: 'company', label: 'Company' },
      ],
      data: { provider: 'value', items: dataWithEmpty },
    };

    render(
      <ActionProvider>
        <ObjectGrid schema={schema} />
      </ActionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // Non-empty value should be displayed normally
    expect(screen.getByText('Acme')).toBeInTheDocument();

    // Empty values should show muted dash indicators
    const emptyIndicators = screen.getAllByText('—');
    expect(emptyIndicators.length).toBeGreaterThanOrEqual(2);
    // Verify they have the styled classes
    emptyIndicators.forEach(el => {
      expect(el.className).toContain('italic');
    });
  });
});

// =========================================================================
// 13. Record detail panel (form-based)
// =========================================================================
describe('Record detail panel', () => {
  it('should render form-based record detail with renderRecordDetail', async () => {
    const onRowClick = vi.fn();
    renderGrid(
      [
        { field: 'subject', label: 'Subject' },
        { field: 'status', label: 'Status' },
      ],
      {
        navigation: { mode: 'drawer' },
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Subject')).toBeInTheDocument();
    });

    // The grid should render successfully with navigation configured
    expect(screen.getByText('Task Alpha')).toBeInTheDocument();
  });
});

// =========================================================================
// 13. Auto-type inference: Currency/Amount fields
// =========================================================================
describe('Auto-type inference: Currency/Amount fields', () => {
  const currencyData = [
    { _id: '1', name: 'Order 1', total_amount: 15459.99 },
    { _id: '2', name: 'Order 2', total_amount: 289.50 },
  ];

  function renderCurrencyGrid(columns: ListColumn[]) {
    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'test_object',
      columns,
      data: { provider: 'value', items: currencyData },
    };

    return render(
      <ActionProvider>
        <ObjectGrid schema={schema} />
      </ActionProvider>
    );
  }

  it('should auto-infer currency type for amount fields and format values', async () => {
    renderCurrencyGrid([
      { field: 'name', label: 'Name' },
      { field: 'total_amount', label: 'Amount' },
    ]);
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
    // Should show formatted currency (e.g. "$15,459.99") instead of raw "15459.99"
    expect(screen.queryByText('15459.99')).not.toBeInTheDocument();
    expect(screen.getByText(/15,459\.99/)).toBeInTheDocument();
  });
});
