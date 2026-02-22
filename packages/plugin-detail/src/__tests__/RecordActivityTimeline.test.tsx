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
import { RecordActivityTimeline } from '../RecordActivityTimeline';
import type { FeedItem } from '@object-ui/types';

const mockItems: FeedItem[] = [
  {
    id: '1',
    type: 'comment',
    actor: 'Alice',
    body: 'This looks great!',
    createdAt: '2026-02-20T10:00:00Z',
  },
  {
    id: '2',
    type: 'field_change',
    actor: 'Bob',
    createdAt: '2026-02-20T11:00:00Z',
    fieldChanges: [
      {
        field: 'status',
        fieldLabel: 'Status',
        oldDisplayValue: 'Open',
        newDisplayValue: 'In Progress',
      },
    ],
  },
  {
    id: '3',
    type: 'task',
    actor: 'Charlie',
    body: 'Follow up with client',
    createdAt: '2026-02-20T12:00:00Z',
  },
  {
    id: '4',
    type: 'system',
    actor: 'System',
    body: 'Record created automatically',
    createdAt: '2026-02-20T08:00:00Z',
  },
];

describe('RecordActivityTimeline', () => {
  it('should render activity heading with count', () => {
    render(<RecordActivityTimeline items={mockItems} />);
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
  });

  it('should render actor names', () => {
    render(<RecordActivityTimeline items={mockItems} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should render comment body text', () => {
    render(<RecordActivityTimeline items={mockItems} />);
    expect(screen.getByText('This looks great!')).toBeInTheDocument();
  });

  it('should render field change entries', () => {
    render(<RecordActivityTimeline items={mockItems} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('should show "No activity recorded" when empty', () => {
    render(<RecordActivityTimeline items={[]} />);
    expect(screen.getByText('No activity recorded')).toBeInTheDocument();
  });

  it('should filter to comments only', () => {
    render(
      <RecordActivityTimeline items={mockItems} filterMode="comments_only" />,
    );
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('should filter to changes only', () => {
    render(
      <RecordActivityTimeline items={mockItems} filterMode="changes_only" />,
    );
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('should filter to tasks only', () => {
    render(
      <RecordActivityTimeline items={mockItems} filterMode="tasks_only" />,
    );
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('should show filter dropdown by default', () => {
    render(<RecordActivityTimeline items={mockItems} />);
    expect(screen.getByLabelText('Filter activity')).toBeInTheDocument();
  });

  it('should hide filter when showFilterToggle is false', () => {
    render(
      <RecordActivityTimeline
        items={mockItems}
        config={{ showFilterToggle: false }}
      />,
    );
    expect(screen.queryByLabelText('Filter activity')).not.toBeInTheDocument();
  });

  it('should show comment input when onAddComment provided', () => {
    const onAdd = vi.fn();
    render(
      <RecordActivityTimeline items={[]} onAddComment={onAdd} />,
    );
    expect(screen.getByPlaceholderText(/Leave a comment/)).toBeInTheDocument();
  });

  it('should hide comment input when showCommentInput is false', () => {
    const onAdd = vi.fn();
    render(
      <RecordActivityTimeline
        items={[]}
        onAddComment={onAdd}
        config={{ showCommentInput: false }}
      />,
    );
    expect(screen.queryByPlaceholderText(/Leave a comment/)).not.toBeInTheDocument();
  });

  it('should call onAddComment when comment is submitted', () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordActivityTimeline items={[]} onAddComment={onAdd} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Leave a comment/), {
      target: { value: 'New comment' },
    });
    fireEvent.click(screen.getByLabelText('Submit comment'));
    expect(onAdd).toHaveBeenCalledWith('New comment');
  });

  it('should show Load more button when hasMore is true', () => {
    render(
      <RecordActivityTimeline items={mockItems} hasMore onLoadMore={() => {}} />,
    );
    expect(screen.getByLabelText('Load more activity')).toBeInTheDocument();
  });

  it('should call onLoadMore when Load more is clicked', () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordActivityTimeline items={mockItems} hasMore onLoadMore={onLoadMore} />,
    );
    fireEvent.click(screen.getByLabelText('Load more activity'));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('should render source label when present', () => {
    const items: FeedItem[] = [
      { id: '1', type: 'comment', actor: 'Alice', body: 'Hi', createdAt: '2026-02-20T10:00:00Z', source: 'email' },
    ];
    render(<RecordActivityTimeline items={items} />);
    expect(screen.getByText('via email')).toBeInTheDocument();
  });

  it('should render edited indicator', () => {
    const items: FeedItem[] = [
      { id: '1', type: 'comment', actor: 'Alice', body: 'Edited', createdAt: '2026-02-20T10:00:00Z', edited: true },
    ];
    render(<RecordActivityTimeline items={items} />);
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  it('should render pinned indicator', () => {
    const items: FeedItem[] = [
      { id: '1', type: 'comment', actor: 'Alice', body: 'Pinned comment', createdAt: '2026-02-20T10:00:00Z', pinned: true },
    ];
    render(<RecordActivityTimeline items={items} />);
    expect(screen.getByText('📌 Pinned')).toBeInTheDocument();
  });

  it('should show subscription toggle when configured', () => {
    render(
      <RecordActivityTimeline
        items={[]}
        config={{ showSubscriptionToggle: true }}
        subscription={{ recordId: '1', subscribed: true }}
        onToggleSubscription={() => {}}
      />,
    );
    expect(screen.getByLabelText('Unsubscribe from notifications')).toBeInTheDocument();
  });
});
