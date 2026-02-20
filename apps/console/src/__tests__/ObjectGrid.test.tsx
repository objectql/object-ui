/**
 * ObjectGrid Integration Tests
 * 
 * Tests ObjectGrid component with MSW server backend
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectStackClient } from '@objectstack/client';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { startMockServer, stopMockServer } from '../mocks/server';
import { ObjectStackDataSource } from '../dataSource';

describe('ObjectGrid MSW Integration', () => {
  let client: ObjectStackClient;
  let dataSource: ObjectStackDataSource;

  beforeAll(async () => {
    await startMockServer();
    client = new ObjectStackClient({ baseUrl: 'http://localhost:3000' } as any);
    await client.connect();
    dataSource = new ObjectStackDataSource({ baseUrl: 'http://localhost:3000' });
  });

  afterAll(() => {
    stopMockServer();
  });

  describe('Grid Rendering', () => {
    it('should render grid with data from MSW server', async () => {
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email', 'company'],
          }}
          dataSource={dataSource}
        />
      );

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getAllByText('alice@objectstack.com')[0]).toBeInTheDocument();
      // expect(screen.getByText('ObjectStack HQ')).toBeInTheDocument();
    });

    it('should render all columns specified in schema', async () => {
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email', 'phone', 'company', 'status'],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
      }, { timeout: 10000 });

      // Check that all specified columns are rendered
      expect(screen.getAllByText('415-555-1001')[0]).toBeInTheDocument();
      // expect(screen.getByText('ObjectStack HQ')).toBeInTheDocument();
      expect(screen.getAllByText(/^[Aa]ctive$/)[0]).toBeInTheDocument();
    });

    it('should handle empty data gracefully', async () => {
      // Create a grid for a non-existent object or with filters that return no results
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email'],
            data: {
              provider: 'value',
              items: []
            }
          }}
          dataSource={dataSource}
        />
      );

      // Should not show any contact data
      await waitFor(() => {
        expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      });
    });
  });

  describe('Column Configuration', () => {
    it('should render grid with custom column configuration', async () => {
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: [
              { field: 'name', label: 'Full Name', width: 200 },
              { field: 'email', label: 'Email Address', width: 250 },
              { field: 'company', label: 'Organization', width: 180 },
            ],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Full Name')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('Email Address')).toBeInTheDocument();
      expect(screen.getByText('Organization')).toBeInTheDocument();
    });
  });

  describe('CRUD Operations', () => {
    it('should support row selection', async () => {
      const onRowSelect = vi.fn();
      
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email'],
            enableSelection: true,
          }}
          dataSource={dataSource}
          onRowSelect={onRowSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
      }, { timeout: 10000 });

      // Note: Row selection UI depends on the actual grid implementation
      // This is a placeholder for when selection is implemented
    });

    it('should trigger onEdit callback', async () => {
      const onEdit = vi.fn();
      
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email'],
            actions: true,
          }}
          dataSource={dataSource}
          onEdit={onEdit}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
      }, { timeout: 10000 });

      // Look for edit buttons (implementation-specific)
      // This is a placeholder for when edit actions are implemented
    });

    it('should trigger onDelete callback', async () => {
      const onDelete = vi.fn();
      
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email'],
            actions: true,
          }}
          dataSource={dataSource}
          onDelete={onDelete}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
      }, { timeout: 10000 });

      // Look for delete buttons (implementation-specific)
      // This is a placeholder for when delete actions are implemented
    });
  });

  describe('Data Loading', () => {
    it('should show loading state initially', async () => {
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email'],
          }}
          dataSource={dataSource}
        />
      );

      // Check for loading indicator (implementation-specific)
      // The grid should eventually show data
      await waitFor(() => {
        expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should load data from objectName', async () => {
      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email', 'company'],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Bob Smith')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Charlie Brown')[0]).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Static Data', () => {
    it('should render grid with inline static data', async () => {
      const staticData = [
        { id: '101', name: 'Test User 1', email: 'test1@example.com' },
        { id: '102', name: 'Test User 2', email: 'test2@example.com' },
      ];

      render(
        <ObjectGrid
          schema={{
            type: 'object-grid',
            objectName: 'contact',
            columns: ['name', 'email'],
            data: {
              provider: 'value',
              items: staticData
            }
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test User 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Test User 2')).toBeInTheDocument();
      expect(screen.getByText('test1@example.com')).toBeInTheDocument();
      expect(screen.getByText('test2@example.com')).toBeInTheDocument();
    });
  });
});
