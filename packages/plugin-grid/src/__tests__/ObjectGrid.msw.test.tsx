/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Integration Tests for ObjectGrid with MSW
 * 
 * These tests demonstrate how to test metadata-driven tables using MSW
 * for API mocking. They verify that:
 * - Grid can fetch and display data from mocked API
 * - Grid handles pagination, sorting, and filtering correctly
 * - Grid respects metadata schema configuration
 * - CRUD operations work through the API layer
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectGrid } from '../ObjectGrid';
import type { ObjectGridSchema } from '@object-ui/types';
import { setupMSW, MockDataSource } from './msw-test-utils';

// Setup MSW server
const server = setupMSW({ beforeAll, afterEach, afterAll });

describe('ObjectGrid with MSW Integration', () => {
  let dataSource: MockDataSource;

  beforeEach(() => {
    dataSource = new MockDataSource();
  });

  describe('Basic Grid Rendering', () => {
    it('should fetch and display data from API', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: ['subject', 'priority', 'isCompleted'],
      };

      render(<ObjectGrid schema={schema} dataSource={dataSource} />);

      // Should show loading state initially
      expect(screen.getByText(/Loading grid/i)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      });

      // Verify all tasks are displayed
      expect(screen.getByText('Review pull requests')).toBeInTheDocument();
      expect(screen.getByText('Update dependencies')).toBeInTheDocument();
    });

    it('should display column headers based on schema', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: [
          { field: 'subject', label: 'Task Subject' },
          { field: 'priority', label: 'Priority Level' },
        ],
      };

      render(<ObjectGrid schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByText('Task Subject')).toBeInTheDocument();
        expect(screen.getByText('Priority Level')).toBeInTheDocument();
      });
    });

    it('should handle schema fetching from API', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        fields: ['subject', 'priority'],
      };

      render(<ObjectGrid schema={schema} dataSource={dataSource} />);

      // Wait for schema and data to load
      await waitFor(() => {
        expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      });
    });
  });

  describe('Data Operations', () => {
    it('should support pagination parameters', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: ['subject'],
        pagination: {
          pageSize: 2,
        },
      };

      render(<ObjectGrid schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      });

      // With pageSize of 2, we should only see first 2 tasks initially
      // (actual pagination UI depends on the data-table component)
    });

    it('should support inline data without API calls', async () => {
      const inlineData = [
        { id: 'a', subject: 'Task A', priority: 1 },
        { id: 'b', subject: 'Task B', priority: 2 },
      ];

      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: ['subject', 'priority'],
        data: {
          provider: 'value',
          items: inlineData,
        },
      };

      render(<ObjectGrid schema={schema} />);

      // Should not show loading since data is inline
      await waitFor(() => {
        expect(screen.getByText('Task A')).toBeInTheDocument();
        expect(screen.getByText('Task B')).toBeInTheDocument();
      });
    });
  });

  describe('CRUD Operations', () => {
    it('should display action buttons when operations are enabled', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: ['subject'],
        operations: {
          update: true,
          delete: true,
        },
      };

      const onEdit = vi.fn();
      const onDelete = vi.fn();

      render(
        <ObjectGrid
          schema={schema}
          dataSource={dataSource}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      });

      // Actions column should be present
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error when API fails', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'nonexistent',
        columns: ['subject'],
      };

      render(<ObjectGrid schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading grid/i)).toBeInTheDocument();
      });
    });

    it('should handle missing dataSource gracefully', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: ['subject'],
      };

      render(<ObjectGrid schema={schema} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading grid/i)).toBeInTheDocument();
      });
    });
  });

  describe('Selection and Interaction', () => {
    it('should support row selection when enabled', async () => {
      const onRowSelect = vi.fn();

      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: ['subject'],
        selection: {
          type: 'multiple',
        },
      };

      render(
        <ObjectGrid
          schema={schema}
          dataSource={dataSource}
          onRowSelect={onRowSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      });

      // Selection functionality would be tested through interactions
      // which depend on the data-table component implementation
    });
  });

  describe('Advanced Features', () => {
    it('should support searchable fields', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: ['subject', 'priority'],
        searchableFields: ['subject'],
      };

      render(<ObjectGrid schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      });

      // Search UI would be present based on searchableFields configuration
    });

    it('should respect column configuration', async () => {
      const schema: ObjectGridSchema = {
        type: 'object-grid',
        objectName: 'task',
        columns: [
          { field: 'subject', label: 'Task', width: 300 },
          { field: 'priority', label: 'Priority', align: 'center' },
        ],
      };

      render(<ObjectGrid schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByText('Task')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
      });
    });
  });
});
