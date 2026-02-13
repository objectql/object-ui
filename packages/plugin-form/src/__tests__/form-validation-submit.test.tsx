/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.4 Integration Test — Form Validation + Submit Workflow
 *
 * Tests the full lifecycle: required-field validation → inline errors →
 * successful submit → form reset.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ObjectForm } from '../ObjectForm';

// ─── Shared Fixtures ────────────────────────────────────────────────────

const mockObjectSchema = {
  name: 'contacts',
  fields: {
    firstName: { label: 'First Name', type: 'text', required: true },
    lastName: { label: 'Last Name', type: 'text', required: false },
    email: { label: 'Email', type: 'email', required: true },
  },
};

const createMockDataSource = () => ({
  getObjectSchema: vi.fn().mockResolvedValue(mockObjectSchema),
  findOne: vi.fn().mockResolvedValue({}),
  find: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: '1' }),
  update: vi.fn().mockResolvedValue({ id: '1' }),
  delete: vi.fn().mockResolvedValue(true),
});

// ─── Tests ──────────────────────────────────────────────────────────────

describe('P3.4 Form Validation + Submit Workflow', () => {
  let mockDataSource: ReturnType<typeof createMockDataSource>;

  beforeEach(() => {
    mockDataSource = createMockDataSource();
  });

  // --- Required field validation before submit ---

  it('validates required fields and prevents submission when empty', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          fields: ['firstName', 'email'],
          onSuccess,
        }}
        dataSource={mockDataSource as any}
      />,
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByText('First Name')).toBeInTheDocument();
    });

    // Click submit without filling in required fields
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    // The data source should NOT have been called
    await waitFor(() => {
      expect(mockDataSource.create).not.toHaveBeenCalled();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // --- Inline validation errors ---

  it('shows inline validation error messages for required fields', async () => {
    const user = userEvent.setup();

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          fields: ['firstName', 'email'],
        }}
        dataSource={mockDataSource as any}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('First Name')).toBeInTheDocument();
    });

    // Submit with empty required fields
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    // Validation messages should appear
    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    });
  });

  // --- Successful submit calls handler ---

  it('calls onSuccess handler after successful submission', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          fields: ['firstName', 'email'],
          onSuccess,
        }}
        dataSource={mockDataSource as any}
      />,
    );

    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByText('First Name')).toBeInTheDocument();
    });

    // Fill in the required fields
    const inputs = screen.getAllByRole('textbox');
    // First Name input
    await user.type(inputs[0], 'John');
    // Email input
    await user.type(inputs[1], 'john@example.com');

    // Submit
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    // dataSource.create should have been called
    await waitFor(() => {
      expect(mockDataSource.create).toHaveBeenCalledWith(
        'contacts',
        expect.objectContaining({
          firstName: 'John',
          email: 'john@example.com',
        }),
      );
    });

    // onSuccess should have been called with result
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ id: '1' });
    });
  });

  // --- Form reset after submit ---

  it('resets form fields after successful submission when showReset is true', async () => {
    const user = userEvent.setup();

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          fields: ['firstName', 'email'],
          showReset: true,
          onSuccess: vi.fn(),
        }}
        dataSource={mockDataSource as any}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('First Name')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Jane');
    await user.type(inputs[1], 'jane@example.com');

    // Submit
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    // After successful submit the inputs should be cleared
    await waitFor(() => {
      expect(mockDataSource.create).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(inputs[0]).toHaveValue('');
    });
  });

  // --- Inline-field form (no dataSource) ---

  it('supports inline customFields without a dataSource', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'inline_form',
          mode: 'create',
          customFields: [
            { name: 'username', label: 'Username', type: 'input', required: true },
          ],
          onSuccess,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    // Submit empty — should not succeed
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);
    expect(onSuccess).not.toHaveBeenCalled();

    // Fill in and resubmit
    const input = screen.getByRole('textbox');
    await user.type(input, 'admin');
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'admin' }),
      );
    });
  });

  // --- Error callback on failed submission ---

  it('calls onError when dataSource.create rejects', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    mockDataSource.create.mockRejectedValueOnce(new Error('Network failure'));

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          fields: ['firstName', 'email'],
          onError,
        }}
        dataSource={mockDataSource as any}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('First Name')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'John');
    await user.type(inputs[1], 'john@example.com');

    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
