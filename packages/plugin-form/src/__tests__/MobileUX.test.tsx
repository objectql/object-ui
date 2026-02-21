/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Mobile UX Tests for ModalForm
 *
 * Validates mobile-specific optimizations:
 * - Skeleton loading state (replaces spinner)
 * - Flex layout structure with sticky header/footer
 * - Full-screen modal on mobile (h-[100dvh])
 * - Close button touch target (min 44×44px)
 * - Sticky footer with action buttons outside scroll area
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ModalForm } from '../ModalForm';

const mockObjectSchema = {
  name: 'events',
  fields: {
    subject: { label: 'Subject', type: 'text', required: true },
    start: { label: 'Start', type: 'datetime', required: true },
    end: { label: 'End', type: 'datetime', required: true },
    location: { label: 'Location', type: 'text', required: false },
    description: { label: 'Description', type: 'textarea', required: false },
    participants: { label: 'Participants', type: 'lookup', required: false },
    type: { label: 'Type', type: 'select', required: false, options: [{ value: 'meeting', label: 'Meeting' }] },
  },
};

const createMockDataSource = () => ({
  getObjectSchema: vi.fn().mockResolvedValue(mockObjectSchema),
  findOne: vi.fn().mockResolvedValue({ id: '1', subject: 'Test Event' }),
  find: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({ id: '1' }),
  update: vi.fn().mockResolvedValue({ id: '1' }),
  delete: vi.fn().mockResolvedValue(true),
});

describe('ModalForm Mobile UX', () => {
  it('renders skeleton loading instead of spinner', () => {
    const mockDataSource = createMockDataSource();
    // Make getObjectSchema hang (never resolve) to keep loading state
    mockDataSource.getObjectSchema.mockReturnValue(new Promise(() => {}));

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'events',
          mode: 'create',
          title: 'Create Event',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Should show skeleton loading, not the old spinner text
    expect(screen.queryByText('Loading form...')).not.toBeInTheDocument();
    expect(screen.getByTestId('modal-form-skeleton')).toBeInTheDocument();
  });

  it('renders with full-screen mobile classes and flex layout on MobileDialogContent', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'events',
          mode: 'create',
          title: 'Create Event',
          description: 'Add a new Event to your database.',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Event')).toBeInTheDocument();
    });
    expect(screen.getByText('Add a new Event to your database.')).toBeInTheDocument();

    // MobileDialogContent should be rendered via portal
    const dialogContent = document.querySelector('[role="dialog"]');
    expect(dialogContent).not.toBeNull();
    const cls = dialogContent!.className;
    // Mobile full-screen
    expect(cls).toContain('h-[100dvh]');
    // Flex column layout for sticky header/footer
    expect(cls).toContain('flex');
    expect(cls).toContain('flex-col');
    // Overflow hidden (scroll is on the body area)
    expect(cls).toContain('overflow-hidden');
  });

  it('close button has accessible touch target (≥44×44px on mobile)', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'events',
          mode: 'create',
          title: 'Create Event',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Event')).toBeInTheDocument();
    });

    // Close button should have WCAG-compliant touch target classes
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
    const cls = closeButton.className;
    expect(cls).toContain('min-h-[44px]');
    expect(cls).toContain('min-w-[44px]');
  });

  it('renders sticky footer with action buttons outside scroll area', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'events',
          mode: 'create',
          title: 'Create Event',
          open: true,
          showSubmit: true,
          showCancel: true,
          submitText: 'Save Record',
          cancelText: 'Cancel',
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Footer should exist as a sibling to the scroll area, not inside it
    const footer = await screen.findByTestId('modal-form-footer');
    expect(footer.className).toContain('border-t');
    expect(footer.className).toContain('shrink-0');

    // Action buttons should be in the footer
    const saveButton = screen.getByRole('button', { name: /save record/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(footer.contains(saveButton)).toBe(true);
    expect(footer.contains(cancelButton)).toBe(true);
  });

  it('does not show footer during loading or error states', () => {
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockReturnValue(new Promise(() => {}));

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'events',
          mode: 'create',
          title: 'Create Event',
          open: true,
          showSubmit: true,
          showCancel: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    // While loading, footer should not be rendered
    expect(screen.queryByTestId('modal-form-footer')).not.toBeInTheDocument();
  });
});

describe('ModalForm Container Query Layout', () => {
  /** CSS selector for the @container query context element */
  const CONTAINER_SELECTOR = '.\\@container';

  it('applies @container class on scrollable content area', async () => {
    const mockDataSource = createMockDataSource();

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'events',
          mode: 'create',
          title: 'Create Event',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Event')).toBeInTheDocument();
    });

    // The scrollable content wrapper should be a @container query context
    const dialogContent = document.querySelector('[role="dialog"]');
    expect(dialogContent).not.toBeNull();
    const scrollArea = dialogContent!.querySelector(CONTAINER_SELECTOR);
    expect(scrollArea).not.toBeNull();
    expect(scrollArea!.className).toContain('overflow-y-auto');
  });

  it('uses container-query grid classes for multi-column flat fields', async () => {
    // Mock schema with enough fields to trigger auto-layout 2-column
    const manyFieldsSchema = {
      name: 'contacts',
      fields: {
        name: { label: 'Name', type: 'text', required: true },
        email: { label: 'Email', type: 'email', required: false },
        phone: { label: 'Phone', type: 'phone', required: false },
        company: { label: 'Company', type: 'text', required: false },
        department: { label: 'Department', type: 'text', required: false },
        title: { label: 'Title', type: 'text', required: false },
      },
    };
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(manyFieldsSchema);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          title: 'Create Contact',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });

    // Wait for fields to render
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // The form field container should use container-query classes (@md:grid-cols-2)
    // instead of viewport-based classes (md:grid-cols-2)
    const dialogContent = document.querySelector('[role="dialog"]');
    const containerEl = dialogContent!.querySelector(CONTAINER_SELECTOR);
    expect(containerEl).not.toBeNull();

    // Look for the grid container with @md:grid-cols-2
    const gridEl = containerEl!.querySelector('[class*="@md:grid-cols-2"]');
    expect(gridEl).not.toBeNull();
    expect(gridEl!.className).toContain('@md:grid-cols-2');
    // Should NOT use viewport-based md:grid-cols-2 (without @ prefix)
    expect(gridEl!.className).not.toContain(' md:grid-cols-2');
  });

  it('single-column forms do not get container grid override', async () => {
    // Only 3 fields → auto-layout stays at 1 column
    const fewFieldsSchema = {
      name: 'notes',
      fields: {
        title: { label: 'Title', type: 'text', required: true },
        body: { label: 'Body', type: 'textarea', required: false },
        status: { label: 'Status', type: 'select', required: false, options: [{ value: 'draft', label: 'Draft' }] },
      },
    };
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(fewFieldsSchema);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'notes',
          mode: 'create',
          title: 'Create Note',
          open: true,
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Note')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument();
    });

    // Single column form should not have @md:grid-cols-2
    const dialogContent = document.querySelector('[role="dialog"]');
    const containerEl = dialogContent!.querySelector(CONTAINER_SELECTOR);
    expect(containerEl).not.toBeNull();
    const gridEl = containerEl!.querySelector('[class*="@md:grid-cols"]');
    expect(gridEl).toBeNull();
  });

  it('uses container-query grid classes for multi-column sections (not viewport-based)', async () => {
    const sectionSchema = {
      name: 'deals',
      fields: {
        name: { label: 'Deal Name', type: 'text', required: true },
        amount: { label: 'Amount', type: 'currency', required: false },
        stage: { label: 'Stage', type: 'select', required: false, options: [{ value: 'open', label: 'Open' }] },
        close_date: { label: 'Close Date', type: 'date', required: false },
        owner: { label: 'Owner', type: 'text', required: false },
        notes: { label: 'Notes', type: 'textarea', required: false },
      },
    };
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(sectionSchema);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'deals',
          mode: 'create',
          title: 'Create Deal',
          open: true,
          sections: [
            {
              label: 'Deal Info',
              columns: 2,
              fields: ['name', 'amount', 'stage', 'close_date'],
            },
            {
              label: 'Additional',
              columns: 1,
              fields: ['owner', 'notes'],
            },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Deal')).toBeInTheDocument();
    });

    // Wait for sections to render
    await waitFor(() => {
      expect(screen.getByText('Deal Info')).toBeInTheDocument();
    });

    const dialogContent = document.querySelector('[role="dialog"]');
    const containerEl = dialogContent!.querySelector(CONTAINER_SELECTOR);
    expect(containerEl).not.toBeNull();

    // The 2-column section should use container-query classes
    const gridEl = containerEl!.querySelector('[class*="@md:grid-cols-2"]');
    expect(gridEl).not.toBeNull();
    expect(gridEl!.className).toContain('@md:grid-cols-2');
    // Should NOT use viewport-based md:grid-cols-2 (without @ prefix)
    expect(gridEl!.className).not.toContain(' md:grid-cols-2');
  });

  it('section fieldContainerClass is never overridden by viewport-based fallback', async () => {
    const sectionSchema = {
      name: 'contacts',
      fields: {
        first_name: { label: 'First Name', type: 'text', required: true },
        last_name: { label: 'Last Name', type: 'text', required: true },
        email: { label: 'Email', type: 'email', required: false },
        phone: { label: 'Phone', type: 'phone', required: false },
      },
    };
    const mockDataSource = createMockDataSource();
    mockDataSource.getObjectSchema.mockResolvedValue(sectionSchema);

    render(
      <ModalForm
        schema={{
          type: 'object-form',
          formType: 'modal',
          objectName: 'contacts',
          mode: 'create',
          title: 'Create Contact',
          open: true,
          sections: [
            {
              label: 'Contact Info',
              columns: 2,
              fields: ['first_name', 'last_name', 'email', 'phone'],
            },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Create Contact')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Contact Info')).toBeInTheDocument();
    });

    // Ensure no viewport-based md:grid-cols-* classes exist anywhere in the dialog
    const dialogContent = document.querySelector('[role="dialog"]');
    const allElements = dialogContent!.querySelectorAll('*');
    for (const el of allElements) {
      const cls = el.className;
      if (typeof cls === 'string' && cls.includes('grid-cols-')) {
        // Any grid-cols class should be either plain grid-cols-1 or @-prefixed container query
        const gridColMatches = cls.match(/(?:^|\s)(md:|lg:|xl:)(grid-cols-\d)/g);
        expect(gridColMatches).toBeNull();
      }
    }
  });
});
