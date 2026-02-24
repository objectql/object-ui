/**
 * ListColumn Extensions Tests
 *
 * Tests for link, action, hidden, type, wrap, and resizable properties
 * on ListColumn when rendered through ObjectGrid → data-table.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ObjectGrid } from './ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';
import type { ListColumn } from '@object-ui/types';

registerAllFields();

// --- Mock Data ---
const mockData = [
  { _id: '1', name: 'Alice', email: 'alice@test.com', amount: 1500, status: 'active' },
  { _id: '2', name: 'Bob', email: 'bob@test.com', amount: 2300, status: 'inactive' },
  { _id: '3', name: 'Charlie', email: 'charlie@test.com', amount: 800, status: 'active' },
];

// --- Helper: Render ObjectGrid with static data and ListColumn[] ---
function renderGrid(columns: ListColumn[], opts?: { onNavigate?: any; navigation?: any }) {
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'test_object',
    columns,
    data: { provider: 'value', items: mockData },
    navigation: opts?.navigation,
    onNavigate: opts?.onNavigate,
  };

  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} />
    </ActionProvider>
  );
}

// =========================================================================
// 1. Hidden columns
// =========================================================================
describe('ListColumn: hidden', () => {
  it('should not render hidden columns', async () => {
    renderGrid([
      { field: 'name', label: 'Name' },
      { field: 'email', label: 'Email', hidden: true },
      { field: 'amount', label: 'Amount' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
    expect(screen.getByText('Amount')).toBeInTheDocument();
    // Email column should NOT be rendered
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
    expect(screen.queryByText('alice@test.com')).not.toBeInTheDocument();
  });

  it('should render non-hidden columns normally', async () => {
    renderGrid([
      { field: 'name', label: 'Name', hidden: false },
      { field: 'email', label: 'Email' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
    expect(screen.getByText('Email')).toBeInTheDocument();
  });
});

// =========================================================================
// 2. Link columns
// =========================================================================
describe('ListColumn: link', () => {
  it('should render link columns as clickable text', async () => {
    renderGrid([
      { field: 'name', label: 'Name', link: true },
      { field: 'email', label: 'Email' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // The name cells should be rendered as buttons (clickable links)
    const aliceLink = screen.getByRole('button', { name: 'Alice' });
    expect(aliceLink).toBeInTheDocument();
    expect(aliceLink).toHaveClass('text-primary');

    const bobLink = screen.getByRole('button', { name: 'Bob' });
    expect(bobLink).toBeInTheDocument();
  });

  it('should trigger navigation when link column is clicked', async () => {
    const onNavigate = vi.fn();

    renderGrid(
      [
        { field: 'name', label: 'Name', link: true },
        { field: 'email', label: 'Email' },
      ],
      {
        navigation: { mode: 'page' },
        onNavigate,
      }
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Alice' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Alice' }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('1', 'view');
  });

  it('should not render non-link columns as buttons', async () => {
    renderGrid([
      { field: 'name', label: 'Name', link: true },
      { field: 'email', label: 'Email' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Email values should NOT be buttons
    expect(screen.queryByRole('button', { name: 'alice@test.com' })).not.toBeInTheDocument();
    // But the text should still render
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });
});

// =========================================================================
// 3. Action columns
// =========================================================================
describe('ListColumn: action', () => {
  it('should render action columns as clickable text', async () => {
    renderGrid([
      { field: 'name', label: 'Name' },
      { field: 'status', label: 'Status', action: 'toggleStatus' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Status cells should be buttons with action label
    const actionBtns = screen.getAllByRole('button', { name: 'ToggleStatus' });
    expect(actionBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('should execute action when action column is clicked', async () => {
    const actionHandler = vi.fn().mockResolvedValue({ success: true });

    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'test_object',
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'status', label: 'Status', action: 'toggleStatus' },
      ],
      data: { provider: 'value', items: mockData },
    };

    render(
      <ActionProvider handlers={{ toggleStatus: actionHandler }}>
        <ObjectGrid schema={schema} />
      </ActionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    const statusBtns = screen.getAllByRole('button', { name: 'ToggleStatus' });
    fireEvent.click(statusBtns[0]);

    await waitFor(() => {
      expect(actionHandler).toHaveBeenCalledTimes(1);
    });
    expect(actionHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'toggleStatus',
        params: expect.objectContaining({
          field: 'status',
          value: 'active',
          record: expect.objectContaining({ _id: '1', name: 'Alice' }),
        }),
      }),
      expect.any(Object) // ActionCtx
    );
  });
});

// =========================================================================
// 4. Type-based cell rendering
// =========================================================================
describe('ListColumn: type', () => {
  it('should use getCellRenderer for typed columns', async () => {
    renderGrid([
      { field: 'name', label: 'Name' },
      { field: 'email', label: 'Email', type: 'email' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Email type should render as a mailto link
    const emailLink = screen.getByText('alice@test.com');
    expect(emailLink).toBeInTheDocument();
    // The email cell renderer wraps in an anchor
    expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:alice@test.com');
  });

  it('should render boolean type columns correctly', async () => {
    const boolData = [
      { _id: '1', name: 'Alice', active: true },
      { _id: '2', name: 'Bob', active: false },
    ];

    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'test_object',
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'active', label: 'Active', type: 'boolean' },
      ],
      data: { provider: 'value', items: boolData },
    };

    render(
      <ActionProvider>
        <ObjectGrid schema={schema} />
      </ActionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Boolean renderer should show check/x icons or text representation
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

// =========================================================================
// 5. Combined: link + type
// =========================================================================
describe('ListColumn: link + type', () => {
  it('should render typed content inside a clickable link', async () => {
    const onNavigate = vi.fn();

    renderGrid(
      [
        { field: 'email', label: 'Email', link: true, type: 'email' },
        { field: 'name', label: 'Name' },
      ],
      {
        navigation: { mode: 'page' },
        onNavigate,
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    // Should be a button wrapping the email content
    const emailBtn = screen.getByRole('button', { name: /alice@test.com/ });
    expect(emailBtn).toBeInTheDocument();
    expect(emailBtn).toHaveClass('text-primary');

    fireEvent.click(emailBtn);
    expect(onNavigate).toHaveBeenCalledWith('1', 'view');
  });
});

// =========================================================================
// 6. Column properties passthrough
// =========================================================================
describe('ListColumn: property passthrough', () => {
  it('should auto-generate header from field name if no label', async () => {
    renderGrid([
      { field: 'first_name' },
    ]);

    await waitFor(() => {
      // Should convert snake_case to title case
      expect(screen.getByText('First name')).toBeInTheDocument();
    });
  });

  it('should use label when provided', async () => {
    renderGrid([
      { field: 'name', label: 'Full Name' },
    ]);

    await waitFor(() => {
      expect(screen.getByText('Full Name')).toBeInTheDocument();
    });
  });

  it('should handle all columns hidden gracefully', async () => {
    const { container } = renderGrid([
      { field: 'name', hidden: true },
      { field: 'email', hidden: true },
    ]);

    // Should render without error, just no columns
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });
});

// =========================================================================
// 7. Type definitions alignment
// =========================================================================
describe('ListColumn type definitions', () => {
  it('should accept link property on ListColumn', () => {
    const col: ListColumn = {
      field: 'name',
      link: true,
    };
    expect(col.link).toBe(true);
  });

  it('should accept action property on ListColumn', () => {
    const col: ListColumn = {
      field: 'status',
      action: 'toggleStatus',
    };
    expect(col.action).toBe('toggleStatus');
  });

  it('should accept both link and action together', () => {
    const col: ListColumn = {
      field: 'name',
      link: true,
      action: 'viewDetail',
    };
    expect(col.link).toBe(true);
    expect(col.action).toBe('viewDetail');
  });

  it('should accept all ListColumn properties', () => {
    const col: ListColumn = {
      field: 'amount',
      label: 'Total Amount',
      width: 150,
      align: 'right',
      hidden: false,
      sortable: true,
      resizable: true,
      wrap: false,
      type: 'currency',
      link: false,
      action: 'editAmount',
    };
    expect(col.field).toBe('amount');
    expect(col.type).toBe('currency');
    expect(col.link).toBe(false);
    expect(col.action).toBe('editAmount');
  });
});
