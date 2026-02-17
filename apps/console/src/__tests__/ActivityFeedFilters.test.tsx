/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Mock UI components – Sheet always renders all children so we can test content
vi.mock('@object-ui/components', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
  Badge: ({ children, onClick, variant, ...props }: any) => (
    <span data-variant={variant} onClick={onClick} role="button" {...props}>{children}</span>
  ),
  Sheet: ({ children }: any) => <div data-testid="sheet">{children}</div>,
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children, className }: any) => <div className={className}>{children}</div>,
  SheetTrigger: ({ children }: any) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Bell: () => <span data-testid="bell-icon">🔔</span>,
  Plus: () => <span>+</span>,
  Pencil: () => <span>✏</span>,
  Trash2: () => <span>🗑</span>,
  MessageSquare: () => <span>💬</span>,
  Filter: () => <span>🔍</span>,
}));

import { ActivityFeed, type ActivityItem } from '../components/ActivityFeed';

const sampleActivities: ActivityItem[] = [
  { id: '1', type: 'create', objectName: 'Lead', user: 'Alice', description: 'Created lead Alpha', timestamp: new Date().toISOString() },
  { id: '2', type: 'update', objectName: 'Contact', user: 'Bob', description: 'Updated contact Beta', timestamp: new Date().toISOString() },
  { id: '3', type: 'delete', objectName: 'Task', user: 'Charlie', description: 'Deleted task Gamma', timestamp: new Date().toISOString() },
  { id: '4', type: 'comment', objectName: 'Lead', user: 'Diana', description: 'Commented on Delta', timestamp: new Date().toISOString() },
];

describe('ActivityFeed filters', () => {
  it('renders all activities by default', () => {
    // Sheet mock renders all children unconditionally so content is visible
    render(<ActivityFeed activities={sampleActivities} />);

    expect(screen.getByText('Created lead Alpha')).toBeInTheDocument();
    expect(screen.getByText('Updated contact Beta')).toBeInTheDocument();
    expect(screen.getByText('Deleted task Gamma')).toBeInTheDocument();
    expect(screen.getByText('Commented on Delta')).toBeInTheDocument();
  });

  it('toggling a filter type hides matching activities', () => {
    render(<ActivityFeed activities={sampleActivities} />);

    // Open the filter panel
    const filterBtn = screen.getByText('Filter');
    fireEvent.click(filterBtn);

    // Toggle off the "create" filter badge
    const createBadge = screen.getByText('create');
    fireEvent.click(createBadge);

    // The "create" activity should be hidden
    expect(screen.queryByText('Created lead Alpha')).not.toBeInTheDocument();

    // Other activities should remain
    expect(screen.getByText('Updated contact Beta')).toBeInTheDocument();
    expect(screen.getByText('Deleted task Gamma')).toBeInTheDocument();
    expect(screen.getByText('Commented on Delta')).toBeInTheDocument();
  });

  it('shows all filter toggle badges', () => {
    render(<ActivityFeed activities={sampleActivities} />);

    // Open the filter panel
    const filterBtn = screen.getByText('Filter');
    fireEvent.click(filterBtn);

    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.getByText('update')).toBeInTheDocument();
    expect(screen.getByText('delete')).toBeInTheDocument();
    expect(screen.getByText('comment')).toBeInTheDocument();
  });
});
