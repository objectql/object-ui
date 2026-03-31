/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FieldDesigner } from '../FieldDesigner';
import type { DesignerFieldDefinition } from '@object-ui/types';

// Mock standard components — tested separately in their own packages
vi.mock('@object-ui/plugin-grid', () => import('./__mocks__/plugin-grid'));

const MOCK_FIELDS: DesignerFieldDefinition[] = [
  {
    id: 'fld-1',
    name: 'name',
    label: 'Name',
    type: 'text',
    group: 'Basic Info',
    sortOrder: 1,
    required: true,
    isSystem: false,
  },
  {
    id: 'fld-2',
    name: 'email',
    label: 'Email',
    type: 'email',
    group: 'Basic Info',
    sortOrder: 2,
    required: true,
    unique: true,
    isSystem: false,
  },
  {
    id: 'fld-3',
    name: 'status',
    label: 'Status',
    type: 'select',
    group: 'Details',
    sortOrder: 1,
    options: [
      { label: 'Active', value: 'active', color: 'green' },
      { label: 'Inactive', value: 'inactive', color: 'gray' },
    ],
    isSystem: false,
  },
  {
    id: 'fld-4',
    name: 'id',
    label: 'ID',
    type: 'text',
    isSystem: true,
    externalId: true,
  },
  {
    id: 'fld-5',
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    hidden: true,
    trackHistory: true,
    isSystem: false,
  },
];

describe('FieldDesigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // Rendering
  // ============================
  describe('Rendering', () => {
    it('should render the field designer container', () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      expect(screen.getByTestId('field-designer')).toBeDefined();
    });

    it('should render the ObjectGrid with field data', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        expect(screen.getByTestId('mock-object-grid')).toBeDefined();
      });
    });

    it('should render all fields as grid rows', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        expect(screen.getByTestId('grid-row-fld-1')).toBeDefined();
        expect(screen.getByTestId('grid-row-fld-2')).toBeDefined();
        expect(screen.getByTestId('grid-row-fld-3')).toBeDefined();
      });
    });

    it('should render type filter dropdown', () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      expect(screen.getByTestId('field-designer-type-filter')).toBeDefined();
    });

    it('should display object name in header', () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      expect(screen.getByText('— accounts')).toBeDefined();
    });

    it('should show the title with field count', () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      expect(screen.getByText('Field Designer')).toBeDefined();
      expect(screen.getByText('5')).toBeDefined();
    });
  });

  // ============================
  // Adding Fields
  // ============================
  describe('Adding Fields', () => {
    it('should render the add button via ObjectGrid onAddRecord', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        expect(screen.getByTestId('grid-add-btn')).toBeDefined();
      });
    });

    it('should add a new field and open editor when add is clicked', async () => {
      const onFieldsChange = vi.fn();
      render(
        <FieldDesigner objectName="accounts" fields={MOCK_FIELDS} onFieldsChange={onFieldsChange} />
      );
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('grid-add-btn'));
      });
      expect(onFieldsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          ...MOCK_FIELDS,
          expect.objectContaining({ type: 'text', label: expect.stringContaining('New Field') }),
        ])
      );
      // Editor should be shown for the new field
      expect(screen.getByTestId('field-editor')).toBeDefined();
    });
  });

  // ============================
  // Type Filter
  // ============================
  describe('Type Filter', () => {
    it('should filter fields by type', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      fireEvent.change(screen.getByTestId('field-designer-type-filter'), {
        target: { value: 'select' },
      });
      await waitFor(() => {
        expect(screen.getByTestId('grid-row-fld-3')).toBeDefined();
      });
      expect(screen.queryByTestId('grid-row-fld-1')).toBeNull();
    });

    it('should show all fields when type filter is cleared', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      fireEvent.change(screen.getByTestId('field-designer-type-filter'), {
        target: { value: 'select' },
      });
      await waitFor(() => {
        expect(screen.queryByTestId('grid-row-fld-1')).toBeNull();
      });
      fireEvent.change(screen.getByTestId('field-designer-type-filter'), {
        target: { value: '' },
      });
      await waitFor(() => {
        expect(screen.getByTestId('grid-row-fld-1')).toBeDefined();
      });
    });
  });

  // ============================
  // Editing Fields
  // ============================
  describe('Editing Fields', () => {
    it('should open field editor panel when edit button is clicked', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('grid-edit-fld-1'));
      });
      expect(screen.getByTestId('field-editor')).toBeDefined();
    });

    it('should show field type selector in editor', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('grid-edit-fld-1'));
      });
      expect(screen.getByTestId('field-editor-type')).toBeDefined();
    });

    it('should show boolean toggles in editor', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('grid-edit-fld-1'));
      });
      expect(screen.getByTestId('field-editor-required')).toBeDefined();
      expect(screen.getByTestId('field-editor-unique')).toBeDefined();
      expect(screen.getByTestId('field-editor-readonly')).toBeDefined();
      expect(screen.getByTestId('field-editor-hidden')).toBeDefined();
      expect(screen.getByTestId('field-editor-indexed')).toBeDefined();
      expect(screen.getByTestId('field-editor-external-id')).toBeDefined();
      expect(screen.getByTestId('field-editor-track-history')).toBeDefined();
    });

    it('should call onFieldsChange when field is edited', async () => {
      const onFieldsChange = vi.fn();
      render(
        <FieldDesigner objectName="accounts" fields={MOCK_FIELDS} onFieldsChange={onFieldsChange} />
      );
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('grid-edit-fld-1'));
      });
      // Change the name input
      fireEvent.change(screen.getByTestId('field-editor-name'), {
        target: { value: 'full_name' },
      });
      expect(onFieldsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'fld-1', name: 'full_name' }),
        ])
      );
    });
  });

  // ============================
  // Read-only Mode
  // ============================
  describe('Read-only Mode', () => {
    it('should not render add button in read-only mode', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} readOnly />);
      await waitFor(() => {
        expect(screen.getByTestId('mock-object-grid')).toBeDefined();
      });
      expect(screen.queryByTestId('grid-add-btn')).toBeNull();
    });

    it('should not render edit/delete buttons in read-only mode', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} readOnly />);
      await waitFor(() => {
        expect(screen.getByTestId('mock-object-grid')).toBeDefined();
      });
      expect(screen.queryByTestId('grid-edit-fld-1')).toBeNull();
      expect(screen.queryByTestId('grid-delete-fld-1')).toBeNull();
    });
  });

  // ============================
  // Select Field Options
  // ============================
  describe('Select Field Options', () => {
    it('should show options editor for select fields', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('grid-edit-fld-3'));
      });
      expect(screen.getByTestId('field-option-0')).toBeDefined();
      expect(screen.getByTestId('field-option-1')).toBeDefined();
    });

    it('should show add option button for select fields', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('grid-edit-fld-3'));
      });
      expect(screen.getByTestId('field-editor-add-option')).toBeDefined();
    });
  });

  // ============================
  // Deleting Fields
  // ============================
  describe('Deleting Fields', () => {
    it('should render delete buttons for custom fields', async () => {
      render(<FieldDesigner objectName="accounts" fields={MOCK_FIELDS} />);
      await waitFor(() => {
        expect(screen.getByTestId('grid-delete-fld-1')).toBeDefined();
      });
    });

    it('should trigger delete confirmation on click', async () => {
      const onFieldsChange = vi.fn();
      render(
        <FieldDesigner objectName="accounts" fields={MOCK_FIELDS} onFieldsChange={onFieldsChange} />
      );
      await waitFor(() => {
        fireEvent.click(screen.getByTestId('grid-delete-fld-1'));
      });
      // Confirm dialog is triggered via useConfirmDialog hook
    });
  });
});
