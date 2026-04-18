/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@object-ui/components';
import '@object-ui/fields';
import { FormSection } from './FormSection';
import { ObjectForm } from './ObjectForm';

describe('FormSection', () => {
  it('renders children without label', () => {
    render(
      <FormSection>
        <div data-testid="child">Field content</div>
      </FormSection>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders with label and description', () => {
    render(
      <FormSection label="Contact Info" description="Enter your contact details">
        <div>Field</div>
      </FormSection>
    );

    expect(screen.getByText('Contact Info')).toBeInTheDocument();
    expect(screen.getByText('Enter your contact details')).toBeInTheDocument();
  });

  it('supports collapsible behavior', async () => {
    const user = userEvent.setup();

    render(
      <FormSection label="Details" collapsible>
        <div data-testid="content">Collapsible content</div>
      </FormSection>
    );

    // Content should be visible initially
    expect(screen.getByTestId('content')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText('Details'));
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText('Details'));
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('starts collapsed when collapsed=true', () => {
    render(
      <FormSection label="Details" collapsible collapsed>
        <div data-testid="content">Hidden content</div>
      </FormSection>
    );

    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('applies multi-column grid classes', () => {
    const { container } = render(
      <FormSection columns={2}>
        <div>Field 1</div>
        <div>Field 2</div>
      </FormSection>
    );

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid?.className).toContain('md:grid-cols-2');
  });
});

describe('ObjectForm with formType', () => {
  const mockDataSource = {
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'contacts',
      fields: {
        firstName: { label: 'First Name', type: 'text', required: true },
        lastName: { label: 'Last Name', type: 'text', required: false },
        email: { label: 'Email', type: 'email', required: true },
        phone: { label: 'Phone', type: 'phone', required: false },
        street: { label: 'Street', type: 'text', required: false },
        city: { label: 'City', type: 'text', required: false },
      }
    }),
    findOne: vi.fn().mockResolvedValue({}),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
  };

  it('renders simple form by default (no formType)', async () => {
    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          fields: ['firstName', 'lastName'],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Wait for schema fetch
    await screen.findByText(/first name/i, {}, { timeout: 5000 });
    expect(screen.getByText(/last name/i)).toBeInTheDocument();
  });

  it('renders simple form with sections', async () => {
    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          formType: 'simple',
          sections: [
            {
              label: 'Personal Info',
              fields: ['firstName', 'lastName'],
              columns: 2,
            },
            {
              label: 'Contact Details',
              fields: ['email', 'phone'],
              columns: 2,
            },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Wait for schema fetch and section rendering
    await screen.findByText('Personal Info', {}, { timeout: 5000 });
    expect(screen.getByText('Contact Details')).toBeInTheDocument();
  });

  it('renders tabbed form with sections as tabs', async () => {
    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          formType: 'tabbed',
          sections: [
            {
              name: 'personal',
              label: 'Personal',
              fields: ['firstName', 'lastName'],
            },
            {
              name: 'contact',
              label: 'Contact',
              fields: ['email', 'phone'],
            },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Wait for tabs to render
    await screen.findByRole('tab', { name: 'Personal' }, { timeout: 5000 });
    expect(screen.getByRole('tab', { name: 'Contact' })).toBeInTheDocument();
  });

  it('renders drawer form with collapsible section collapsed by default', async () => {
    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          formType: 'drawer',
          open: true,
          sections: [
            {
              name: 'basic',
              label: 'Basic',
              fields: ['firstName', 'lastName'],
            },
            {
              name: 'advanced',
              label: 'Advanced',
              fields: ['email', 'phone'],
              collapsible: true,
              collapsed: true,
            } as any,
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    await screen.findByText('Basic', {}, { timeout: 5000 });
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    // Basic section fields are visible
    expect(screen.getByText(/first name/i)).toBeInTheDocument();
    // Advanced section fields are hidden (section starts collapsed)
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
  });

  it('renders wizard form with step indicator', async () => {
    render(
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'contacts',
          mode: 'create',
          formType: 'wizard',
          sections: [
            {
              label: 'Step 1: Basics',
              fields: ['firstName', 'lastName'],
            },
            {
              label: 'Step 2: Contact',
              fields: ['email', 'phone'],
            },
            {
              label: 'Step 3: Address',
              fields: ['street', 'city'],
            },
          ],
        }}
        dataSource={mockDataSource as any}
      />
    );

    // Wait for loading to finish - wizard shows "Step X of Y" counter
    await screen.findByText(/Step 1 of 3/, {}, { timeout: 5000 });
    
    // Should show Next button (not Submit, since we're on step 1)
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    
    // Step labels should be present (appears in both indicator and section header)
    expect(screen.getAllByText('Step 1: Basics').length).toBeGreaterThanOrEqual(1);
  });
});
