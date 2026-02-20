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

    await waitFor(() => {
      expect(screen.getByText('Create Event')).toBeInTheDocument();
    });

    // Footer should exist as a sibling to the scroll area, not inside it
    const footer = screen.getByTestId('modal-form-footer');
    expect(footer).toBeInTheDocument();
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
