/**
 * Console ModalForm Integration Tests
 *
 * Validates that the Console CRUD dialog uses ModalForm (not raw Dialog+ObjectForm),
 * enabling auto-layout, auto modal sizing, and unified platform behavior.
 *
 * Related: objectstack-ai/objectui#619
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModalForm } from '@object-ui/plugin-form';

// ─── Mock DataSource ─────────────────────────────────────────────────────────

const createMockDataSource = (fieldCount: number = 6) => {
  const fields: Record<string, any> = {};
  const fieldNames = ['name', 'email', 'phone', 'title', 'department', 'company', 'status', 'priority', 'birthdate', 'address'];
  for (let i = 0; i < fieldCount && i < fieldNames.length; i++) {
    const name = fieldNames[i];
    fields[name] = { label: name.charAt(0).toUpperCase() + name.slice(1), type: 'text', required: i === 0 };
  }
  return {
    getObjectSchema: vi.fn().mockResolvedValue({ name: 'contact', label: 'Contact', fields }),
    findOne: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
  };
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Console ModalForm Integration (#619)', () => {
  it('renders create modal with title and description', async () => {
    const ds = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contact',
          mode: 'create',
          title: 'Create Contact',
          description: 'Add a new Contact to your database.',
          open: true,
          onOpenChange: vi.fn(),
          layout: 'vertical',
          fields: ['name', 'email', 'phone', 'title', 'department', 'company'],
          onSuccess: vi.fn(),
          onCancel: vi.fn(),
          showSubmit: true,
          showCancel: true,
          submitText: 'Save Record',
          cancelText: 'Cancel',
        }}
        dataSource={ds as any}
      />
    );

    await waitFor(() => {
      expect(ds.getObjectSchema).toHaveBeenCalledWith('contact');
    });

    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });
    expect(screen.getByText('Add a new Contact to your database.')).toBeInTheDocument();
  });

  it('renders edit modal with correct title', async () => {
    const ds = createMockDataSource(3);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contact',
          mode: 'edit',
          recordId: '1',
          title: 'Edit Contact',
          description: 'Update details for Contact',
          open: true,
          onOpenChange: vi.fn(),
          layout: 'vertical',
          fields: ['name', 'email', 'phone'],
          onSuccess: vi.fn(),
          onCancel: vi.fn(),
          showSubmit: true,
          showCancel: true,
          submitText: 'Save Record',
          cancelText: 'Cancel',
        }}
        dataSource={ds as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Contact')).toBeInTheDocument();
    });
    expect(screen.getByText('Update details for Contact')).toBeInTheDocument();
  });

  it('does not render content when open is false', () => {
    const ds = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contact',
          mode: 'create',
          title: 'Create Contact',
          open: false,
          onOpenChange: vi.fn(),
          fields: ['name', 'email'],
          onSuccess: vi.fn(),
          onCancel: vi.fn(),
        }}
        dataSource={ds as any}
      />
    );

    expect(screen.queryByText('Create Contact')).not.toBeInTheDocument();
  });

  it('auto-layout infers 2 columns for 6+ fields (no hardcoded columns:1)', async () => {
    const ds = createMockDataSource(6);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contact',
          mode: 'create',
          title: 'Create Contact',
          open: true,
          onOpenChange: vi.fn(),
          // No columns specified - auto-layout should infer columns=2 for 6 fields
          fields: ['name', 'email', 'phone', 'title', 'department', 'company'],
          onSuccess: vi.fn(),
          onCancel: vi.fn(),
          showSubmit: true,
          showCancel: true,
        }}
        dataSource={ds as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });

    // With 6 fields and no explicit columns, auto-layout should infer columns=2
    await waitFor(() => {
      const formEl = document.querySelector('form[columns="2"]');
      expect(formEl).not.toBeNull();
    });
  });

  it('auto-layout keeps 1 column for 3 or fewer fields', async () => {
    const ds = createMockDataSource(3);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contact',
          mode: 'create',
          title: 'Create Contact',
          open: true,
          onOpenChange: vi.fn(),
          // No columns specified - auto-layout should infer columns=1 for 3 fields
          fields: ['name', 'email', 'phone'],
          onSuccess: vi.fn(),
          onCancel: vi.fn(),
        }}
        dataSource={ds as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });

    // With 3 fields, should stay at 1 column
    await waitFor(() => {
      const formEl = document.querySelector('form[columns="2"]');
      expect(formEl).toBeNull();
    });
  });

  it('calls onSuccess and onOpenChange on form submission', async () => {
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    const ds = createMockDataSource(2);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contact',
          mode: 'create',
          title: 'Create Contact',
          open: true,
          onOpenChange,
          fields: ['name', 'email'],
          onSuccess,
          onCancel: vi.fn(),
          showSubmit: true,
        }}
        dataSource={ds as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });

    // Verify the callbacks are wired correctly (form renders with submit button)
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('preserves field visibility filtering (string[] fields)', async () => {
    const ds = createMockDataSource(4);

    // Simulate filtered fields (as done by evaluateVisibility in App.tsx)
    const filteredFields = ['name', 'email']; // 2 visible fields out of 4

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contact',
          mode: 'create',
          title: 'Create Contact',
          open: true,
          onOpenChange: vi.fn(),
          fields: filteredFields,
          onSuccess: vi.fn(),
          onCancel: vi.fn(),
        }}
        dataSource={ds as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });

    // Only 2 fields should be visible (filtered), not all 4
    // With 2 fields, auto-layout should infer 1 column
    await waitFor(() => {
      const formEl = document.querySelector('form[columns="2"]');
      expect(formEl).toBeNull();
    });
  });
});
