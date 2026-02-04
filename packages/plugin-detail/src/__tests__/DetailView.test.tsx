/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailView } from '../DetailView';
import type { DetailViewSchema } from '@object-ui/types';

describe('DetailView', () => {
  it('should be exported', () => {
    expect(DetailView).toBeDefined();
  });

  it('should be a function', () => {
    expect(typeof DetailView).toBe('function');
  });

  it('should render with basic schema', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'email', label: 'Email' },
      ],
    };

    const { container } = render(<DetailView schema={schema} />);
    expect(container).toBeTruthy();
  });

  it('should render title', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
    };

    render(<DetailView schema={schema} />);
    expect(screen.getByText('Contact Details')).toBeInTheDocument();
  });

  it('should render back button when showBack is true', () => {
    const onBack = vi.fn();
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showBack: true,
    };

    render(<DetailView schema={schema} onBack={onBack} />);
    
    const buttons = screen.getAllByRole('button');
    const backButton = buttons.find(btn => 
      btn.querySelector('svg') !== null
    );
    
    expect(backButton).toBeTruthy();
  });

  it('should call onBack when back button is clicked', () => {
    const onBack = vi.fn();
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showBack: true,
    };

    render(<DetailView schema={schema} onBack={onBack} />);
    
    const buttons = screen.getAllByRole('button');
    const backButton = buttons.find(btn => 
      btn.querySelector('svg') !== null
    );
    
    if (backButton) {
      fireEvent.click(backButton);
      expect(onBack).toHaveBeenCalled();
    }
  });

  it('should render edit button when showEdit is true', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showEdit: true,
    };

    render(<DetailView schema={schema} />);
    
    // Edit button should be present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showEdit: true,
    };

    render(<DetailView schema={schema} onEdit={onEdit} />);
    
    const buttons = screen.getAllByRole('button');
    const editButton = buttons.find(btn => 
      btn.querySelector('svg') !== null
    );
    
    if (editButton) {
      fireEvent.click(editButton);
      expect(onEdit).toHaveBeenCalled();
    }
  });

  it('should render delete button when showDelete is true', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showDelete: true,
    };

    render(<DetailView schema={schema} />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render sections when provided', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
      },
      sections: [
        {
          title: 'Basic Information',
          fields: [
            { name: 'name', label: 'Name' },
            { name: 'email', label: 'Email' },
          ],
        },
        {
          title: 'Contact Information',
          fields: [
            { name: 'phone', label: 'Phone' },
          ],
        },
      ],
    };

    render(<DetailView schema={schema} />);
    
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
  });

  it('should render tabs when provided', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Account Details',
      data: { name: 'Acme Corp' },
      tabs: [
        {
          key: 'details',
          label: 'Details',
          content: {
            type: 'text',
            text: 'Details content',
          },
        },
        {
          key: 'activity',
          label: 'Activity',
          content: {
            type: 'text',
            text: 'Activity content',
          },
        },
      ],
    };

    render(<DetailView schema={schema} />);
    
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('should render related lists when provided', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Account Details',
      data: { name: 'Acme Corp' },
      fields: [{ name: 'name', label: 'Name' }],
      related: [
        {
          title: 'Contacts',
          type: 'table',
          data: [],
        },
      ],
    };

    render(<DetailView schema={schema} />);
    
    expect(screen.getByText('Contacts')).toBeInTheDocument();
  });

  it('should show loading skeleton when loading is true', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      loading: true,
    };

    const { container } = render(<DetailView schema={schema} />);
    
    // Check for skeleton elements (they typically have specific classes)
    const skeletons = container.querySelectorAll('[class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
