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

const allTypeItems: FeedItem[] = [
  { id: 'c1', type: 'comment', actor: 'A', body: 'comment', createdAt: '2026-02-20T10:00:00Z' },
  { id: 'fc1', type: 'field_change', actor: 'B', createdAt: '2026-02-20T10:01:00Z', fieldChanges: [{ field: 'x', oldValue: '1', newValue: '2' }] },
  { id: 't1', type: 'task', actor: 'C', body: 'task', createdAt: '2026-02-20T10:02:00Z' },
  { id: 'e1', type: 'event', actor: 'D', body: 'event', createdAt: '2026-02-20T10:03:00Z' },
  { id: 's1', type: 'system', actor: 'E', body: 'system', createdAt: '2026-02-20T10:04:00Z' },
  { id: 'm1', type: 'email', actor: 'F', body: 'email', createdAt: '2026-02-20T10:05:00Z' },
  { id: 'p1', type: 'call', actor: 'G', body: 'call', createdAt: '2026-02-20T10:06:00Z' },
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

  it('should render all 7 item types', () => {
    render(<RecordActivityTimeline items={allTypeItems} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('should render actor avatar when actorAvatarUrl is provided', () => {
    const items: FeedItem[] = [
      { id: '1', type: 'comment', actor: 'Alice', actorAvatarUrl: 'https://example.com/alice.png', body: 'Hi', createdAt: '2026-02-20T10:00:00Z' },
    ];
    render(<RecordActivityTimeline items={items} />);
    const img = screen.getByAltText('Alice');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/alice.png');
  });

  it('should submit comment via Ctrl+Enter', () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordActivityTimeline items={[]} onAddComment={onAdd} />,
    );
    const textarea = screen.getByPlaceholderText(/Leave a comment/);
    fireEvent.change(textarea, { target: { value: 'Ctrl enter test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onAdd).toHaveBeenCalledWith('Ctrl enter test');
  });

  it('should clear input after successful comment submission', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordActivityTimeline items={[]} onAddComment={onAdd} />,
    );
    const textarea = screen.getByPlaceholderText(/Leave a comment/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Will be cleared' } });
    fireEvent.click(screen.getByLabelText('Submit comment'));
    await vi.waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('should disable input and button during submission', async () => {
    let resolveSubmit: () => void;
    const onAdd = vi.fn(() => new Promise<void>((r) => { resolveSubmit = r; }));
    render(
      <RecordActivityTimeline items={[]} onAddComment={onAdd} />,
    );
    const textarea = screen.getByPlaceholderText(/Leave a comment/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'submitting' } });
    fireEvent.click(screen.getByLabelText('Submit comment'));
    expect(textarea).toBeDisabled();
    expect(screen.getByLabelText('Submit comment')).toBeDisabled();
    resolveSubmit!();
    await vi.waitFor(() => {
      expect(textarea).not.toBeDisabled();
    });
  });

  it('should show loading spinner when loading more', async () => {
    let resolveLoad: () => void;
    const onLoadMore = vi.fn(() => new Promise<void>((r) => { resolveLoad = r; }));
    render(
      <RecordActivityTimeline items={mockItems} hasMore onLoadMore={onLoadMore} />,
    );
    fireEvent.click(screen.getByLabelText('Load more activity'));
    // Loader2 spinner should be present while loading
    expect(screen.getByLabelText('Load more activity')).toBeDisabled();
    resolveLoad!();
    await vi.waitFor(() => {
      expect(screen.getByLabelText('Load more activity')).not.toBeDisabled();
    });
  });

  it('should use controlled filterMode and call onFilterChange', () => {
    const onFilterChange = vi.fn();
    render(
      <RecordActivityTimeline
        items={mockItems}
        filterMode="comments_only"
        onFilterChange={onFilterChange}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    // Change filter via select
    fireEvent.change(screen.getByLabelText('Filter activity'), { target: { value: 'all' } });
    expect(onFilterChange).toHaveBeenCalledWith('all');
  });

  it('should use internal filter state when no controlled filterMode', () => {
    render(
      <RecordActivityTimeline items={mockItems} />,
    );
    // Initially all visible
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Switch to comments_only
    fireEvent.change(screen.getByLabelText('Filter activity'), { target: { value: 'comments_only' } });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('should not render comment input when onAddComment is not provided', () => {
    render(<RecordActivityTimeline items={[]} />);
    expect(screen.queryByPlaceholderText(/Leave a comment/)).not.toBeInTheDocument();
  });

  it('should render reactions when enableReactions is true', () => {
    const items: FeedItem[] = [
      {
        id: '1',
        type: 'comment',
        actor: 'Alice',
        body: 'Nice!',
        createdAt: '2026-02-20T10:00:00Z',
        reactions: [{ emoji: '👍', count: 2, reacted: true }],
      },
    ];
    render(
      <RecordActivityTimeline items={items} config={{ enableReactions: true }} />,
    );
    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should not render reactions when enableReactions is false', () => {
    const items: FeedItem[] = [
      {
        id: '1',
        type: 'comment',
        actor: 'Alice',
        body: 'Nice!',
        createdAt: '2026-02-20T10:00:00Z',
        reactions: [{ emoji: '👍', count: 2, reacted: true }],
      },
    ];
    render(
      <RecordActivityTimeline items={items} config={{ enableReactions: false }} />,
    );
    expect(screen.queryByText('👍')).not.toBeInTheDocument();
  });

  it('should group items by parentId when enableThreading is true', () => {
    const items: FeedItem[] = [
      { id: 'p1', type: 'comment', actor: 'Alice', body: 'Root comment', createdAt: '2026-02-20T10:00:00Z', replyCount: 1 },
      { id: 'r1', type: 'comment', actor: 'Bob', body: 'Reply', createdAt: '2026-02-20T11:00:00Z', parentId: 'p1' },
    ];
    render(
      <RecordActivityTimeline items={items} config={{ enableThreading: true }} />,
    );
    // Root comment rendered
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Root comment')).toBeInTheDocument();
    // Reply is shown as threaded reply (collapsed)
    expect(screen.getByText('1 reply')).toBeInTheDocument();
    // Reply actor should not be directly visible (collapsed in ThreadedReplies)
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('should show "via {source}" label', () => {
    const items: FeedItem[] = [
      { id: '1', type: 'comment', actor: 'Alice', body: 'Hi', createdAt: '2026-02-20T10:00:00Z', source: 'slack' },
    ];
    render(<RecordActivityTimeline items={items} />);
    expect(screen.getByText('via slack')).toBeInTheDocument();
  });
});
