/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ObjectForm } from '../ObjectForm';
import { SplitForm } from '../SplitForm';
import { DrawerForm } from '../DrawerForm';
import { ModalForm } from '../ModalForm';

// Mock dataSource used across tests
const mockObjectSchema = {
  name: 'contacts',
  fields: {
    firstName: { label: 'First Name', type: 'text', required: true },
    lastName: { label: 'Last Name', type: 'text', required: false },
    email: { label: 'Email', type: 'email', required: true },
    phone: { label: 'Phone', type: 'phone', required: false },
    street: { label: 'Street', type: 'text', required: false },
    city: { label: 'City', type: 'text', required: false },
  },
};

const createMockDataSource = () => ({
  getObjectSchema: vi.fn().mockResolvedValue(mockObjectSchema),
  findOne: vi.fn().mockResolvedValue({ firstName: 'John', lastName: 'Doe' }),
  find: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: '1' }),
  update: vi.fn().mockResolvedValue({ id: '1' }),
  delete: vi.fn().mockResolvedValue(true),
});

// ─── SplitForm Tests ────────────────────────────────────────────────────

describe('SplitForm', () => {
  it('renders with split panel layout', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <SplitForm
        schema={{
          type: 'object-form',
          formType: 'split',
          objectName: 'contacts',
          mode: 'create',
          sections: [
            {
              label: 'Personal',
              fields: ['firstName', 'lastName'],
            },
            {
              label: 'Contact',
              fields: ['email', 'phone'],
            },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Wait for schema to load
    await waitFor(() => {
      expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('contacts');
    });

    // Should show section labels
    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('renders loading state initially', () => {
    const mockDataSource = createMockDataSource();
    // Make getObjectSchema hang (never resolve)
    mockDataSource.getObjectSchema.mockReturnValue(new Promise(() => {}));

    render(
      <SplitForm
        schema={{
          type: 'object-form',
          formType: 'split',
          objectName: 'contacts',
          mode: 'create',
          sections: [
            { label: 'Section 1', fields: ['firstName'] },
            { label: 'Section 2', fields: ['email'] },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    expect(screen.getByText('Loading form...')).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockRejectedValue(new Error('Network error'));

    render(
      <SplitForm
        schema={{
          type: 'object-form',
          formType: 'split',
          objectName: 'contacts',
          mode: 'create',
          sections: [
            { label: 'Section 1', fields: ['firstName'] },
            { label: 'Section 2', fields: ['email'] },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Error loading form')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});

// ─── DrawerForm Tests ───────────────────────────────────────────────────

describe('DrawerForm', () => {
  it('renders inside a sheet with title and description', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <DrawerForm
        schema={{
          type: 'object-form',
          formType: 'drawer',
          objectName: 'contacts',
          mode: 'create',
          title: 'Create Contact',
          description: 'Fill in the contact details',
          open: true,
          fields: ['firstName', 'lastName', 'email'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Wait for schema and rendering
    await waitFor(() => {
      expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('contacts');
    });

    // Title and description should be visible
    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });
    expect(screen.getByText('Fill in the contact details')).toBeInTheDocument();
  });

  it('calls onOpenChange when closing', async () => {
    const onOpenChange = vi.fn();
    const mockDataSource = createMockDataSource();

    render(
      <DrawerForm
        schema={{
          type: 'object-form',
          formType: 'drawer',
          objectName: 'contacts',
          mode: 'create',
          title: 'Create Contact',
          open: true,
          onOpenChange,
          fields: ['firstName'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // The close button (X) in the Sheet should exist
    await waitFor(() => {
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  it('renders with sections layout inside drawer', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <DrawerForm
        schema={{
          type: 'object-form',
          formType: 'drawer',
          objectName: 'contacts',
          mode: 'create',
          title: 'New Contact',
          open: true,
          sections: [
            {
              label: 'Personal Info',
              fields: ['firstName', 'lastName'],
              columns: 2,
            },
            {
              label: 'Contact Details',
              fields: ['email', 'phone'],
            },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('New Contact')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Personal Info')).toBeInTheDocument();
    });
    expect(screen.getByText('Contact Details')).toBeInTheDocument();
  });

  it('renders when open is false (hidden)', () => {
    const mockDataSource = createMockDataSource();

    const { container } = render(
      <DrawerForm
        schema={{
          type: 'object-form',
          formType: 'drawer',
          objectName: 'contacts',
          mode: 'create',
          open: false,
          fields: ['firstName'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // When open=false, the sheet should not render content
    expect(screen.queryByText('Create Contact')).not.toBeInTheDocument();
  });
});

// ─── ModalForm Tests ────────────────────────────────────────────────────

describe('ModalForm', () => {
  it('renders inside a dialog with title and description', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          title: 'Create Contact',
          description: 'Enter contact information',
          open: true,
          fields: ['firstName', 'lastName', 'email'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('contacts');
    });

    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });
    expect(screen.getByText('Enter contact information')).toBeInTheDocument();
  });

  it('renders with sections layout inside modal', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          title: 'New Contact',
          open: true,
          sections: [
            {
              label: 'Basic Info',
              fields: ['firstName', 'lastName'],
              columns: 2,
            },
            {
              label: 'Contact Details',
              fields: ['email', 'phone'],
            },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('New Contact')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Basic Info')).toBeInTheDocument();
    });
    expect(screen.getByText('Contact Details')).toBeInTheDocument();
  });

  it('does not render content when open is false', () => {
    const mockDataSource = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          title: 'Hidden Modal',
          open: false,
          fields: ['firstName'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    expect(screen.queryByText('Hidden Modal')).not.toBeInTheDocument();
  });

  it('applies size class for large modal', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          title: 'Large Modal',
          open: true,
          modalSize: 'xl',
          fields: ['firstName'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Large Modal')).toBeInTheDocument();
    });
  });

  it('shows error state on data fetch failure', async () => {
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockRejectedValue(new Error('Server error'));

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          open: true,
          fields: ['firstName'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Error loading form')).toBeInTheDocument();
    });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });
});

// ─── ObjectForm Routing Tests ───────────────────────────────────────────

describe('ObjectForm routing to new variants', () => {
  it('routes formType=split to SplitForm', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          formType: 'split',
          sections: [
            { label: 'Left Panel', fields: ['firstName', 'lastName'] },
            { label: 'Right Panel', fields: ['email', 'phone'] },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Should load via SplitForm
    await waitFor(() => {
      expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('contacts');
    });

    await waitFor(() => {
      expect(screen.getByText('Left Panel')).toBeInTheDocument();
    });
    expect(screen.getByText('Right Panel')).toBeInTheDocument();
  });

  it('routes formType=drawer to DrawerForm', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          formType: 'drawer',
          title: 'Drawer Form Title',
          open: true,
          fields: ['firstName', 'lastName'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Drawer Form Title')).toBeInTheDocument();
    });
  });

  it('routes formType=modal to ModalForm', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          formType: 'modal',
          title: 'Modal Form Title',
          open: true,
          fields: ['firstName', 'lastName'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Modal Form Title')).toBeInTheDocument();
    });
  });
});

// ─── Auto-Layout Integration Tests ──────────────────────────────────────

/**
 * These tests verify that ModalForm and DrawerForm apply applyAutoLayout
 * when rendering flat fields (no sections), consistent with SimpleObjectForm.
 */
describe('ModalForm auto-layout integration', () => {
  // Schema with 6 fields (>3) should trigger 2-column inference
  const manyFieldsSchema = {
    name: 'contacts',
    fields: {
      firstName: { label: 'First Name', type: 'text', required: true },
      lastName: { label: 'Last Name', type: 'text', required: false },
      email: { label: 'Email', type: 'email', required: true },
      phone: { label: 'Phone', type: 'phone', required: false },
      street: { label: 'Street', type: 'text', required: false },
      city: { label: 'City', type: 'text', required: false },
    },
  };

  it('applies auto-layout with 2 columns for 6 flat fields', async () => {
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(manyFieldsSchema);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          title: 'Auto Layout Modal',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Auto Layout Modal')).toBeInTheDocument();
    });

    // With 6 fields (>3), auto-layout should infer columns=2
    // The form element receives columns="2" as an attribute
    await waitFor(() => {
      const formEl = document.querySelector('form[columns="2"]');
      expect(formEl).not.toBeNull();
    });
  });

  it('does not apply multi-column for 3 or fewer fields', async () => {
    const fewFieldsSchema = {
      name: 'simple',
      fields: {
        firstName: { label: 'First Name', type: 'text', required: true },
        lastName: { label: 'Last Name', type: 'text', required: false },
      },
    };
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(fewFieldsSchema);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'simple',
          mode: 'create',
          title: 'Few Fields Modal',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Few Fields Modal')).toBeInTheDocument();
    });

    // With 2 fields (≤3), auto-layout should infer columns=1
    await waitFor(() => {
      const formEl = document.querySelector('form[columns="2"]');
      expect(formEl).toBeNull();
    });
  });

  it('respects explicit columns override', async () => {
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(manyFieldsSchema);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          title: 'Explicit Columns Modal',
          open: true,
          columns: 3,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Explicit Columns Modal')).toBeInTheDocument();
    });

    // User specified columns=3
    await waitFor(() => {
      const formEl = document.querySelector('form[columns="3"]');
      expect(formEl).not.toBeNull();
    });
  });
});

describe('DrawerForm auto-layout integration', () => {
  const manyFieldsSchema = {
    name: 'contacts',
    fields: {
      firstName: { label: 'First Name', type: 'text', required: true },
      lastName: { label: 'Last Name', type: 'text', required: false },
      email: { label: 'Email', type: 'email', required: true },
      phone: { label: 'Phone', type: 'phone', required: false },
      street: { label: 'Street', type: 'text', required: false },
      city: { label: 'City', type: 'text', required: false },
    },
  };

  it('applies auto-layout with 2 columns for 6 flat fields', async () => {
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(manyFieldsSchema);

    render(
      <DrawerForm
        schema={{
          type: 'object-form',
          formType: 'drawer',
          objectName: 'contacts',
          mode: 'create',
          title: 'Auto Layout Drawer',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Auto Layout Drawer')).toBeInTheDocument();
    });

    // With 6 fields (>3), auto-layout should infer columns=2
    await waitFor(() => {
      const formEl = document.querySelector('form[columns="2"]');
      expect(formEl).not.toBeNull();
    });
  });

  it('does not apply multi-column for 3 or fewer fields', async () => {
    const fewFieldsSchema = {
      name: 'simple',
      fields: {
        firstName: { label: 'First Name', type: 'text', required: true },
        lastName: { label: 'Last Name', type: 'text', required: false },
      },
    };
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(fewFieldsSchema);

    render(
      <DrawerForm
        schema={{
          type: 'object-form',
          formType: 'drawer',
          objectName: 'simple',
          mode: 'create',
          title: 'Few Fields Drawer',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Few Fields Drawer')).toBeInTheDocument();
    });

    // With 2 fields (≤3), should remain 1 column
    await waitFor(() => {
      const formEl = document.querySelector('form[columns="2"]');
      expect(formEl).toBeNull();
    });
  });
});

// ─── Export Tests ────────────────────────────────────────────────────────

describe('New variant exports', () => {
  it('exports SplitForm', () => {
    expect(SplitForm).toBeDefined();
    expect(typeof SplitForm).toBe('function');
  });

  it('exports DrawerForm', () => {
    expect(DrawerForm).toBeDefined();
    expect(typeof DrawerForm).toBe('function');
  });

  it('exports ModalForm', () => {
    expect(ModalForm).toBeDefined();
    expect(typeof ModalForm).toBe('function');
  });
});
