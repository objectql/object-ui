/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { DataTableSchema } from '@object-ui/types';

// Import the component
import '../data-table';
import { ComponentRegistry } from '@object-ui/core';

describe('Data Table - Inline Editing', () => {
  const mockData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35 },
  ];

  const mockColumns = [
    { header: 'ID', accessorKey: 'id', editable: false },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Age', accessorKey: 'age' },
  ];

  it('should render table with editable cells when editable is true', () => {
    const schema: DataTableSchema = {
      type: 'data-table',
      columns: mockColumns,
      data: mockData,
      editable: true,
      pagination: false,
    };

    const DataTableRenderer = ComponentRegistry.get('data-table');
    if (!DataTableRenderer) throw new Error('DataTableRenderer not found');

    const { container } = render(<DataTableRenderer schema={schema} />);
    
    // Check that cells are rendered
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    
    // Editable cells should have tabindex
    const cells = container.querySelectorAll('td[tabindex="0"]');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('should call onCellChange when cell value is edited', async () => {
    const onCellChange = vi.fn();
    
    const schema: DataTableSchema = {
      type: 'data-table',
      columns: mockColumns,
      data: mockData,
      editable: true,
      pagination: false,
      searchable: false, // Disable search to avoid confusion with edit input
      onCellChange,
    };

    const DataTableRenderer = ComponentRegistry.get('data-table');
    if (!DataTableRenderer) throw new Error('DataTableRenderer not found');

    const { container } = render(<DataTableRenderer schema={schema} />);
    
    // Find the first editable cell (name column)
    const nameCell = screen.getByText('John Doe').closest('td');
    expect(nameCell).toBeInTheDocument();
    
    // Double-click to enter edit mode
    if (nameCell) {
      fireEvent.doubleClick(nameCell);
      
      // Wait for input to appear inside the cell
      await waitFor(() => {
        const input = nameCell.querySelector('input');
        expect(input).toBeInTheDocument();
      });
      
      const input = nameCell.querySelector('input');
      if (input) {
        // Change the value
        fireEvent.change(input, { target: { value: 'John Smith' } });
        
        // Press Enter to save
        fireEvent.keyDown(input, { key: 'Enter' });
        
        // Verify onCellChange was called
        await waitFor(() => {
          expect(onCellChange).toHaveBeenCalledWith(
            0, // row index
            'name', // column key
            'John Smith', // new value
            mockData[0] // row data
          );
        });
      }
    }
  });

  it('should not allow editing when editable is false', () => {
    const schema: DataTableSchema = {
      type: 'data-table',
      columns: mockColumns,
      data: mockData,
      editable: false,
      pagination: false,
      searchable: false, // Disable search to avoid confusion
    };

    const DataTableRenderer = ComponentRegistry.get('data-table');
    if (!DataTableRenderer) throw new Error('DataTableRenderer not found');

    const { container } = render(<DataTableRenderer schema={schema} />);
    
    // Find a cell
    const nameCell = screen.getByText('John Doe').closest('td');
    expect(nameCell).toBeInTheDocument();
    
    // Double-click should not trigger edit mode
    if (nameCell) {
      fireEvent.doubleClick(nameCell);
      
      // Input should not appear in the cell
      const input = nameCell?.querySelector('input');
      expect(input).not.toBeInTheDocument();
    }
  });

  it('should respect column-level editable flag', () => {
    const onCellChange = vi.fn();
    
    const schema: DataTableSchema = {
      type: 'data-table',
      columns: mockColumns,
      data: mockData,
      editable: true,
      pagination: false,
      searchable: false, // Disable search to avoid confusion
      onCellChange,
    };

    const DataTableRenderer = ComponentRegistry.get('data-table');
    if (!DataTableRenderer) throw new Error('DataTableRenderer not found');

    const { container } = render(<DataTableRenderer schema={schema} />);
    
    // Try to edit ID column (which has editable: false)
    const idCell = screen.getByText('1').closest('td');
    expect(idCell).toBeInTheDocument();
    
    if (idCell) {
      fireEvent.doubleClick(idCell);
      
      // Input should not appear for non-editable column
      const input = idCell.querySelector('input');
      expect(input).not.toBeInTheDocument();
    }
  });

  it('should cancel edit on Escape key', async () => {
    const onCellChange = vi.fn();
    
    const schema: DataTableSchema = {
      type: 'data-table',
      columns: mockColumns,
      data: mockData,
      editable: true,
      pagination: false,
      searchable: false, // Disable search to avoid confusion
      onCellChange,
    };

    const DataTableRenderer = ComponentRegistry.get('data-table');
    if (!DataTableRenderer) throw new Error('DataTableRenderer not found');

    const { container } = render(<DataTableRenderer schema={schema} />);
    
    // Find the first editable cell
    const nameCell = screen.getByText('John Doe').closest('td');
    expect(nameCell).toBeInTheDocument();
    
    // Double-click to enter edit mode
    if (nameCell) {
      fireEvent.doubleClick(nameCell);
      
      // Wait for input to appear
      await waitFor(() => {
        const input = nameCell.querySelector('input');
        expect(input).toBeInTheDocument();
      });
      
      const input = nameCell.querySelector('input');
      if (input) {
        // Change the value
        fireEvent.change(input, { target: { value: 'John Smith' } });
        
        // Press Escape to cancel
        fireEvent.keyDown(input, { key: 'Escape' });
        
        // Verify onCellChange was NOT called
        await waitFor(() => {
          expect(onCellChange).not.toHaveBeenCalled();
        });
        
        // Input should be removed
        expect(nameCell.querySelector('input')).not.toBeInTheDocument();
        
        // Original value should be preserved
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      }
    }
  });
});
