/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Integration Tests for ObjectForm with MSW
 * 
 * These tests demonstrate how to test metadata-driven forms using MSW
 * for API mocking. They verify that:
 * - Form can fetch schema and initial data from mocked API
 * - Form renders fields based on metadata
 * - Form validation works correctly
 * - Form submission and updates work through the API layer
 * - Different modes (create, edit, view) work as expected
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ObjectForm } from '../ObjectForm';
import type { ObjectFormSchema } from '@object-ui/types';
import { setupMSW, MockDataSource } from './msw-test-utils';

// Setup MSW server
const server = setupMSW({ beforeAll, afterEach, afterAll });

describe('ObjectForm with MSW Integration', () => {
  let dataSource: MockDataSource;
  const user = userEvent.setup();

  beforeEach(() => {
    dataSource = new MockDataSource();
  });

  describe('Create Mode', () => {
    it('should fetch schema and render empty form for creation', async () => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'create',
        fields: ['subject', 'priority'],
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      // Should show loading state initially
      expect(screen.getByText(/Loading form/i)).toBeInTheDocument();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText('Subject')).toBeInTheDocument();
        expect(screen.getByLabelText('Priority')).toBeInTheDocument();
      });

      // Fields should be empty in create mode
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
      expect(subjectInput.value).toBe('');
    });

    it('should submit new record to API', async () => {
      const onSuccess = vi.fn();

      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'create',
        fields: ['subject', 'priority'],
        onSuccess,
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Subject')).toBeInTheDocument();
      });

      // Fill out the form
      const subjectInput = screen.getByLabelText('Subject');
      const priorityInput = screen.getByLabelText('Priority');

      await user.type(subjectInput, 'New Task');
      await user.clear(priorityInput);
      await user.type(priorityInput, '7');

      // Submit the form
      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      // Wait for submission
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const createdRecord = onSuccess.mock.calls[0][0];
      expect(createdRecord.subject).toBe('New Task');
      expect(createdRecord.priority).toBe(7);
    });

    it('should handle required fields validation', async () => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'create',
        fields: ['subject'], // subject is required in mockTaskSchema
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Subject/)).toBeInTheDocument();
      });

      // Field should show as required (asterisk or indicator)
      // The form renderer adds asterisk for required fields
    });
  });

  describe('Edit Mode', () => {
    it('should fetch schema and record data for editing', async () => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'edit',
        recordId: '1',
        fields: ['subject', 'priority'],
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Subject')).toBeInTheDocument();
      });

      // Fields should be populated with existing data
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
      expect(subjectInput.value).toBe('Complete project documentation');

      const priorityInput = screen.getByLabelText('Priority') as HTMLInputElement;
      expect(priorityInput.value).toBe('8');
    });

    it('should update record via API', async () => {
      const onSuccess = vi.fn();

      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'edit',
        recordId: '1',
        fields: ['subject', 'priority'],
        onSuccess,
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Subject')).toBeInTheDocument();
      });

      // Update the subject
      const subjectInput = screen.getByLabelText('Subject');
      await user.clear(subjectInput);
      await user.type(subjectInput, 'Updated Task Name');

      // Submit the form
      const submitButton = screen.getByText('Update');
      await user.click(submitButton);

      // Wait for submission
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const updatedRecord = onSuccess.mock.calls[0][0];
      expect(updatedRecord.subject).toBe('Updated Task Name');
    });
  });

  describe('View Mode', () => {
    it('should display data in read-only mode', async () => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'view',
        recordId: '1',
        fields: ['subject', 'priority', 'isCompleted'],
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Subject')).toBeInTheDocument();
      });

      // All fields should be disabled in view mode
      const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
      expect(subjectInput.disabled).toBe(true);

      const priorityInput = screen.getByLabelText('Priority') as HTMLInputElement;
      expect(priorityInput.disabled).toBe(true);

      // Submit button should not be visible in view mode
      expect(screen.queryByText('Update')).not.toBeInTheDocument();
      expect(screen.queryByText('Create')).not.toBeInTheDocument();
    });
  });

  describe('Inline Fields (No API)', () => {
    it('should work with custom inline fields without fetching schema', async () => {
      const onSuccess = vi.fn();

      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'create',
        customFields: [
          {
            name: 'title',
            label: 'Title',
            type: 'text',
            required: true,
          },
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
          },
        ],
        onSuccess,
      };

      render(<ObjectForm schema={schema} />);

      // Should not require dataSource for inline fields
      await waitFor(() => {
        expect(screen.getByLabelText('Title')).toBeInTheDocument();
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
      });

      // Fill and submit
      await user.type(screen.getByLabelText('Title'), 'Test Title');
      await user.type(screen.getByLabelText('Description'), 'Test Description');

      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({
          title: 'Test Title',
          description: 'Test Description',
        });
      });
    });

    it('should support initial data with inline fields', async () => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'edit',
        customFields: [
          {
            name: 'name',
            label: 'Name',
            type: 'text',
          },
        ],
        initialData: {
          name: 'Initial Value',
        },
      };

      render(<ObjectForm schema={schema} />);

      await waitFor(() => {
        const input = screen.getByLabelText('Name') as HTMLInputElement;
        expect(input.value).toBe('Initial Value');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when schema fetch fails', async () => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'nonexistent',
        mode: 'create',
        fields: ['subject'],
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading form/i)).toBeInTheDocument();
      });
    });

    it('should display error when record fetch fails', async () => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'edit',
        recordId: 'nonexistent',
        fields: ['subject'],
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading form/i)).toBeInTheDocument();
      });
    });

    it('should call onError when submission fails', async () => {
      const onError = vi.fn();
      const onSuccess = vi.fn();

      // Use an invalid object name to trigger error
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'invalid_object',
        mode: 'create',
        customFields: [
          {
            name: 'test',
            label: 'Test',
            type: 'text',
          },
        ],
        onSuccess,
        onError,
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Test')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Test'), 'value');
      await user.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Form Interactions', () => {
    it('should handle cancel callback', async () => {
      const onCancel = vi.fn();

      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'task',
        mode: 'create',
        customFields: [
          {
            name: 'test',
            label: 'Test',
            type: 'text',
          },
        ],
        onCancel,
      };

      render(<ObjectForm schema={schema} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Test')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should support different field types from schema', async () => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'user',
        mode: 'create',
        fields: ['name', 'email', 'status'],
      };

      render(<ObjectForm schema={schema} dataSource={dataSource} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      // Email field should have correct type
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      expect(emailInput.type).toBe('email');

      // Status is a select field
      const statusInput = screen.getByLabelText('Status') as HTMLSelectElement;
      expect(statusInput.tagName).toBe('SELECT');
    });
  });
});
