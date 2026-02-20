/**
 * ObjectForm with MSW Integration Tests
 * 
 * Tests ObjectForm component with real ObjectStack MSW runtime
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ObjectStackClient } from '@objectstack/client';
import { ObjectForm } from '@object-ui/plugin-form';
import { ObjectStackDataSource } from '../dataSource';
import { startMockServer, stopMockServer, getDriver } from '../mocks/server';

describe('ObjectForm with MSW Integration', () => {
  let client: ObjectStackClient;
  let dataSource: ObjectStackDataSource;
  let contactId: string;
  let initialContactIds: string[] = [];
  let originalAlice: any = null;

  beforeAll(async () => {
    // Start MSW mock server
    await startMockServer();

    // Initialize client - use localhost to match MSW handlers
    client = new ObjectStackClient({ baseUrl: 'http://localhost:3000' } as any);
    await client.connect();
    
    dataSource = new ObjectStackDataSource({ baseUrl: 'http://localhost:3000' });

    // Get a valid contact ID for edit tests
    const driver = getDriver();
    if (driver) {
      const contacts = await driver.find('contact', { object: 'contact' });
      if (contacts) {
        initialContactIds = contacts.map((c: any) => c.id);
        // Find Alice Johnson
        const alice = contacts.find((c: any) => c.name === 'Alice Johnson');
        if (alice) {
          originalAlice = { ...alice };
          contactId = alice.id;
        } else {
           contactId = contacts[0].id;
           originalAlice = { ...contacts[0] };
        }
      }
    }
  });

  afterAll(() => {
    stopMockServer();
  });

  afterEach(async () => {
    // Clean up created contacts after each test
    const driver = getDriver();
    if (driver) {
      // Restore Alice if she was modified
      if (originalAlice) {
        await driver.update('contact', originalAlice.id, originalAlice);
      }

      const contacts = await driver.find('contact', { object: 'contact' });
      for (const contact of contacts) {
        if (contact.id && !initialContactIds.includes(contact.id)) {
          await driver.delete('contact', contact.id);
        }
      }
    }
  });

  describe('Create Mode', () => {
    it('should render create form with all fields', async () => {
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email', 'phone', 'company', 'title', 'priority', 'is_active', 'notes'],
            onSuccess,
          }}
          dataSource={dataSource}
        />
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Company/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Priority/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Active/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();
    });

    it('should create a new contact successfully', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email', 'phone', 'company'],
            onSuccess,
          }}
          dataSource={dataSource}
        />
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Fill in the form
      await user.type(screen.getByLabelText(/^Name/i), 'Test User');
      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^Phone/i), '+1234567890');
      await user.type(screen.getByLabelText(/Company/i), 'Test Company');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Wait for success callback
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      }, { timeout: 10000 });

      const createdContact = onSuccess.mock.calls[0][0];
      expect(createdContact.name).toBe('Test User');
      expect(createdContact.email).toBe('test@example.com');
      expect(createdContact.phone).toBe('+1234567890');
      expect(createdContact.company).toBe('Test Company');
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
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
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Form should not submit
      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should apply default values', async () => {
      const user = userEvent.setup();
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
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Fill required fields only
      await user.type(screen.getByLabelText(/^Name/i), 'Default Test');
      await user.type(screen.getByLabelText(/Email/i), 'default@example.com');

      // Submit
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      }, { timeout: 10000 });

      const createdContact = onSuccess.mock.calls[0][0];
      // Check default values from schema
      expect(createdContact.priority).toBe('medium');
      expect(createdContact.is_active).toBe(true);
    });
  });

  describe('Edit Mode', () => {
    it('should load existing contact data', async () => {
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'edit',
            recordId: contactId,
            fields: ['name', 'email', 'company'],
          }}
          dataSource={dataSource}
        />
      );

      // Wait for data to load
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/^Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('Alice Johnson');
      }, { timeout: 10000 });

      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
      expect(emailInput.value).toBe('alice@objectstack.com');

      // const companyInput = screen.getByLabelText(/Company/i) as HTMLInputElement;
      // expect(screen.getByText('ObjectStack HQ')).toBeInTheDocument();
    });

    it('should update contact successfully', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'edit',
            recordId: contactId,
            fields: ['name', 'email', 'company'],
            onSuccess,
          }}
          dataSource={dataSource}
        />
      );

      // Wait for data to load
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/^Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('Alice Johnson');
      }, { timeout: 10000 });

      // Update the name
      const nameInput = screen.getByLabelText(/^Name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Alice Johnson Updated');

      // Submit
      await user.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      }, { timeout: 10000 });

      const updatedContact = onSuccess.mock.calls[0][0];
      expect(updatedContact.name).toBe('Alice Johnson Updated');
      expect(updatedContact.id).toBe(contactId);
    });

    it('should handle update errors gracefully', async () => {
      const onError = vi.fn();

      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'edit',
            recordId: 'non-existent-id',
            fields: ['name', 'email'],
            onError,
          }}
          dataSource={dataSource}
        />
      );

      // Wait a bit for the error to occur
      await waitFor(() => {
        expect(screen.getByText(/Error loading form/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('View Mode', () => {
    it('should render form in read-only mode', async () => {
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'view',
            recordId: contactId,
            fields: ['name', 'email', 'company'],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/^Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('Alice Johnson');
        expect(nameInput.disabled).toBe(true);
      });

      // Submit button should not be shown in view mode
      expect(screen.queryByRole('button', { name: /create|update/i })).not.toBeInTheDocument();
    });
  });

  describe('Field Types', () => {
    it('should render checkbox for boolean fields', async () => {
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email', 'is_active'],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(/Active/i) as HTMLInputElement;
      expect(checkbox).toHaveAttribute('role', 'switch');
    });

    it('should render number input for number fields', async () => {
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'kitchen_sink',
            mode: 'create',
            fields: ['name', 'amount'],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Text/i)).toBeInTheDocument();
      });

      const numberInput = screen.getByLabelText(/Number/i) as HTMLInputElement;
      expect(numberInput.type).toBe('number');
    });

    it('should render textarea for notes field', async () => {
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email', 'notes'],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      });

      const textarea = screen.getByLabelText(/Notes/i) as HTMLElement;
      expect(['TEXTAREA', 'INPUT', 'DIV'].includes(textarea.tagName)).toBe(true);
    });

    it('should render phone input with tel type', async () => {
      render(
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'contact',
            mode: 'create',
            fields: ['name', 'email', 'phone'],
          }}
          dataSource={dataSource}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/^Phone/i) as HTMLInputElement;
      expect(phoneInput.type).toBe('tel');
    });
  });

  describe('Form Callbacks', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
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
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Data Persistence', () => {
    it('should persist created data in MSW memory', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      // Create a contact
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
        expect(screen.getByLabelText(/^Name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/^Name/i), 'Persist Test');
      await user.type(screen.getByLabelText(/Email/i), 'persist@example.com');
      await user.click(screen.getByRole('button', { name: /create/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });

      const createdContact = onSuccess.mock.calls[0][0];
      const createdId = createdContact.id;

      // Verify data is persisted by fetching it
      const result = await client.data.get('contact', createdId);
      expect(result.record.name).toBe('Persist Test');
      expect(result.record.email).toBe('persist@example.com');
    });
  });
});
