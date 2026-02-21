/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ViewDesigner } from '../ViewDesigner';
import type { ViewDesignerColumn } from '@object-ui/types';

const MOCK_FIELDS = [
  { name: 'name', label: 'Name', type: 'text' },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'status', label: 'Status', type: 'select' },
  { name: 'created_at', label: 'Created', type: 'date' },
  { name: 'age', label: 'Age', type: 'number' },
];

describe('ViewDesigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // Basic Rendering
  // ============================
  describe('Basic Rendering', () => {
    it('should render with minimal props', () => {
      render(<ViewDesigner objectName="contacts" />);

      expect(screen.getByText('View Designer')).toBeDefined();
      expect(screen.getByText('— contacts')).toBeDefined();
    });

    it('should render the toolbar with save and cancel buttons', () => {
      const onSave = vi.fn();
      const onCancel = vi.fn();

      render(
        <ViewDesigner
          objectName="contacts"
          onSave={onSave}
          onCancel={onCancel}
        />,
      );

      expect(screen.getByTestId('view-designer-save')).toBeDefined();
      expect(screen.getByTestId('view-designer-cancel')).toBeDefined();
    });

    it('should render view label input', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          viewLabel="My View"
        />,
      );

      const input = screen.getByTestId('view-label-input') as HTMLInputElement;
      expect(input.value).toBe('My View');
    });

    it('should render view type selector', () => {
      render(<ViewDesigner objectName="contacts" viewType="kanban" />);

      const kanbanBtn = screen.getByTestId('view-type-kanban');
      expect(kanbanBtn.className).toContain('border-primary');
    });

    it('should show empty state when no columns added', () => {
      render(<ViewDesigner objectName="contacts" />);

      expect(screen.getByText('No columns added yet. Select fields from the palette to add columns.')).toBeDefined();
    });
  });

  // ============================
  // Field Palette
  // ============================
  describe('Field Palette', () => {
    it('should render available fields', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
        />,
      );

      expect(screen.getByText('Available Fields')).toBeDefined();
      expect(screen.getByTestId('field-name')).toBeDefined();
      expect(screen.getByTestId('field-email')).toBeDefined();
    });

    it('should add column when clicking a field', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByTestId('field-name'));

      // Column should appear in the layout
      expect(screen.getByTestId('column-name')).toBeDefined();
    });

    it('should hide added fields from palette', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
          columns={[{ field: 'name', label: 'Name', visible: true, order: 0 }]}
        />,
      );

      // 'name' should not be in the palette since it's already a column
      expect(screen.queryByTestId('field-name')).toBeNull();
      // But 'email' should still be available
      expect(screen.getByTestId('field-email')).toBeDefined();
    });

    it('should show "All fields added" when all fields are used', () => {
      const columns: ViewDesignerColumn[] = MOCK_FIELDS.map((f, i) => ({
        field: f.name,
        label: f.label,
        visible: true,
        order: i,
      }));

      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
          columns={columns}
        />,
      );

      expect(screen.getByText('All fields added')).toBeDefined();
    });

    it('should hide palette in read-only mode', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
          readOnly
        />,
      );

      expect(screen.queryByText('Available Fields')).toBeNull();
    });
  });

  // ============================
  // Column Management
  // ============================
  describe('Column Management', () => {
    it('should render initial columns', () => {
      const columns: ViewDesignerColumn[] = [
        { field: 'name', label: 'Name', visible: true, order: 0 },
        { field: 'email', label: 'Email', visible: true, order: 1 },
      ];

      render(
        <ViewDesigner
          objectName="contacts"
          columns={columns}
          availableFields={MOCK_FIELDS}
        />,
      );

      expect(screen.getByTestId('column-name')).toBeDefined();
      expect(screen.getByTestId('column-email')).toBeDefined();
      expect(screen.getByText('Columns (2)')).toBeDefined();
    });

    it('should remove column when clicking delete', async () => {
      const columns: ViewDesignerColumn[] = [
        { field: 'name', label: 'Name', visible: true, order: 0 },
        { field: 'email', label: 'Email', visible: true, order: 1 },
      ];

      render(
        <ViewDesigner
          objectName="contacts"
          columns={columns}
          availableFields={MOCK_FIELDS}
        />,
      );

      // Click delete on the first column
      const nameColumn = screen.getByTestId('column-name');
      const deleteBtn = nameColumn.querySelector('[title="Remove column"]') as HTMLElement;
      fireEvent.click(deleteBtn);

      // Confirm the deletion dialog
      await waitFor(() => {
        const confirmBtn = screen.getByText('Delete');
        fireEvent.click(confirmBtn);
      });

      // Name column should be removed
      await waitFor(() => {
        expect(screen.queryByTestId('column-name')).toBeNull();
      });
      expect(screen.getByTestId('column-email')).toBeDefined();
    });
  });

  // ============================
  // View Type Selection
  // ============================
  describe('View Type Selection', () => {
    it('should default to grid type', () => {
      render(<ViewDesigner objectName="contacts" />);

      const gridBtn = screen.getByTestId('view-type-grid');
      expect(gridBtn.className).toContain('border-primary');
    });

    it('should change view type on click', () => {
      render(<ViewDesigner objectName="contacts" />);

      fireEvent.click(screen.getByTestId('view-type-kanban'));

      const kanbanBtn = screen.getByTestId('view-type-kanban');
      expect(kanbanBtn.className).toContain('border-primary');

      const gridBtn = screen.getByTestId('view-type-grid');
      expect(gridBtn.className).not.toContain('bg-primary');
    });

    it('should not change type in read-only mode', () => {
      render(<ViewDesigner objectName="contacts" viewType="grid" readOnly />);

      fireEvent.click(screen.getByTestId('view-type-kanban'));

      // Grid should still be selected
      const gridBtn = screen.getByTestId('view-type-grid');
      expect(gridBtn.className).toContain('border-primary');
    });
  });

  // ============================
  // Save and Cancel
  // ============================
  describe('Save and Cancel', () => {
    it('should call onSave with view config', () => {
      const onSave = vi.fn();
      const columns: ViewDesignerColumn[] = [
        { field: 'name', label: 'Name', visible: true, order: 0 },
      ];

      render(
        <ViewDesigner
          objectName="contacts"
          viewLabel="All Contacts"
          viewType="grid"
          columns={columns}
          onSave={onSave}
        />,
      );

      fireEvent.click(screen.getByTestId('view-designer-save'));

      expect(onSave).toHaveBeenCalledTimes(1);
      const config = onSave.mock.calls[0][0];
      expect(config.viewLabel).toBe('All Contacts');
      expect(config.viewType).toBe('grid');
      expect(config.columns).toEqual(columns);
    });

    it('should use object name as default label when label is empty', () => {
      const onSave = vi.fn();

      render(
        <ViewDesigner
          objectName="contacts"
          onSave={onSave}
        />,
      );

      fireEvent.click(screen.getByTestId('view-designer-save'));

      const config = onSave.mock.calls[0][0];
      expect(config.viewLabel).toBe('contacts View');
    });

    it('should call onCancel when cancel is clicked', () => {
      const onCancel = vi.fn();

      render(
        <ViewDesigner
          objectName="contacts"
          onCancel={onCancel}
        />,
      );

      fireEvent.click(screen.getByTestId('view-designer-cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should not render save/cancel in read-only mode', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          onSave={vi.fn()}
          onCancel={vi.fn()}
          readOnly
        />,
      );

      expect(screen.queryByTestId('view-designer-save')).toBeNull();
      expect(screen.queryByTestId('view-designer-cancel')).toBeNull();
    });
  });

  // ============================
  // Filters Tab
  // ============================
  describe('Filters', () => {
    it('should show add filter button in filters tab', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
        />,
      );

      // Switch to filters tab
      fireEvent.click(screen.getByText('filters'));

      expect(screen.getByTestId('add-filter')).toBeDefined();
    });

    it('should add a filter when clicking add filter', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByText('filters'));
      fireEvent.click(screen.getByTestId('add-filter'));

      expect(screen.getByTestId('filter-0')).toBeDefined();
    });

    it('should render initial filters', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
          filters={[{ field: 'status', operator: 'equals', value: 'active' }]}
        />,
      );

      fireEvent.click(screen.getByText('filters'));

      expect(screen.getByTestId('filter-0')).toBeDefined();
    });
  });

  // ============================
  // Sort Tab
  // ============================
  describe('Sort', () => {
    it('should show add sort button in sort tab', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByText('sort'));

      expect(screen.getByTestId('add-sort')).toBeDefined();
    });

    it('should add a sort entry when clicking add sort', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByText('sort'));
      fireEvent.click(screen.getByTestId('add-sort'));

      expect(screen.getByTestId('sort-0')).toBeDefined();
    });

    it('should render initial sort configuration', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
          sort={[{ field: 'name', direction: 'asc' }]}
        />,
      );

      fireEvent.click(screen.getByText('sort'));

      expect(screen.getByTestId('sort-0')).toBeDefined();
    });
  });

  // ============================
  // Options Tab
  // ============================
  describe('Options', () => {
    it('should show grid options by default', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByText('options'));

      expect(screen.getByText('Grid Options')).toBeDefined();
      expect(screen.getByText('Grid view uses the columns configured above.')).toBeDefined();
    });

    it('should show kanban options when kanban type selected', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          viewType="kanban"
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByText('options'));

      expect(screen.getByText('Kanban Options')).toBeDefined();
      expect(screen.getByTestId('kanban-group-by')).toBeDefined();
    });

    it('should show calendar options when calendar type selected', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          viewType="calendar"
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByText('options'));

      expect(screen.getByText('Calendar Options')).toBeDefined();
      expect(screen.getByTestId('calendar-start-date')).toBeDefined();
      expect(screen.getByTestId('calendar-title-field')).toBeDefined();
    });
  });

  // ============================
  // Edit Existing View
  // ============================
  describe('Edit Existing View', () => {
    it('should populate with existing view data', () => {
      render(
        <ViewDesigner
          objectName="contacts"
          viewId="all"
          viewLabel="All Contacts"
          viewType="grid"
          columns={[
            { field: 'name', label: 'Name', visible: true, order: 0 },
            { field: 'email', label: 'Email', visible: true, order: 1 },
          ]}
          availableFields={MOCK_FIELDS}
        />,
      );

      const labelInput = screen.getByTestId('view-label-input') as HTMLInputElement;
      expect(labelInput.value).toBe('All Contacts');
      expect(screen.getByTestId('column-name')).toBeDefined();
      expect(screen.getByTestId('column-email')).toBeDefined();
    });

    it('should include viewId in save callback', () => {
      const onSave = vi.fn();

      render(
        <ViewDesigner
          objectName="contacts"
          viewId="existing-view"
          viewLabel="Existing"
          onSave={onSave}
        />,
      );

      fireEvent.click(screen.getByTestId('view-designer-save'));

      const config = onSave.mock.calls[0][0];
      expect(config.viewId).toBe('existing-view');
    });
  });

  // ============================
  // Ctrl+S Keyboard Shortcut
  // ============================
  describe('Keyboard Shortcut: Ctrl+S', () => {
    it('should call onSave when Ctrl+S is pressed', () => {
      const onSave = vi.fn();

      const { container } = render(
        <ViewDesigner
          objectName="contacts"
          viewLabel="My View"
          onSave={onSave}
        />,
      );

      // Focus the container
      const root = container.firstElementChild as HTMLElement;
      root.focus();

      fireEvent.keyDown(root, { key: 's', ctrlKey: true });

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave.mock.calls[0][0].viewLabel).toBe('My View');
    });

    it('should not trigger save in read-only mode on Ctrl+S', () => {
      const onSave = vi.fn();

      const { container } = render(
        <ViewDesigner
          objectName="contacts"
          onSave={onSave}
          readOnly
        />,
      );

      const root = container.firstElementChild as HTMLElement;
      root.focus();

      fireEvent.keyDown(root, { key: 's', ctrlKey: true });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // ============================
  // Field Type Selector
  // ============================
  describe('Field Type Selector', () => {
    it('should render field type dropdown when column is selected', () => {
      const columns = [
        { field: 'name', label: 'Name', visible: true, order: 0 },
      ];

      render(
        <ViewDesigner
          objectName="contacts"
          columns={columns}
          availableFields={MOCK_FIELDS}
        />,
      );

      // Click the column to select it
      fireEvent.click(screen.getByTestId('column-name'));

      expect(screen.getByTestId('column-field-type')).toBeDefined();
    });

    it('should show field type options', () => {
      const columns = [
        { field: 'name', label: 'Name', visible: true, order: 0 },
      ];

      render(
        <ViewDesigner
          objectName="contacts"
          columns={columns}
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByTestId('column-name'));

      const select = screen.getByTestId('column-field-type') as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toContain('text');
      expect(options).toContain('number');
      expect(options).toContain('date');
      expect(options).toContain('email');
    });
  });

  // ============================
  // Column Width Validation
  // ============================
  describe('Column Width Validation', () => {
    it('should show width hint text', () => {
      const columns = [
        { field: 'name', label: 'Name', visible: true, order: 0 },
      ];

      render(
        <ViewDesigner
          objectName="contacts"
          columns={columns}
          availableFields={MOCK_FIELDS}
        />,
      );

      fireEvent.click(screen.getByTestId('column-name'));

      expect(screen.getByText(/50–1000px/)).toBeDefined();
    });

    it('should accept auto as width value', () => {
      const onSave = vi.fn();
      const columns = [
        { field: 'name', label: 'Name', visible: true, order: 0 },
      ];

      render(
        <ViewDesigner
          objectName="contacts"
          columns={columns}
          availableFields={MOCK_FIELDS}
          onSave={onSave}
        />,
      );

      fireEvent.click(screen.getByTestId('column-name'));
      const widthInput = screen.getByTestId('column-width-input') as HTMLInputElement;
      fireEvent.change(widthInput, { target: { value: 'auto' } });

      fireEvent.click(screen.getByTestId('view-designer-save'));
      const config = onSave.mock.calls[0][0];
      expect(config.columns[0].width).toBe('auto');
    });

    it('should clamp numeric width to min/max range', () => {
      const onSave = vi.fn();
      const columns = [
        { field: 'name', label: 'Name', visible: true, order: 0 },
      ];

      render(
        <ViewDesigner
          objectName="contacts"
          columns={columns}
          availableFields={MOCK_FIELDS}
          onSave={onSave}
        />,
      );

      fireEvent.click(screen.getByTestId('column-name'));
      const widthInput = screen.getByTestId('column-width-input') as HTMLInputElement;

      // Set to value below min (50)
      fireEvent.change(widthInput, { target: { value: '10' } });

      fireEvent.click(screen.getByTestId('view-designer-save'));
      const config = onSave.mock.calls[0][0];
      expect(config.columns[0].width).toBe(50);
    });
  });
});
