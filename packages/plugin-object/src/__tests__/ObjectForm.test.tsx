/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObjectForm } from '../ObjectForm';
import type { ObjectFormSchema, DataSource } from '@object-ui/types';

// Mock SchemaRenderer
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: any) => (
    <div data-testid="schema-renderer">
      <div data-testid="form-fields">{schema.fields?.length || 0} fields</div>
      <div data-testid="form-layout">{schema.layout}</div>
      <div data-testid="form-submit">{schema.submitLabel}</div>
      {schema.fields && schema.fields.map((field: any, idx: number) => (
        <div key={idx} data-testid={`field-${field.name}`}>
          <label>{field.label}</label>
          {field.required && <span data-testid={`field-${field.name}-required`}>*</span>}
          {field.validation && <span data-testid={`field-${field.name}-validation`}>validation</span>}
        </div>
      ))}
    </div>
  ),
}));

describe('ObjectForm', () => {
  let mockDataSource: DataSource;
  let mockSchema: ObjectFormSchema;

  beforeEach(() => {
    // Mock data source
    mockDataSource = {
      find: vi.fn(),
      findOne: vi.fn().mockResolvedValue({
        _id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active',
      }),
      create: vi.fn().mockResolvedValue({
        _id: '3',
        name: 'New User',
        email: 'new@example.com',
        status: 'active',
      }),
      update: vi.fn().mockResolvedValue({
        _id: '1',
        name: 'Updated User',
        email: 'updated@example.com',
        status: 'inactive',
      }),
      delete: vi.fn(),
      bulk: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({
        name: 'users',
        label: 'Users',
        fields: {
          name: {
            type: 'text',
            label: 'Name',
            required: true,
            min_length: 2,
            max_length: 100,
          },
          email: {
            type: 'email',
            label: 'Email',
            required: true,
          },
          status: {
            type: 'select',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
          age: {
            type: 'number',
            label: 'Age',
            min: 0,
            max: 120,
          },
        },
      }),
    } as any;

    // Mock schema
    mockSchema = {
      type: 'object-form',
      objectName: 'users',
      mode: 'create',
      fields: ['name', 'email', 'status'],
    };
  });

  it('should render loading state initially', () => {
    render(<ObjectForm schema={mockSchema} dataSource={mockDataSource} />);
    expect(screen.getByText(/Loading form/i)).toBeInTheDocument();
  });

  it('should fetch and generate form fields', async () => {
    render(<ObjectForm schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
    });

    expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('users');
    expect(screen.getByTestId('form-fields')).toHaveTextContent('3 fields');
  });

  it('should generate fields with validation rules from metadata', async () => {
    render(<ObjectForm schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('field-name')).toBeInTheDocument();
    });

    // Name field should have validation
    expect(screen.getByTestId('field-name-validation')).toBeInTheDocument();
    expect(screen.getByTestId('field-name-required')).toBeInTheDocument();
  });

  it('should respect field-level permissions in create mode', async () => {
    const schemaWithPermissions = {
      name: 'users',
      label: 'Users',
      fields: {
        name: {
          type: 'text',
          label: 'Name',
          permissions: { write: true },
        },
        email: {
          type: 'email',
          label: 'Email',
          permissions: { write: false }, // No write permission
        },
        status: {
          type: 'select',
          label: 'Status',
        },
      },
    };

    mockDataSource.getObjectSchema = vi.fn().mockResolvedValue(schemaWithPermissions);

    render(<ObjectForm schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('form-fields')).toBeInTheDocument();
    });

    // Should have 2 fields (name and status, email excluded due to permissions)
    expect(screen.getByTestId('form-fields')).toHaveTextContent('2 fields');
  });

  it('should load initial data for edit mode', async () => {
    const editSchema: ObjectFormSchema = {
      ...mockSchema,
      mode: 'edit',
      recordId: '1',
    };

    render(<ObjectForm schema={editSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(mockDataSource.findOne).toHaveBeenCalledWith('users', '1');
    });
  });

  it('should not load data for create mode', async () => {
    render(<ObjectForm schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
    });

    expect(mockDataSource.findOne).not.toHaveBeenCalled();
  });

  it('should apply initial values in create mode', async () => {
    const schemaWithInitial: ObjectFormSchema = {
      ...mockSchema,
      initialValues: { status: 'active' },
    };

    render(<ObjectForm schema={schemaWithInitial} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
    });

    // Initial values should be passed to the form
  });

  it('should handle create submission', async () => {
    const onSuccess = vi.fn();
    const schemaWithCallback: ObjectFormSchema = {
      ...mockSchema,
      onSuccess,
    };

    render(<ObjectForm schema={schemaWithCallback} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
    });

    // Note: Actual form submission testing would require accessing
    // the form's onSubmit handler through the SchemaRenderer
  });

  it('should handle update submission', async () => {
    const onSuccess = vi.fn();
    const editSchema: ObjectFormSchema = {
      ...mockSchema,
      mode: 'edit',
      recordId: '1',
      onSuccess,
    };

    render(<ObjectForm schema={editSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
    });

    // Update operation should be available
  });

  it('should build validation rules from field metadata', async () => {
    const schemaWithValidation = {
      name: 'users',
      label: 'Users',
      fields: {
        name: {
          type: 'text',
          label: 'Name',
          required: true,
          min_length: 2,
          max_length: 100,
          required_message: 'Name is required',
        },
        email: {
          type: 'email',
          label: 'Email',
          required: true,
          pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        },
        age: {
          type: 'number',
          label: 'Age',
          min: 18,
          max: 65,
        },
      },
    };

    mockDataSource.getObjectSchema = vi.fn().mockResolvedValue(schemaWithValidation);

    render(<ObjectForm schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('field-name')).toBeInTheDocument();
    });

    // All fields should have validation
    expect(screen.getByTestId('field-name-validation')).toBeInTheDocument();
    expect(screen.getByTestId('field-email-validation')).toBeInTheDocument();
  });

  it('should support conditional field visibility', async () => {
    const schemaWithConditions = {
      name: 'users',
      label: 'Users',
      fields: {
        type: {
          type: 'select',
          label: 'Type',
          options: [
            { value: 'personal', label: 'Personal' },
            { value: 'business', label: 'Business' },
          ],
        },
        company: {
          type: 'text',
          label: 'Company',
          visible_on: {
            field: 'type',
            operator: '=',
            value: 'business',
          },
        },
      },
    };

    mockDataSource.getObjectSchema = vi.fn().mockResolvedValue(schemaWithConditions);

    const schemaWithFields: ObjectFormSchema = {
      ...mockSchema,
      fields: ['type', 'company'],
    };

    render(<ObjectForm schema={schemaWithFields} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
    });

    // Fields with conditional visibility should be included
    expect(screen.getByTestId('field-type')).toBeInTheDocument();
    expect(screen.getByTestId('field-company')).toBeInTheDocument();
  });

  it('should disable form in view mode', async () => {
    const viewSchema: ObjectFormSchema = {
      ...mockSchema,
      mode: 'view',
      recordId: '1',
    };

    render(<ObjectForm schema={viewSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('schema-renderer')).toBeInTheDocument();
    });

    // Form should not show submit button in view mode
    expect(screen.queryByText('Create')).not.toBeInTheDocument();
  });

  it('should set correct submit label based on mode', async () => {
    render(<ObjectForm schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('form-submit')).toBeInTheDocument();
    });

    // Create mode should show "Create" button
    expect(screen.getByTestId('form-submit')).toHaveTextContent('Create');
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Failed to fetch schema');
    mockDataSource.getObjectSchema = vi.fn().mockRejectedValue(error);

    render(<ObjectForm schema={mockSchema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading form/i)).toBeInTheDocument();
    });
  });

  it('should handle custom field configurations', async () => {
    const customField = {
      name: 'name',
      label: 'Full Name',
      type: 'input' as const,
      required: true,
      placeholder: 'Enter your full name',
    };

    const schemaWithCustomFields: ObjectFormSchema = {
      ...mockSchema,
      customFields: [customField],
    };

    render(<ObjectForm schema={schemaWithCustomFields} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(screen.getByTestId('field-name')).toBeInTheDocument();
    });

    // Custom field should be used
    expect(screen.getByTestId('field-name')).toHaveTextContent('Full Name');
  });
});
