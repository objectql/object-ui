/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    type: 'status_change',
    field: 'stage',
    newValue: 'Completed',
    user: 'Charlie',
    timestamp: '2026-02-16T09:00:00Z',
    description: 'Moved to Completed stage',
  },
  {
    id: '4',
    type: 'comment',
    user: 'Alice',
    timestamp: '2026-02-16T09:30:00Z',
    description: 'Added a comment',
  },
];

describe('ActivityTimeline', () => {
  it('should render activity heading with count', () => {
    render(<ActivityTimeline activities={mockActivities} />);
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
  });

  it('should render user names', () => {
    render(<ActivityTimeline activities={mockActivities} />);
    expect(screen.getAllByText('Alice')).toHaveLength(2);
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('should show "No activity recorded" when empty', () => {
    render(<ActivityTimeline activities={[]} />);
    expect(screen.getByText('No activity recorded')).toBeInTheDocument();
  });

  it('should render field change description for field_change type', () => {
    render(
      <ActivityTimeline
        activities={[
          {
            id: '1',
            type: 'field_change',
            field: 'priority',
            oldValue: 'low',
            newValue: 'high',
            user: 'Eve',
            timestamp: '2026-02-16T10:00:00Z',
          },
        ]}
      />,
    );
    expect(screen.getByText(/Changed Priority from "low" to "high"/)).toBeInTheDocument();
  });

  it('should use description if provided', () => {
    render(
      <ActivityTimeline
        activities={[
          {
            id: '1',
            type: 'comment',
            user: 'Alice',
            timestamp: '2026-02-16T09:30:00Z',
            description: 'Added a comment',
          },
        ]}
      />,
    );
    expect(screen.getByText('Added a comment')).toBeInTheDocument();
  });

  it('should render create type with default description', () => {
    render(
      <ActivityTimeline
        activities={[
          {
            id: '1',
            type: 'create',
            user: 'Eve',
            timestamp: '2026-02-16T10:00:00Z',
          },
        ]}
      />,
    );
    expect(screen.getByText('Created this record')).toBeInTheDocument();
  });
});
