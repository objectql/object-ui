/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataModelDesigner } from '../DataModelDesigner';
import type { DataModelEntity, DataModelRelationship } from '@object-ui/types';

const MOCK_ENTITIES: DataModelEntity[] = [
  {
    id: 'entity-1',
    name: 'users',
    label: 'Users',
    fields: [
      { name: 'id', type: 'uuid', primaryKey: true, required: true },
      { name: 'name', type: 'text', required: true },
      { name: 'email', type: 'text', required: true },
    ],
    position: { x: 50, y: 50 },
    color: '#3b82f6',
  },
  {
    id: 'entity-2',
    name: 'orders',
    label: 'Orders',
    fields: [
      { name: 'id', type: 'uuid', primaryKey: true, required: true },
      { name: 'total', type: 'number', required: true },
    ],
    position: { x: 400, y: 50 },
  },
];

const MOCK_RELATIONSHIPS: DataModelRelationship[] = [
  {
    id: 'rel-1',
    sourceEntity: 'entity-1',
    sourceField: 'id',
    targetEntity: 'entity-2',
    targetField: 'user_id',
    type: 'one-to-many',
    label: 'has many',
  },
];

describe('DataModelDesigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // Basic Rendering
  // ============================
  describe('Basic Rendering', () => {
    it('should render with no entities', () => {
      render(<DataModelDesigner />);

      expect(screen.getByText('Data Model Designer')).toBeDefined();
      expect(screen.getByText(/No entities in the model/)).toBeDefined();
    });

    it('should render entities', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} />);

      expect(screen.getByText('Users')).toBeDefined();
      expect(screen.getByText('Orders')).toBeDefined();
    });

    it('should render toolbar with undo/redo buttons', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} />);

      expect(screen.getByLabelText('Undo')).toBeDefined();
      expect(screen.getByLabelText('Redo')).toBeDefined();
    });

    it('should render add entity button', () => {
      render(<DataModelDesigner />);

      expect(screen.getByLabelText('Add Entity')).toBeDefined();
    });

    it('should hide add buttons in read-only mode', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} readOnly />);

      expect(screen.queryByLabelText('Add Entity')).toBeNull();
    });
  });

  // ============================
  // Entity Management
  // ============================
  describe('Entity Management', () => {
    it('should add new entity on button click', () => {
      render(<DataModelDesigner />);

      fireEvent.click(screen.getByLabelText('Add Entity'));

      expect(screen.getAllByText('New Entity 1').length).toBeGreaterThanOrEqual(1);
    });

    it('should delete entity with confirmation', async () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} />);

      const deleteBtn = screen.getByLabelText('Delete Users');
      fireEvent.click(deleteBtn);

      // Confirm deletion
      await waitFor(() => {
        const confirmBtn = screen.getByText('Delete');
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText('Users')).toBeNull();
      });
    });

    it('should call onEntitiesChange when entity is added', () => {
      const onChange = vi.fn();
      render(<DataModelDesigner onEntitiesChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Add Entity'));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toHaveLength(1);
    });
  });

  // ============================
  // Inline Entity Label Editing
  // ============================
  describe('Inline Entity Label Editing', () => {
    it('should enter edit mode on double-click', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} />);

      const label = screen.getByTestId('entity-label-entity-1');
      fireEvent.doubleClick(label);

      const input = screen.getByTestId('entity-label-input-entity-1');
      expect(input).toBeDefined();
      expect((input as HTMLInputElement).value).toBe('Users');
    });

    it('should commit label edit on Enter', () => {
      const onChange = vi.fn();
      render(<DataModelDesigner entities={MOCK_ENTITIES} onEntitiesChange={onChange} />);

      const label = screen.getByTestId('entity-label-entity-1');
      fireEvent.doubleClick(label);

      const input = screen.getByTestId('entity-label-input-entity-1');
      fireEvent.change(input, { target: { value: 'Accounts' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalled();
      const updatedEntities = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      const updated = updatedEntities.find((e: DataModelEntity) => e.id === 'entity-1');
      expect(updated?.label).toBe('Accounts');
    });

    it('should cancel label edit on Escape', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} />);

      const label = screen.getByTestId('entity-label-entity-1');
      fireEvent.doubleClick(label);

      const input = screen.getByTestId('entity-label-input-entity-1');
      fireEvent.change(input, { target: { value: 'Something' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should exit edit mode
      expect(screen.queryByTestId('entity-label-input-entity-1')).toBeNull();
      // Original label should remain
      expect(screen.getByText('Users')).toBeDefined();
    });

    it('should not enter edit mode in read-only', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} readOnly />);

      const label = screen.getByTestId('entity-label-entity-1');
      fireEvent.doubleClick(label);

      expect(screen.queryByTestId('entity-label-input-entity-1')).toBeNull();
    });

    it('should discard empty label edits', () => {
      const onChange = vi.fn();
      render(<DataModelDesigner entities={MOCK_ENTITIES} onEntitiesChange={onChange} />);

      const callCountBefore = onChange.mock.calls.length;

      const label = screen.getByTestId('entity-label-entity-1');
      fireEvent.doubleClick(label);

      const input = screen.getByTestId('entity-label-input-entity-1');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should not have committed (no additional onEntitiesChange call)
      expect(onChange.mock.calls.length).toBe(callCountBefore);
      // The input should be gone (editing cancelled)
      expect(screen.queryByTestId('entity-label-input-entity-1')).toBeNull();
    });
  });

  // ============================
  // Field Type Selector
  // ============================
  describe('Field Type Selector', () => {
    it('should render field type dropdown for each field', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} />);

      const typeSelect = screen.getByTestId('field-type-entity-1-1');
      expect(typeSelect).toBeDefined();
      expect((typeSelect as HTMLSelectElement).value).toBe('text');
    });

    it('should change field type via dropdown', () => {
      const onChange = vi.fn();
      render(<DataModelDesigner entities={MOCK_ENTITIES} onEntitiesChange={onChange} />);

      const typeSelect = screen.getByTestId('field-type-entity-1-1');
      fireEvent.change(typeSelect, { target: { value: 'email' } });

      expect(onChange).toHaveBeenCalled();
      const updatedEntities = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      const updated = updatedEntities.find((e: DataModelEntity) => e.id === 'entity-1');
      expect(updated?.fields[1].type).toBe('email');
    });

    it('should show static text in read-only mode', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} readOnly />);

      expect(screen.queryByTestId('field-type-entity-1-1')).toBeNull();
    });
  });

  // ============================
  // Inline Field Name Editing
  // ============================
  describe('Inline Field Name Editing', () => {
    it('should enter edit mode when clicking field name', () => {
      render(<DataModelDesigner entities={MOCK_ENTITIES} />);

      const fieldName = screen.getByText('name');
      fireEvent.click(fieldName);

      // Should show an input
      const inputs = document.querySelectorAll('input[type="text"]');
      const editInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === 'name');
      expect(editInput).toBeDefined();
    });
  });

  // ============================
  // Undo/Redo
  // ============================
  describe('Undo/Redo', () => {
    it('should undo entity addition', () => {
      render(<DataModelDesigner />);

      fireEvent.click(screen.getByLabelText('Add Entity'));
      expect(screen.getAllByText('New Entity 1').length).toBeGreaterThanOrEqual(1);

      fireEvent.click(screen.getByLabelText('Undo'));

      expect(screen.queryByText('New Entity 1')).toBeNull();
    });

    it('should redo after undo', () => {
      render(<DataModelDesigner />);

      fireEvent.click(screen.getByLabelText('Add Entity'));
      fireEvent.click(screen.getByLabelText('Undo'));

      expect(screen.queryByText('New Entity 1')).toBeNull();

      fireEvent.click(screen.getByLabelText('Redo'));

      expect(screen.getAllByText('New Entity 1').length).toBeGreaterThanOrEqual(1);
    });
  });
});
