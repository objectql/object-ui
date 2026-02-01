/**
 * ObjectForm Unit Tests
 * 
 * Tests ObjectForm component directly with mock DataSource
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ObjectForm } from '@object-ui/plugin-form';
import type { DataSource } from '@object-ui/types';

// Mock DataSource
class MockDataSource implements DataSource {
  private mockObject = {
    name: 'contact',
    fields: {
      name: { name: 'name', label: 'Full Name', type: 'text', required: true },
      email: { name: 'email', label: 'Email', type: 'email', required: true },
      phone: { name: 'phone', label: 'Phone Number', type: 'phone' },
      company: { name: 'company', label: 'Company', type: 'text' },
      priority: { name: 'priority', label: 'Priority', type: 'number', min: 1, max: 10, defaultValue: 5 },
      is_active: { name: 'is_active', label: 'Active', type: 'boolean', defaultValue: true },
      notes: { name: 'notes', label: 'Notes', type: 'textarea' },
    }
  };

  async getObjectSchema(_objectName: string): Promise<any> {
    return this.mockObject;
  }

  async findOne(_objectName: string, id: string): Promise<any> {
    return {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      company: 'Acme Corp',
      priority: 8,
      is_active: true,
      notes: 'Test contact'
    };
  }

  async create(_objectName: string, data: any): Promise<any> {
    console.log('MockDataSource.create received:', data);
    return { ...data, id: 'new-id' };
  }

  async update(_objectName: string, id: string, data: any): Promise<any> {
    return { ...data, id };
  }

  async delete(_objectName: string, _id: string): Promise<boolean> {
    // Mock delete
    return true;
  }

  async find(_objectName: string, _options?: any): Promise<{ data: any[] }> {
    return { data: [] };
  }
}

describe('ObjectForm Unit Tests', () => {
  describe('Create Mode', () => {
    it('should render create form with fields', async () => {
      const dataSource = new MockDataSource();
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email', 'company'],
            onSuccess,
          }}
          dataSource={dataSource}
        />
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Company/i)).toBeInTheDocument();
    });

    it('should create a contact successfully', async () => {
      const user = userEvent.setup();
      const dataSource = new MockDataSource();
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email'],
            onSuccess,
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      });

      // Fill in form
      await user.type(screen.getByLabelText(/Full Name/i), 'Test User');
      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');

      // Submit
      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Wait for success callback
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const result = onSuccess.mock.calls[0][0];
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('test@example.com');
    });

    it('should apply default values from schema', async () => {
      const user = userEvent.setup();
      const dataSource = new MockDataSource();
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email', 'priority', 'is_active'],
            onSuccess,
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      });

      // Fill required fields only
      await user.type(screen.getByLabelText(/Full Name/i), 'Default Test');
      await user.type(screen.getByLabelText(/Email/i), 'default@example.com');

      // Submit
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const result = onSuccess.mock.calls[0][0];
      // Default values should be applied
      expect(result.priority).toBe(5);
      expect(result.is_active).toBe(true);
    });
  });

  describe('Edit Mode', () => {
    it('should load and display existing data', async () => {
      const dataSource = new MockDataSource();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'edit',
            recordId: '1',
            fields: ['name', 'email', 'company'],
          }}
          dataSource={dataSource}
        />
      );

      // Wait for data to load
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('John Doe');
      });

      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
      expect(emailInput.value).toBe('john@example.com');

      const companyInput = screen.getByLabelText(/Company/i) as HTMLInputElement;
      expect(companyInput.value).toBe('Acme Corp');
    });

    it('should update contact successfully', async () => {
      const user = userEvent.setup();
      const dataSource = new MockDataSource();
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'edit',
            recordId: '1',
            fields: ['name', 'email'],
            onSuccess,
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('John Doe');
      });

      // Update name
      const nameInput = screen.getByLabelText(/Full Name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'John Doe Updated');

      // Submit
      await user.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const result = onSuccess.mock.calls[0][0];
      expect(result.name).toBe('John Doe Updated');
      expect(result.id).toBe('1');
    });
  });

  describe('Field Types', () => {
    it('should render different field types correctly', async () => {
      const dataSource = new MockDataSource();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email', 'phone', 'priority', 'is_active', 'notes'],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      });

      // Text field
      const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
      expect(nameInput.type).toBe('text');

      // Email field
      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
      expect(emailInput.type).toBe('email');

      // Phone field
      const phoneInput = screen.getByLabelText(/Phone Number/i) as HTMLInputElement;
      expect(phoneInput.type).toBe('tel');

      // Number field
      const priorityInput = screen.getByLabelText(/Priority/i) as HTMLInputElement;
      expect(priorityInput.type).toBe('number');

      // Checkbox field
      const activeInput = screen.getByLabelText(/Active/i);
      expect(activeInput).toHaveRole('switch');

      // Textarea field
      const notesInput = screen.getByLabelText(/Notes/i) as HTMLTextAreaElement;
      expect(notesInput.tagName).toBe('TEXTAREA');
    });
  });

  describe('Callbacks', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const dataSource = new MockDataSource();
      const onCancel = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email'],
            showCancel: true,
            onCancel,
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Field Type Mapping Logic', () => {
    it('correctly maps various field types to expected inputs', async () => {
      const dataSource = new MockDataSource();
      vi.spyOn(dataSource, 'getObjectSchema').mockResolvedValue({
        name: 'test_mapping',
        fields: {
          text_f: { name: 'text_f', label: 'Text Type', type: 'text' },
          textarea_f: { name: 'textarea_f', label: 'Textarea Type', type: 'textarea' },
          number_f: { name: 'number_f', label: 'Number Type', type: 'number' },
          boolean_f: { name: 'boolean_f', label: 'Boolean Type', type: 'boolean' },
          email_f: { name: 'email_f', label: 'Email Type', type: 'email' },
          // Note: Date handling depends on implementation (native or custom widget)
        }
      });

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'test_mapping',
            mode: 'create'
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Loading form/i)).not.toBeInTheDocument();
      });

      // Verify Text (Input)
      const textInput = screen.getByLabelText('Text Type');
      expect(textInput.tagName).toBe('INPUT');
      expect(textInput).toHaveAttribute('type', 'text');

      // Verify Textarea
      const textarea = screen.getByLabelText('Textarea Type');
      expect(textarea.tagName).toBe('TEXTAREA');

      // Verify Number
      const numberInput = screen.getByLabelText('Number Type');
      expect(numberInput.tagName).toBe('INPUT');
      expect(numberInput).toHaveAttribute('type', 'number');

      // Verify Email
      const emailInput = screen.getByLabelText('Email Type');
      expect(emailInput.tagName).toBe('INPUT');
      expect(emailInput).toHaveAttribute('type', 'email');

      // Verify Boolean (Switch/Checkbox)
      expect(screen.getAllByText('Boolean Type').length).toBeGreaterThan(0);
      const switchControl = screen.getByRole('switch', { name: 'Boolean Type' });
      expect(switchControl).toBeInTheDocument();
    });
  });
});
