/**
 * AccessorKey Inference Tests
 *
 * Tests that accessorKey-format columns receive type inference
 * via inferColumnType() + getCellRenderer(), matching the behavior
 * of ListColumn (field) format columns.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

// --- Mock Data with various types ---
const mockData = [
  {
    _id: '1',
    name: 'Project Alpha',
    status: 'in_progress',
    priority: 'high',
    progress: 75,
    start_date: '2024-02-01T00:00:00.000Z',
  },
  {
    _id: '2',
    name: 'Project Beta',
    status: 'completed',
    priority: 'low',
    progress: 100,
    start_date: '2024-03-15T00:00:00.000Z',
  },
];

// Helper: Render ObjectGrid with accessorKey-format columns
function renderAccessorGrid(columns: any[], data?: any[]) {
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'test_object',
    columns,
    data: { provider: 'value', items: data || mockData },
  };

  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} />
    </ActionProvider>
  );
}

// =========================================================================
// 1. accessorKey columns get type inference
// =========================================================================
describe('accessorKey-format: type inference', () => {
  it('should infer select type for status field and render badges', async () => {
    renderAccessorGrid([
      { header: 'Name', accessorKey: 'name' },
      { header: 'Status', accessorKey: 'status' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Status should be inferred as select and render humanized badges
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should infer date type for date fields', async () => {
    renderAccessorGrid([
      { header: 'Name', accessorKey: 'name' },
      { header: 'Start Date', accessorKey: 'start_date' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Date fields should NOT show raw ISO strings
    expect(screen.queryByText('2024-02-01T00:00:00.000Z')).not.toBeInTheDocument();
  });

  it('should infer percent type for progress field and render progress bar', async () => {
    renderAccessorGrid([
      { header: 'Name', accessorKey: 'name' },
      { header: 'Progress', accessorKey: 'progress' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Progress should render as percentage with progress bar
    expect(screen.getByText('75%')).toBeInTheDocument();
    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('should NOT override columns that already have a cell renderer', async () => {
    const customRenderer = (value: any) => <span data-testid="custom">{value}-custom</span>;
    renderAccessorGrid([
      { header: 'Name', accessorKey: 'name' },
      { header: 'Status', accessorKey: 'status', cell: customRenderer },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Custom renderer should be preserved
    expect(screen.getByText('in_progress-custom')).toBeInTheDocument();
  });

  it('should pass through columns with explicit type', async () => {
    renderAccessorGrid([
      { header: 'Name', accessorKey: 'name' },
      { header: 'Priority', accessorKey: 'priority', type: 'select' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Priority with explicit select type should render as humanized badge
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });
});
