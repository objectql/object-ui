/**
 * Data Table - Airtable UX Enhancements Tests
 *
 * Tests for row hover expand button, column header context menu,
 * and hide column functionality.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { SchemaRenderer } from '@object-ui/react';

// Import data-table to ensure it's registered
import '../data-table';

const baseSchema = {
  type: 'data-table',
  columns: [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Role', accessorKey: 'role' },
  ],
  data: [
    { id: 1, name: 'Alice', email: 'alice@test.com', role: 'Admin' },
    { id: 2, name: 'Bob', email: 'bob@test.com', role: 'User' },
  ],
  pagination: false,
  searchable: false,
  showRowNumbers: true,
};

// =========================================================================
// 1. Row hover expand button
// =========================================================================
describe('Row hover expand button', () => {
  it('should render expand buttons on rows when onRowClick is configured', async () => {
    const onRowClick = vi.fn();
    render(
      <SchemaRenderer
        schema={{ ...baseSchema, onRowClick }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Expand buttons should exist (hidden via CSS, visible on hover)
    const expandButtons = screen.getAllByTestId('row-expand-button');
    expect(expandButtons.length).toBe(2);
  });

  it('should not render expand buttons when onRowClick is not configured', async () => {
    render(<SchemaRenderer schema={baseSchema} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    expect(screen.queryAllByTestId('row-expand-button')).toHaveLength(0);
  });

  it('should call onRowClick when expand button is clicked', async () => {
    const onRowClick = vi.fn();
    render(
      <SchemaRenderer
        schema={{ ...baseSchema, onRowClick }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const expandButtons = screen.getAllByTestId('row-expand-button');
    fireEvent.click(expandButtons[0]);

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice' })
    );
  });
});

// =========================================================================
// 2. Column header context menu
// =========================================================================
describe('Column header context menu', () => {
  it('should show context menu on right-click of column header', async () => {
    render(<SchemaRenderer schema={baseSchema} />);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Right-click on the "Name" column header
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toBeTruthy();
    fireEvent.contextMenu(nameHeader!);

    // Context menu should appear
    await waitFor(() => {
      expect(screen.getByTestId('column-context-menu')).toBeInTheDocument();
    });

    // Should contain Sort and Hide options
    expect(screen.getByText('Sort ascending')).toBeInTheDocument();
    expect(screen.getByText('Sort descending')).toBeInTheDocument();
    expect(screen.getByText('Hide column')).toBeInTheDocument();
  });

  it('should hide column when "Hide column" is clicked', async () => {
    render(<SchemaRenderer schema={baseSchema} />);

    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    // Right-click on the "Email" column header
    const emailHeader = screen.getByText('Email').closest('th');
    fireEvent.contextMenu(emailHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('column-context-menu')).toBeInTheDocument();
    });

    // Click "Hide column"
    fireEvent.click(screen.getByText('Hide column'));

    // The "Email" column should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
    });

    // Other columns should still be visible
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('should sort ascending when "Sort ascending" is clicked from context menu', async () => {
    render(
      <SchemaRenderer
        schema={{
          ...baseSchema,
          sortable: true,
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Right-click on the "Name" column header
    const nameHeader = screen.getByText('Name').closest('th');
    fireEvent.contextMenu(nameHeader!);

    await waitFor(() => {
      expect(screen.getByTestId('column-context-menu')).toBeInTheDocument();
    });

    // Click "Sort ascending"
    fireEvent.click(screen.getByText('Sort ascending'));

    // Context menu should close
    await waitFor(() => {
      expect(screen.queryByTestId('column-context-menu')).not.toBeInTheDocument();
    });
  });
});

// =========================================================================
// 3. Group/row hover styling
// =========================================================================
describe('Row group hover class', () => {
  it('should apply group/row hover class to table rows', async () => {
    render(<SchemaRenderer schema={baseSchema} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Data rows should have group/row class for hover effects
    const aliceRow = screen.getByText('Alice').closest('tr');
    expect(aliceRow).toHaveClass('group/row');
  });
});
