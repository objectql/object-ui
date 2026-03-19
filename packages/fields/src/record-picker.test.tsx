import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordPickerDialog } from './widgets/RecordPickerDialog';
import { LookupField } from './widgets/LookupField';
import type { FieldWidgetProps } from './widgets/types';

// ------------- Mocks & Setup -------------

const mockDataSource = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------- RecordPickerDialog Tests -------------

describe('RecordPickerDialog', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('renders dialog with title and search input', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(<RecordPickerDialog {...basePickerProps} title="Select Customer" />);

    await waitFor(() => {
      expect(screen.getByText('Select Customer')).toBeInTheDocument();
      expect(screen.getByTestId('record-picker-search')).toBeInTheDocument();
    });
  });

  it('fetches and displays records in table format', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Acme Corp', email: 'acme@test.com' },
        { id: '2', name: 'Beta Inc', email: 'beta@test.com' },
      ],
      total: 2,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name', 'email']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
      expect(screen.getByText('acme@test.com')).toBeInTheDocument();
      expect(screen.getByText('beta@test.com')).toBeInTheDocument();
    });

    // Should have column headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows loading state while fetching', async () => {
    mockDataSource.find.mockReturnValue(new Promise(() => {}));

    render(<RecordPickerDialog {...basePickerProps} />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByTestId('record-picker-skeleton')).toBeInTheDocument();
    });
  });

  it('shows error state with retry button', async () => {
    mockDataSource.find.mockRejectedValue(new Error('Connection failed'));

    render(<RecordPickerDialog {...basePickerProps} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    // Click retry
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Acme Corp' }],
      total: 1,
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Retry'));
    });

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  it('shows empty state when no records found', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(<RecordPickerDialog {...basePickerProps} />);

    await waitFor(() => {
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });
  });

  it('selects a record in single-select mode and closes dialog', async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Acme Corp' },
        { id: '2', name: 'Beta Inc' },
      ],
      total: 2,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('record-row-1'));
    });

    expect(onSelect).toHaveBeenCalledWith('1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports multi-select with confirm button', async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' },
        { id: '3', name: 'Gamma' },
      ],
      total: 3,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        multiple
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    // Select two records
    await act(async () => {
      fireEvent.click(screen.getByTestId('record-row-1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('record-row-3'));
    });

    // Should show selection count
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Click confirm
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm'));
    });

    expect(onSelect).toHaveBeenCalledWith(expect.arrayContaining(['1', '3']));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders pagination with page navigation', async () => {
    mockDataSource.find.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Record ${i + 1}`,
      })),
      total: 25,
    });

    render(<RecordPickerDialog {...basePickerProps} pageSize={10} />);

    await waitFor(() => {
      expect(screen.getByTestId('record-picker-pagination')).toBeInTheDocument();
      expect(screen.getByText(/25 records/)).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    });

    // Navigate to next page
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Next page'));
    });

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('customers', {
        $top: 10,
        $skip: 10,
      });
    });
  });

  it('sends search query to DataSource with debounce', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(<RecordPickerDialog {...basePickerProps} />);

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledTimes(1);
    });

    // Type in search
    await act(async () => {
      fireEvent.change(screen.getByTestId('record-picker-search'), {
        target: { value: 'acme' },
      });
    });

    // Wait for debounce
    await waitFor(
      () => {
        expect(mockDataSource.find).toHaveBeenCalledWith('customers', {
          $top: 10,
          $skip: 0,
          $search: 'acme',
        });
      },
      { timeout: 500 },
    );
  });

  it('supports custom column definitions with labels', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Acme', total_amount: 5000 },
      ],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={[
          { field: 'name', label: 'Customer Name' },
          { field: 'total_amount', label: 'Total' },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Customer Name')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Acme')).toBeInTheDocument();
      expect(screen.getByText('5000')).toBeInTheDocument();
    });
  });

  it('auto-infers column from displayField when no columns specified', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', full_name: 'John Doe' }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        displayField="full_name"
      />,
    );

    await waitFor(() => {
      // Auto-inferred header from field name
      expect(screen.getByText('Full Name')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});

// ------------- LookupField — Show All Results Integration -------------

describe('LookupField — Show All Results', () => {
  const mockField = {
    name: 'customer',
    label: 'Customer',
    reference_to: 'customers',
    reference_field: 'name',
  } as any;

  const baseProps: FieldWidgetProps<any> = {
    field: mockField,
    value: undefined,
    onChange: vi.fn(),
    readonly: false,
    dataSource: mockDataSource as any,
  };

  it('shows "Show All Results" button when total exceeds displayed count', async () => {
    mockDataSource.find.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        name: `Customer ${i}`,
      })),
      total: 200,
    });

    render(<LookupField {...baseProps} />);

    // Open dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('show-all-results')).toBeInTheDocument();
      expect(screen.getByText(/Show All Results \(200\)/)).toBeInTheDocument();
    });
  });

  it('does not show "Show All Results" when all results fit in popover', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Acme Corp' },
        { id: '2', name: 'Beta Inc' },
      ],
      total: 2,
    });

    render(<LookupField {...baseProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('show-all-results')).not.toBeInTheDocument();
  });

  it('opens RecordPickerDialog when "Show All Results" is clicked', async () => {
    mockDataSource.find.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        name: `Customer ${i}`,
      })),
      total: 200,
    });

    render(<LookupField {...baseProps} />);

    // Open quick-select dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('show-all-results')).toBeInTheDocument();
    });

    // Click "Show All Results"
    await act(async () => {
      fireEvent.click(screen.getByTestId('show-all-results'));
    });

    // RecordPickerDialog should now be open
    await waitFor(() => {
      expect(screen.getByTestId('record-picker-dialog')).toBeInTheDocument();
    });
  });

  it('passes lookup_columns to RecordPickerDialog', async () => {
    const fieldWithColumns = {
      ...mockField,
      lookup_columns: ['name', 'email', 'status'],
    } as any;

    mockDataSource.find.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        name: `Customer ${i}`,
        email: `customer${i}@test.com`,
        status: 'active',
      })),
      total: 200,
    });

    render(
      <LookupField
        {...baseProps}
        field={fieldWithColumns}
      />,
    );

    // Open quick-select dialog
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('show-all-results')).toBeInTheDocument();
    });

    // Open Record Picker
    await act(async () => {
      fireEvent.click(screen.getByTestId('show-all-results'));
    });

    // Wait for RecordPickerDialog to render with column headers
    await waitFor(() => {
      expect(screen.getByTestId('record-picker-dialog')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });
});

// ------------- LookupField — Browse All Button (Always Visible) -------------

describe('LookupField — Browse All Button', () => {
  const mockField = {
    name: 'customer',
    label: 'Customer',
    reference_to: 'customers',
    reference_field: 'name',
  } as any;

  const baseProps: FieldWidgetProps<any> = {
    field: mockField,
    value: undefined,
    onChange: vi.fn(),
    readonly: false,
    dataSource: mockDataSource as any,
  };

  it('renders "Browse All" button when dataSource is available, even with <5 records', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' },
        { id: '3', name: 'Gamma' },
      ],
      total: 3,
    });

    render(<LookupField {...baseProps} />);

    // "Browse All" button should always be visible (not inside popover)
    expect(screen.getByTestId('browse-all-records')).toBeInTheDocument();
    expect(screen.getByLabelText('Browse all records')).toBeInTheDocument();
  });

  it('opens RecordPickerDialog when "Browse All" is clicked with small dataset', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' },
      ],
      total: 2,
    });

    render(<LookupField {...baseProps} />);

    // Click "Browse All" button directly (no need to open popover first)
    await act(async () => {
      fireEvent.click(screen.getByTestId('browse-all-records'));
    });

    // RecordPickerDialog should now be open
    await waitFor(() => {
      expect(screen.getByTestId('record-picker-dialog')).toBeInTheDocument();
    });
  });

  it('does not render "Browse All" button when no dataSource is available', () => {
    const propsWithoutDS: FieldWidgetProps<any> = {
      field: { ...mockField, options: [{ value: '1', label: 'Opt 1' }] } as any,
      value: undefined,
      onChange: vi.fn(),
      readonly: false,
    };

    render(<LookupField {...propsWithoutDS} />);

    expect(screen.queryByTestId('browse-all-records')).not.toBeInTheDocument();
  });
});

// ------------- RecordPickerDialog — Column Sorting -------------

describe('RecordPickerDialog — Column Sorting', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('sends $orderby when a column header is clicked', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Acme Corp', email: 'acme@test.com' },
        { id: '2', name: 'Beta Inc', email: 'beta@test.com' },
      ],
      total: 2,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name', 'email']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    // Click the "Name" column header to sort
    await act(async () => {
      fireEvent.click(screen.getByText('Name'));
    });

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('customers', {
        $top: 10,
        $skip: 0,
        $orderby: { name: 'asc' },
      });
    });
  });

  it('toggles sort direction on repeated column header click', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Acme Corp' }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    // First click: asc
    await act(async () => {
      fireEvent.click(screen.getByText('Name'));
    });

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('customers', expect.objectContaining({
        $orderby: { name: 'asc' },
      }));
    });

    // Second click: desc
    await act(async () => {
      fireEvent.click(screen.getByText('Name'));
    });

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('customers', expect.objectContaining({
        $orderby: { name: 'desc' },
      }));
    });
  });

  it('renders sort indicators on column headers', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Acme', email: 'test@test.com' }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name', 'email']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument();
    });

    // Column headers should have aria-sort="none" initially
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');

    // Click to sort
    await act(async () => {
      fireEvent.click(screen.getByText('Name'));
    });

    await waitFor(() => {
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    });
  });
});

// ------------- RecordPickerDialog — Keyboard Navigation -------------

describe('RecordPickerDialog — Keyboard Navigation', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('navigates rows with arrow keys and selects with Enter', async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' },
        { id: '3', name: 'Gamma' },
      ],
      total: 3,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        onSelect={onSelect}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    // Focus the table container (has role="grid")
    const gridContainer = screen.getByRole('grid');
    gridContainer.focus();

    // Arrow down twice: -1 → 0 (Alpha) → 1 (Beta)
    await act(async () => {
      fireEvent.keyDown(gridContainer, { key: 'ArrowDown' });
    });
    await act(async () => {
      fireEvent.keyDown(gridContainer, { key: 'ArrowDown' });
    });

    // Press Enter to select Beta
    await act(async () => {
      fireEvent.keyDown(gridContainer, { key: 'Enter' });
    });

    expect(onSelect).toHaveBeenCalledWith('2');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders responsive dialog with mobile-friendly width', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(<RecordPickerDialog {...basePickerProps} />);

    await waitFor(() => {
      const dialog = screen.getByTestId('record-picker-dialog');
      expect(dialog).toBeInTheDocument();
      // Check responsive classes are applied
      expect(dialog.className).toContain('w-[95vw]');
    });
  });
});

// ------------- RecordPickerDialog — lookup_filters consumption -------------

describe('RecordPickerDialog — lookup_filters', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('injects lookup_filters into $filter on every query', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Active Customer' }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        lookupFilters={[
          { field: 'status', operator: 'eq', value: 'active' },
        ]}
      />,
    );

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('customers', {
        $top: 10,
        $skip: 0,
        $filter: { status: 'active' },
      });
    });
  });

  it('supports multiple lookup_filters with different operators', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        lookupFilters={[
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'category', operator: 'in', value: ['A', 'B'] },
          { field: 'amount', operator: 'gte', value: 100 },
        ]}
      />,
    );

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('customers', {
        $top: 10,
        $skip: 0,
        $filter: {
          status: 'active',
          category: { $in: ['A', 'B'] },
          amount: { $gte: 100 },
        },
      });
    });
  });

  it('preserves lookup_filters when search query is added', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        lookupFilters={[
          { field: 'status', operator: 'eq', value: 'active' },
        ]}
      />,
    );

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledTimes(1);
    });

    // Type in search
    await act(async () => {
      fireEvent.change(screen.getByTestId('record-picker-search'), {
        target: { value: 'acme' },
      });
    });

    // Wait for debounce
    await waitFor(
      () => {
        expect(mockDataSource.find).toHaveBeenCalledWith('customers', {
          $top: 10,
          $skip: 0,
          $search: 'acme',
          $filter: { status: 'active' },
        });
      },
      { timeout: 500 },
    );
  });
});

// ------------- RecordPickerDialog — Cell Type Formatter -------------

describe('RecordPickerDialog — Cell Type Formatter', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'items',
    onSelect: vi.fn(),
  };

  it('uses cellRenderer for columns with type defined', async () => {
    const mockCellRenderer = vi.fn().mockReturnValue(
      ({ value }: { value: any }) => <span data-testid="custom-rendered">{`FORMATTED:${value}`}</span>,
    );

    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Widget', amount: 99.5 }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={[
          { field: 'name', label: 'Name' },
          { field: 'amount', label: 'Amount', type: 'currency' },
        ]}
        cellRenderer={mockCellRenderer}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Widget')).toBeInTheDocument();
    });

    // cellRenderer should have been called for the 'currency' type
    expect(mockCellRenderer).toHaveBeenCalledWith('currency');

    // The formatted cell should be in the document
    expect(screen.getByTestId('custom-rendered')).toBeInTheDocument();
    expect(screen.getByText('FORMATTED:99.5')).toBeInTheDocument();
  });

  it('falls back to plain text when no cellRenderer is provided', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Widget', active: true }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={[
          { field: 'name' },
          { field: 'active', type: 'boolean' },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Widget')).toBeInTheDocument();
      // Without cellRenderer, boolean should render as 'Yes'
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
  });

  it('falls back to plain text when column has no type', async () => {
    const mockCellRenderer = vi.fn();

    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Widget' }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={[{ field: 'name' }]}
        cellRenderer={mockCellRenderer}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Widget')).toBeInTheDocument();
    });

    // cellRenderer should NOT be called for columns without type
    expect(mockCellRenderer).not.toHaveBeenCalled();
  });
});

// ------------- RecordPickerDialog — FilterUI bar integration -------------

describe('RecordPickerDialog — Filter Bar', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('renders filter bar toggle when filterColumns are provided', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        filterColumns={[
          { field: 'status', label: 'Status', type: 'text' },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('record-picker-filter-bar')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });

  it('does not render filter bar when no filterColumns', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(<RecordPickerDialog {...basePickerProps} />);

    await waitFor(() => {
      expect(screen.queryByTestId('record-picker-filter-bar')).not.toBeInTheDocument();
    });
  });

  it('opens filter panel on toggle click', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        filterColumns={[
          { field: 'name', label: 'Name', type: 'text' },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('record-picker-filter-bar')).toBeInTheDocument();
    });

    // Filter panel should not be visible yet
    expect(screen.queryByTestId('record-picker-filter-panel')).not.toBeInTheDocument();

    // Click Filters button
    await act(async () => {
      fireEvent.click(screen.getByText('Filters'));
    });

    expect(screen.getByTestId('record-picker-filter-panel')).toBeInTheDocument();
  });
});

// ------------- RecordPickerDialog — Column Resize Handles -------------

describe('RecordPickerDialog — Column Resize', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('renders resize handles on column headers', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Test', email: 'test@test.com' }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name', 'email']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    // Resize handles should be present
    expect(screen.getByTestId('resize-handle-name')).toBeInTheDocument();
    expect(screen.getByTestId('resize-handle-email')).toBeInTheDocument();
  });

  it('resize handles have col-resize cursor and separator role', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Test' }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    const handle = screen.getByTestId('resize-handle-name');
    expect(handle).toHaveAttribute('role', 'separator');
    expect(handle.className).toContain('cursor-col-resize');
  });
});

// ------------- RecordPickerDialog — renderFilterBar slot (FilterUI integration) ---

describe('RecordPickerDialog — renderFilterBar slot', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('calls renderFilterBar with correct props when provided', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    const renderFilterBar = vi.fn().mockReturnValue(
      <div data-testid="custom-filter-bar">Custom FilterUI</div>,
    );

    render(
      <RecordPickerDialog
        {...basePickerProps}
        filterColumns={[
          { field: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }] },
        ]}
        renderFilterBar={renderFilterBar}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('custom-filter-bar')).toBeInTheDocument();
    });

    // renderFilterBar should have been called with FilterBarProps
    expect(renderFilterBar).toHaveBeenCalledWith(
      expect.objectContaining({
        filterColumns: expect.arrayContaining([
          expect.objectContaining({ field: 'status', type: 'select' }),
        ]),
        values: {},
        onChange: expect.any(Function),
        onClear: expect.any(Function),
        activeCount: 0,
      }),
    );
  });

  it('hides built-in filter bar when renderFilterBar is provided', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        filterColumns={[{ field: 'name', label: 'Name', type: 'text' }]}
        renderFilterBar={() => <div data-testid="external-filter">External</div>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('external-filter')).toBeInTheDocument();
    });

    // Built-in filter panel toggle button should NOT be present
    expect(screen.queryByTestId('record-picker-filter-panel')).not.toBeInTheDocument();
  });
});

// ------------- RecordPickerDialog — renderGrid slot (ObjectGrid reuse) ---

describe('RecordPickerDialog — renderGrid slot', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('renders external grid component via renderGrid slot', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Acme Corp' }],
      total: 1,
    });

    const renderGrid = vi.fn().mockReturnValue(
      <div data-testid="custom-grid">Custom ObjectGrid</div>,
    );

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name']}
        renderGrid={renderGrid}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('record-picker-grid-slot')).toBeInTheDocument();
      expect(screen.getByTestId('custom-grid')).toBeInTheDocument();
    });

    // renderGrid should have been called with grid slot props
    expect(renderGrid).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ field: 'name' }),
        ]),
        records: expect.arrayContaining([
          expect.objectContaining({ id: '1', name: 'Acme Corp' }),
        ]),
        loading: false,
        totalCount: 1,
        currentPage: 1,
        pageSize: 10,
        sortField: null,
        sortDirection: 'asc',
        onSort: expect.any(Function),
        onPageChange: expect.any(Function),
        onRowClick: expect.any(Function),
        isSelected: expect.any(Function),
        multiple: false,
        idField: 'id',
      }),
    );
  });

  it('hides built-in table when renderGrid is provided', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Acme Corp' }],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name']}
        renderGrid={() => <div>Custom Grid</div>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Custom Grid')).toBeInTheDocument();
    });

    // Built-in table should NOT be present
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    // Built-in pagination should NOT be present
    expect(screen.queryByTestId('record-picker-pagination')).not.toBeInTheDocument();
  });
});

// ------------- RecordPickerDialog — Auto-generated filterColumns from lookupFilters ---

describe('RecordPickerDialog — Auto-generated filter bar from lookupFilters', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('auto-generates filter bar from lookupFilters when no filterColumns given', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        lookupFilters={[
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'amount', operator: 'gte', value: 100 },
        ]}
      />,
    );

    await waitFor(() => {
      // Filter bar should appear because lookupFilters auto-generate filterColumns
      expect(screen.getByTestId('record-picker-filter-bar')).toBeInTheDocument();
    });
  });

  it('prefers explicit filterColumns over auto-generated ones', async () => {
    mockDataSource.find.mockResolvedValue({ data: [], total: 0 });

    const renderFilterBar = vi.fn().mockReturnValue(<div>Filters</div>);

    render(
      <RecordPickerDialog
        {...basePickerProps}
        lookupFilters={[{ field: 'status', operator: 'eq', value: 'active' }]}
        filterColumns={[{ field: 'custom_field', label: 'Custom', type: 'text' }]}
        renderFilterBar={renderFilterBar}
      />,
    );

    await waitFor(() => {
      expect(renderFilterBar).toHaveBeenCalled();
    });

    // Should use the explicit filterColumns, not auto-generated ones
    const calledProps = renderFilterBar.mock.calls[0][0];
    expect(calledProps.filterColumns[0].field).toBe('custom_field');
  });
});

// ------------- RecordPickerDialog — Skeleton Loading Screen -------------

describe('RecordPickerDialog — Skeleton Loading', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('renders skeleton table with correct number of rows during initial load', async () => {
    mockDataSource.find.mockReturnValue(new Promise(() => {}));

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name', 'email']}
      />,
    );

    await waitFor(() => {
      const skeleton = screen.getByTestId('record-picker-skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('role', 'status');
      // Should contain skeleton placeholders (animated pulse divs)
      const pulses = skeleton.querySelectorAll('.animate-pulse');
      // 2 header skeletons + 5 rows × 2 columns = 12 total skeleton elements
      expect(pulses.length).toBe(12);
    });
  });

  it('shows skeleton columns matching the provided column count', async () => {
    mockDataSource.find.mockReturnValue(new Promise(() => {}));

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name', 'email', 'status']}
      />,
    );

    await waitFor(() => {
      const skeleton = screen.getByTestId('record-picker-skeleton');
      expect(skeleton).toBeInTheDocument();
      // 3 header skeletons + 5 rows × 3 columns = 18 total skeleton elements
      const pulses = skeleton.querySelectorAll('.animate-pulse');
      expect(pulses.length).toBe(18);
    });
  });
});

// ------------- RecordPickerDialog — Sticky Table Header -------------

describe('RecordPickerDialog — Sticky Header', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('renders table header with sticky positioning', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [
        { id: '1', name: 'Acme Corp', email: 'acme@test.com' },
      ],
      total: 1,
    });

    render(
      <RecordPickerDialog
        {...basePickerProps}
        columns={['name', 'email']}
      />,
    );

    await waitFor(() => {
      const stickyHeader = screen.getByTestId('record-picker-sticky-header');
      expect(stickyHeader).toBeInTheDocument();
      expect(stickyHeader.className).toContain('sticky');
      expect(stickyHeader.className).toContain('top-0');
    });
  });
});

// ------------- RecordPickerDialog — Page Jump Input -------------

describe('RecordPickerDialog — Page Jump', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('renders page jump input when multiple pages exist', async () => {
    mockDataSource.find.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Record ${i + 1}`,
      })),
      total: 50,
    });

    render(<RecordPickerDialog {...basePickerProps} pageSize={10} />);

    await waitFor(() => {
      expect(screen.getByTestId('record-picker-page-jump')).toBeInTheDocument();
    });
  });

  it('navigates to specified page on Enter key', async () => {
    mockDataSource.find.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Record ${i + 1}`,
      })),
      total: 50,
    });

    render(<RecordPickerDialog {...basePickerProps} pageSize={10} />);

    await waitFor(() => {
      expect(screen.getByTestId('record-picker-page-jump')).toBeInTheDocument();
    });

    const pageInput = screen.getByTestId('record-picker-page-jump');

    // Type page number and press Enter
    await act(async () => {
      fireEvent.change(pageInput, { target: { value: '3' } });
    });
    await act(async () => {
      fireEvent.keyDown(pageInput, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('customers', {
        $top: 10,
        $skip: 20,
      });
    });
  });

  it('ignores invalid page numbers', async () => {
    mockDataSource.find.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Record ${i + 1}`,
      })),
      total: 50,
    });

    render(<RecordPickerDialog {...basePickerProps} pageSize={10} />);

    await waitFor(() => {
      expect(screen.getByTestId('record-picker-page-jump')).toBeInTheDocument();
    });

    const callCount = mockDataSource.find.mock.calls.length;

    // Type invalid page number and press Enter
    const pageInput = screen.getByTestId('record-picker-page-jump');
    await act(async () => {
      fireEvent.change(pageInput, { target: { value: '99' } });
    });
    await act(async () => {
      fireEvent.keyDown(pageInput, { key: 'Enter' });
    });

    // Should not trigger a new fetch since page 99 > totalPages (5)
    expect(mockDataSource.find).toHaveBeenCalledTimes(callCount);
  });

  it('does not render page jump when only one page', async () => {
    mockDataSource.find.mockResolvedValue({
      data: [{ id: '1', name: 'Record 1' }],
      total: 1,
    });

    render(<RecordPickerDialog {...basePickerProps} pageSize={10} />);

    await waitFor(() => {
      expect(screen.getByText('Record 1')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('record-picker-page-jump')).not.toBeInTheDocument();
  });
});

// ------------- RecordPickerDialog — Loading Overlay for Subsequent Fetches -------------

describe('RecordPickerDialog — Loading Overlay', () => {
  const basePickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    dataSource: mockDataSource as any,
    objectName: 'customers',
    onSelect: vi.fn(),
  };

  it('shows loading overlay when fetching next page while records are visible', async () => {
    // First load: resolves immediately
    mockDataSource.find.mockResolvedValueOnce({
      data: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Record ${i + 1}`,
      })),
      total: 25,
    });

    render(<RecordPickerDialog {...basePickerProps} pageSize={10} />);

    await waitFor(() => {
      expect(screen.getByText('Record 1')).toBeInTheDocument();
    });

    // Set up next page to hang (never resolves)
    mockDataSource.find.mockReturnValue(new Promise(() => {}));

    // Navigate to next page
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Next page'));
    });

    // Loading overlay should appear over existing records
    await waitFor(() => {
      expect(screen.getByTestId('record-picker-loading-overlay')).toBeInTheDocument();
    });
  });
});
