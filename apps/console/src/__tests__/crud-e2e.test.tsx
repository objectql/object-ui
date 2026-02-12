/**
 * CRUD End-to-End Verification Tests
 *
 * Tests that CRUD operations (create, read, update, delete) work for object records
 * using a mock DataSource following the existing ObjectFormUnit pattern.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ObjectForm } from '@object-ui/plugin-form';
import type { DataSource } from '@object-ui/types';

// In-memory store to verify full CRUD lifecycle
const store: Record<string, any> = {};
let nextId = 1;

class CrudDataSource implements DataSource {
  private schema = {
    name: 'task',
    fields: {
      name: { name: 'name', label: 'Task Name', type: 'text', required: true },
      description: { name: 'description', label: 'Description', type: 'textarea' },
      priority: { name: 'priority', label: 'Priority', type: 'number', defaultValue: 1 },
      is_done: { name: 'is_done', label: 'Done', type: 'boolean', defaultValue: false },
    },
  };

  async getObjectSchema(_objectName: string): Promise<any> {
    return this.schema;
  }

  async findOne(_objectName: string, id: string): Promise<any> {
    const record = store[id];
    if (!record) throw new Error(`Record ${id} not found`);
    return record;
  }

  async create(_objectName: string, data: any): Promise<any> {
    const id = `task-${nextId++}`;
    const record = { ...data, id };
    store[id] = record;
    return record;
  }

  async update(_objectName: string, id: string, data: any): Promise<any> {
    if (!store[id]) throw new Error(`Record ${id} not found`);
    store[id] = { ...store[id], ...data };
    return store[id];
  }

  async delete(_objectName: string, id: string): Promise<boolean> {
    if (!store[id]) return false;
    delete store[id];
    return true;
  }

  async find(_objectName: string, _options?: any): Promise<{ data: any[] }> {
    return { data: Object.values(store) };
  }
}

describe('CRUD End-to-End Verification', () => {
  const dataSource = new CrudDataSource();

  // Reset store between tests
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    nextId = 1;
  });

  describe('Create', () => {
    it('should create a new record and return it with an id', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'task',
            mode: 'create',
            fields: ['name', 'description'],
            onSuccess,
          }}
          dataSource={dataSource}
        />,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Task Name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Task Name/i), 'Write tests');
      await user.type(screen.getByLabelText(/Description/i), 'Cover CRUD ops');

      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const created = onSuccess.mock.calls[0][0];
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Write tests');
      expect(created.description).toBe('Cover CRUD ops');
      // Verify record is persisted in store
      expect(store[created.id]).toBeDefined();
    });

    it('should apply default field values on create', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'task',
            mode: 'create',
            fields: ['name', 'priority', 'is_done'],
            onSuccess,
          }}
          dataSource={dataSource}
        />,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Task Name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Task Name/i), 'Default task');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const created = onSuccess.mock.calls[0][0];
      expect(created.priority).toBe(1);
      expect(created.is_done).toBe(false);
    });
  });

  describe('Read', () => {
    it('should load an existing record in edit mode', async () => {
      // Pre-populate store
      store['task-1'] = {
        id: 'task-1',
        name: 'Existing task',
        description: 'Already here',
        priority: 3,
        is_done: false,
      };

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'task',
            mode: 'edit',
            recordId: 'task-1',
            fields: ['name', 'description'],
          }}
          dataSource={dataSource}
        />,
      );

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Task Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('Existing task');
      });

      const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      expect(descInput.value).toBe('Already here');
    });

    it('should display an existing record in view mode as read-only', async () => {
      store['task-1'] = {
        id: 'task-1',
        name: 'View me',
        description: 'Read-only',
      };

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'task',
            mode: 'view',
            recordId: 'task-1',
            fields: ['name', 'description'],
          }}
          dataSource={dataSource}
        />,
      );

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Task Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('View me');
        expect(nameInput.disabled).toBe(true);
      });

      expect(screen.queryByRole('button', { name: /create|update/i })).not.toBeInTheDocument();
    });
  });

  describe('Update', () => {
    it('should update an existing record', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      store['task-1'] = {
        id: 'task-1',
        name: 'Old name',
        description: 'Old desc',
      };

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'task',
            mode: 'edit',
            recordId: 'task-1',
            fields: ['name', 'description'],
            onSuccess,
          }}
          dataSource={dataSource}
        />,
      );

      await waitFor(() => {
        expect((screen.getByLabelText(/Task Name/i) as HTMLInputElement).value).toBe('Old name');
      });

      const nameInput = screen.getByLabelText(/Task Name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New name');

      await user.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const updated = onSuccess.mock.calls[0][0];
      expect(updated.name).toBe('New name');
      expect(updated.id).toBe('task-1');
      // Verify persistence
      expect(store['task-1'].name).toBe('New name');
    });
  });

  describe('Delete', () => {
    it('should delete a record from the store', async () => {
      store['task-1'] = {
        id: 'task-1',
        name: 'Delete me',
      };

      const result = await dataSource.delete('task', 'task-1');
      expect(result).toBe(true);
      expect(store['task-1']).toBeUndefined();
    });

    it('should return false for non-existent record', async () => {
      const result = await dataSource.delete('task', 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Full CRUD lifecycle', () => {
    it('should create, read, update, and delete a record', async () => {
      const user = userEvent.setup();
      const onCreateSuccess = vi.fn();

      // 1. CREATE
      const { unmount: unmountCreate } = render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'task',
            mode: 'create',
            fields: ['name', 'description'],
            onSuccess: onCreateSuccess,
          }}
          dataSource={dataSource}
        />,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Task Name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Task Name/i), 'Lifecycle task');
      await user.type(screen.getByLabelText(/Description/i), 'Full lifecycle');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(onCreateSuccess).toHaveBeenCalled();
      });

      const createdRecord = onCreateSuccess.mock.calls[0][0];
      const recordId = createdRecord.id;
      expect(recordId).toBeDefined();
      unmountCreate();

      // 2. READ – verify data was persisted
      const fetched = await dataSource.findOne('task', recordId);
      expect(fetched.name).toBe('Lifecycle task');

      // 3. UPDATE
      const onUpdateSuccess = vi.fn();
      const { unmount: unmountUpdate } = render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'task',
            mode: 'edit',
            recordId,
            fields: ['name', 'description'],
            onSuccess: onUpdateSuccess,
          }}
          dataSource={dataSource}
        />,
      );

      await waitFor(() => {
        expect((screen.getByLabelText(/Task Name/i) as HTMLInputElement).value).toBe(
          'Lifecycle task',
        );
      });

      const nameInput = screen.getByLabelText(/Task Name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated lifecycle');
      await user.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(onUpdateSuccess).toHaveBeenCalled();
      });

      expect(store[recordId].name).toBe('Updated lifecycle');
      unmountUpdate();

      // 4. DELETE
      const deleted = await dataSource.delete('task', recordId);
      expect(deleted).toBe(true);
      expect(store[recordId]).toBeUndefined();
    });
  });
});
