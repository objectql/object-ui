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
      // Disable back button to ensure it's not the first button found if using generic search
      showBack: false 
    };

    render(<DetailView schema={schema} onEdit={onEdit} />);
    
    // Find button with text "Edit"
    const editButton = screen.getByRole('button', { name: /edit/i });
    
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
    
    // Check for skeleton elements (they typically have animate-pulse class)
    // DetailedView uses Skeleton component which has animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render prev/next navigation when recordNavigation is provided', () => {
    const onNavigate = vi.fn();
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showBack: false,
      recordNavigation: {
        recordIds: ['id1', 'id2', 'id3'],
        currentIndex: 1,
        onNavigate,
      },
    };

    render(<DetailView schema={schema} />);
    
    // Should show position indicator
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('should call onNavigate with previous record id', () => {
    const onNavigate = vi.fn();
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showBack: false,
      recordNavigation: {
        recordIds: ['id1', 'id2', 'id3'],
        currentIndex: 1,
        onNavigate,
      },
    };

    const { container } = render(<DetailView schema={schema} />);
    
    // Find the prev button (first in the navigation group)
    const navButtons = container.querySelectorAll('button');
    // The prev button is the one that contains a chevron-left icon and is not disabled
    const prevButton = Array.from(navButtons).find(btn =>
      btn.querySelector('.lucide-chevron-left')
    );
    expect(prevButton).toBeTruthy();
    fireEvent.click(prevButton!);
    expect(onNavigate).toHaveBeenCalledWith('id1');
  });

  it('should call onNavigate with next record id', () => {
    const onNavigate = vi.fn();
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showBack: false,
      recordNavigation: {
        recordIds: ['id1', 'id2', 'id3'],
        currentIndex: 1,
        onNavigate,
      },
    };

    const { container } = render(<DetailView schema={schema} />);
    
    const nextButton = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.querySelector('.lucide-chevron-right')
    );
    expect(nextButton).toBeTruthy();
    fireEvent.click(nextButton!);
    expect(onNavigate).toHaveBeenCalledWith('id3');
  });

  it('should disable prev button at first record', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showBack: false,
      recordNavigation: {
        recordIds: ['id1', 'id2'],
        currentIndex: 0,
        onNavigate: vi.fn(),
      },
    };

    const { container } = render(<DetailView schema={schema} />);
    
    const prevButton = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.querySelector('.lucide-chevron-left')
    );
    expect(prevButton).toBeTruthy();
    expect(prevButton!).toBeDisabled();
  });

  it('should disable next button at last record', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      showBack: false,
      recordNavigation: {
        recordIds: ['id1', 'id2'],
        currentIndex: 1,
        onNavigate: vi.fn(),
      },
    };

    const { container } = render(<DetailView schema={schema} />);
    
    const nextButton = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.querySelector('.lucide-chevron-right')
    );
    expect(nextButton).toBeTruthy();
    expect(nextButton!).toBeDisabled();
  });

  it('should render comments section when comments are provided', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      comments: [
        {
          id: '1',
          text: 'Great contact!',
          author: 'Alice',
          createdAt: '2026-02-16T08:00:00Z',
        },
      ],
    };

    render(<DetailView schema={schema} />);
    
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('Great contact!')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render activity timeline when activities are provided', () => {
    const schema: DetailViewSchema = {
      type: 'detail-view',
      title: 'Contact Details',
      data: { name: 'John Doe' },
      fields: [{ name: 'name', label: 'Name' }],
      activities: [
        {
          id: '1',
          type: 'create',
          user: 'Bob',
          timestamp: '2026-02-15T10:00:00Z',
        },
        {
          id: '2',
          type: 'field_change',
          field: 'email',
          oldValue: 'old@test.com',
          newValue: 'new@test.com',
          user: 'Alice',
          timestamp: '2026-02-16T09:00:00Z',
        },
      ],
    };

    render(<DetailView schema={schema} />);
    
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
