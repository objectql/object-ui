/**
 * RowActionMenu & BulkActionBar component tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import React from 'react';

import { RowActionMenu, formatActionLabel } from '../components/RowActionMenu';
import { BulkActionBar } from '../components/BulkActionBar';
import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const testRow = { _id: '1', name: 'Alice', amount: 100 };
const testData = [
  { _id: '1', name: 'Alice', amount: 100 },
  { _id: '2', name: 'Bob', amount: 200 },
  { _id: '3', name: 'Charlie', amount: 300 },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function renderGrid(opts?: Record<string, any>) {
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'test_object',
    columns: [
      { field: 'name', label: 'Name' },
      { field: 'amount', label: 'Amount', type: 'number' },
    ],
    data: { provider: 'value', items: testData },
    ...opts,
  };

  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} />
    </ActionProvider>
  );
}

// =========================================================================
// formatActionLabel
// =========================================================================
describe('formatActionLabel', () => {
  it('formats single word actions', () => {
    expect(formatActionLabel('delete')).toBe('Delete');
  });

  it('formats underscore-separated actions', () => {
    expect(formatActionLabel('send_email')).toBe('Send Email');
  });

  it('formats multi-word actions', () => {
    expect(formatActionLabel('bulk_archive_items')).toBe('Bulk Archive Items');
  });
});

// =========================================================================
// RowActionMenu component
// =========================================================================
describe('RowActionMenu', () => {
  it('renders trigger button with "..." icon', () => {
    render(<RowActionMenu row={testRow} rowActions={['archive']} />);
    const trigger = screen.getByTestId('row-action-trigger');
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText('Open menu')).toBeInTheDocument();
  });

  it('shows custom row actions in dropdown on click', async () => {
    const user = userEvent.setup();
    render(<RowActionMenu row={testRow} rowActions={['archive', 'send_email']} />);
    
    await user.click(screen.getByTestId('row-action-trigger'));
    
    await waitFor(() => {
      expect(screen.getByTestId('row-action-archive')).toBeInTheDocument();
      expect(screen.getByTestId('row-action-send_email')).toBeInTheDocument();
    });

    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Send Email')).toBeInTheDocument();
  });

  it('shows edit and delete items when canEdit/canDelete are true', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <RowActionMenu
        row={testRow}
        canEdit
        canDelete
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByTestId('row-action-trigger'));
    
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('calls onEdit with the row when edit is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<RowActionMenu row={testRow} canEdit onEdit={onEdit} />);

    await user.click(screen.getByTestId('row-action-trigger'));
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(testRow);
  });

  it('calls onDelete with the row when delete is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<RowActionMenu row={testRow} canDelete onDelete={onDelete} />);

    await user.click(screen.getByTestId('row-action-trigger'));
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(testRow);
  });

  it('calls onAction with action name and row', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<RowActionMenu row={testRow} rowActions={['archive']} onAction={onAction} />);

    await user.click(screen.getByTestId('row-action-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('row-action-archive')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('row-action-archive'));
    expect(onAction).toHaveBeenCalledWith('archive', testRow);
  });

  it('does not show edit/delete when canEdit/canDelete are false', async () => {
    const user = userEvent.setup();
    render(<RowActionMenu row={testRow} rowActions={['archive']} />);

    await user.click(screen.getByTestId('row-action-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('row-action-archive')).toBeInTheDocument();
    });

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});

// =========================================================================
// BulkActionBar component
// =========================================================================
describe('BulkActionBar', () => {
  it('renders nothing when no rows are selected', () => {
    const { container } = render(
      <BulkActionBar selectedRows={[]} actions={['delete', 'archive']} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when actions array is empty', () => {
    const { container } = render(
      <BulkActionBar selectedRows={testData} actions={[]} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders selected count and action buttons', () => {
    render(
      <BulkActionBar selectedRows={testData} actions={['delete', 'archive']} />
    );

    expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument();
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-action-delete')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-action-archive')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('shows Clear button', () => {
    render(
      <BulkActionBar selectedRows={testData} actions={['delete']} />
    );
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('calls onAction with action and selected rows', () => {
    const onAction = vi.fn();
    render(
      <BulkActionBar
        selectedRows={testData}
        actions={['delete', 'archive']}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByTestId('bulk-action-delete'));
    expect(onAction).toHaveBeenCalledWith('delete', testData);

    fireEvent.click(screen.getByTestId('bulk-action-archive'));
    expect(onAction).toHaveBeenCalledWith('archive', testData);
  });

  it('calls onClearSelection when Clear is clicked', () => {
    const onClear = vi.fn();
    render(
      <BulkActionBar
        selectedRows={testData}
        actions={['delete']}
        onClearSelection={onClear}
      />
    );

    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('formats action labels correctly', () => {
    render(
      <BulkActionBar selectedRows={[testRow]} actions={['send_email', 'bulk_archive']} />
    );

    expect(screen.getByText('Send Email')).toBeInTheDocument();
    expect(screen.getByText('Bulk Archive')).toBeInTheDocument();
  });
});

// =========================================================================
// RowActionMenu integration in ObjectGrid
// =========================================================================
describe('RowActionMenu in ObjectGrid', () => {
  it('renders row action triggers when rowActions configured', async () => {
    renderGrid({
      rowActions: ['archive', 'send_email'],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Each row should have a row action trigger
    const triggers = screen.getAllByTestId('row-action-trigger');
    expect(triggers.length).toBe(3); // 3 data rows
  });

  it('shows rowActions items in dropdown on click', async () => {
    const user = userEvent.setup();
    renderGrid({
      rowActions: ['archive', 'send_email'],
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    const triggers = screen.getAllByTestId('row-action-trigger');
    await user.click(triggers[0]);

    await waitFor(() => {
      expect(screen.getByTestId('row-action-archive')).toBeInTheDocument();
      expect(screen.getByTestId('row-action-send_email')).toBeInTheDocument();
    });
  });

  it('renders Actions column header when rowActions configured', async () => {
    renderGrid({
      rowActions: ['archive'],
    });

    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('does not render Actions column when no rowActions and no operations', async () => {
    renderGrid();

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });
});

// =========================================================================
// BulkActionBar integration in ObjectGrid
// =========================================================================
describe('BulkActionBar in ObjectGrid', () => {
  it('does not render bulk actions bar when no batchActions configured', async () => {
    renderGrid();

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
  });

  it('does not render bulk actions bar when batchActions configured but no rows selected', async () => {
    renderGrid({
      batchActions: ['delete', 'archive'],
      selection: { type: 'multiple' },
    });

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('bulk-actions-bar')).not.toBeInTheDocument();
  });
});
