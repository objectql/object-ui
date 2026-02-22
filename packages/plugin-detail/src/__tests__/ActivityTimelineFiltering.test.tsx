/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActivityTimeline } from '../ActivityTimeline';
import type { ActivityEntry } from '@object-ui/types';

const mockActivities: ActivityEntry[] = [
  {
    id: '1',
    type: 'create',
    user: 'Alice',
    timestamp: '2026-02-15T10:00:00Z',
  },
  {
    id: '2',
    type: 'field_change',
    field: 'status',
    oldValue: 'open',
    newValue: 'in_progress',
    user: 'Bob',
    timestamp: '2026-02-16T08:30:00Z',
  },
  {
    id: '3',
    type: 'comment',
    user: 'Charlie',
    timestamp: '2026-02-16T09:00:00Z',
    description: 'Added a comment on the record',
  },
  {
    id: '4',
    type: 'delete',
    user: 'Diana',
    timestamp: '2026-02-16T09:30:00Z',
  },
  {
    id: '5',
    type: 'comment',
    user: 'Eve',
    timestamp: '2026-02-16T10:00:00Z',
    description: 'Another comment here',
  },
];

describe('ActivityTimeline - Filtering', () => {
  it('does not render filter controls when filterable is false/not provided', () => {
    render(<ActivityTimeline activities={mockActivities} />);
    expect(screen.queryByRole('group', { name: 'Activity type filter' })).not.toBeInTheDocument();
  });

  it('renders filter controls when filterable is true', () => {
    render(<ActivityTimeline activities={mockActivities} filterable />);
    const filterGroup = screen.getByRole('group', { name: 'Activity type filter' });
    expect(filterGroup).toBeInTheDocument();

    // Should have "All", "Field Changes", "Creates", "Deletes", "Comments", "Status Changes"
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('Field Changes')).toBeInTheDocument();
    expect(screen.getByText('Creates')).toBeInTheDocument();
    expect(screen.getByText('Deletes')).toBeInTheDocument();
  });

  it('shows all activities by default', () => {
    render(<ActivityTimeline activities={mockActivities} filterable />);
    // Count should be (5)
    expect(screen.getByText('(5)')).toBeInTheDocument();
  });

  it('filters to only comments when Comments filter is selected', () => {
    render(<ActivityTimeline activities={mockActivities} filterable />);

    const commentsFilter = screen.getByText('Comments');
    fireEvent.click(commentsFilter);

    // Only 2 comment activities
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('Added a comment on the record')).toBeInTheDocument();
    expect(screen.getByText('Another comment here')).toBeInTheDocument();
  });

  it('filters to only field changes when Field Changes filter is selected', () => {
    render(<ActivityTimeline activities={mockActivities} filterable />);

    const fieldChangesFilter = screen.getByText('Field Changes');
    fireEvent.click(fieldChangesFilter);

    // Only 1 field_change activity
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('shows all activities when All filter is re-selected', () => {
    render(<ActivityTimeline activities={mockActivities} filterable />);

    // First filter to comments only
    fireEvent.click(screen.getByText('Comments'));
    expect(screen.getByText('(2)')).toBeInTheDocument();

    // Then go back to All
    fireEvent.click(screen.getByText('All'));
    expect(screen.getByText('(5)')).toBeInTheDocument();
  });

  it('respects defaultFilter prop', () => {
    render(
      <ActivityTimeline
        activities={mockActivities}
        filterable
        defaultFilter="comment"
      />,
    );

    // Should start filtered to comments
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('shows "No activity recorded" when filter has no results', () => {
    render(
      <ActivityTimeline
        activities={mockActivities}
        filterable
        defaultFilter="status_change"
      />,
    );

    expect(screen.getByText('No activity recorded')).toBeInTheDocument();
  });

  it('renders all activities without filter when filterable is not set', () => {
    render(<ActivityTimeline activities={mockActivities} />);
    expect(screen.getByText('(5)')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
