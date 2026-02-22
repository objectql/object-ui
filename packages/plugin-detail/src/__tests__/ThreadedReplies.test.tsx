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
import { ThreadedReplies } from '../ThreadedReplies';
import type { FeedItem } from '@object-ui/types';

const parentItem: FeedItem = {
  id: 'p1',
  type: 'comment',
  actor: 'Alice',
  body: 'Parent comment',
  createdAt: '2026-02-20T10:00:00Z',
  replyCount: 2,
};

const mockReplies: FeedItem[] = [
  {
    id: 'r1',
    type: 'comment',
    actor: 'Bob',
    body: 'First reply',
    createdAt: '2026-02-20T11:00:00Z',
    parentId: 'p1',
  },
  {
    id: 'r2',
    type: 'comment',
    actor: 'Charlie',
    body: 'Second reply',
    createdAt: '2026-02-20T12:00:00Z',
    parentId: 'p1',
  },
];

describe('ThreadedReplies', () => {
  it('should render reply count toggle', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={mockReplies} />,
    );
    expect(screen.getByText('2 replies')).toBeInTheDocument();
  });

  it('should use singular "reply" for one reply', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={[mockReplies[0]]} />,
    );
    expect(screen.getByText('1 reply')).toBeInTheDocument();
  });

  it('should not render replies by default (collapsed)', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={mockReplies} />,
    );
    expect(screen.queryByText('First reply')).not.toBeInTheDocument();
  });

  it('should expand replies when toggle is clicked', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={mockReplies} />,
    );
    fireEvent.click(screen.getByText('2 replies'));
    expect(screen.getByText('First reply')).toBeInTheDocument();
    expect(screen.getByText('Second reply')).toBeInTheDocument();
  });

  it('should show reply authors', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={mockReplies} />,
    );
    fireEvent.click(screen.getByText('2 replies'));
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('should show reply input when onAddReply and showReplyInput', () => {
    const onAdd = vi.fn();
    render(
      <ThreadedReplies parentItem={parentItem} replies={[]} onAddReply={onAdd} showReplyInput />,
    );
    expect(screen.getByPlaceholderText('Reply…')).toBeInTheDocument();
  });

  it('should call onAddReply with parentId and text', () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <ThreadedReplies parentItem={parentItem} replies={[]} onAddReply={onAdd} showReplyInput />,
    );
    const input = screen.getByPlaceholderText('Reply…');
    fireEvent.change(input, { target: { value: 'My reply' } });
    fireEvent.click(screen.getByLabelText('Send reply'));
    expect(onAdd).toHaveBeenCalledWith('p1', 'My reply');
  });

  it('should return null when no replies and no reply input', () => {
    const { container } = render(
      <ThreadedReplies parentItem={parentItem} replies={[]} showReplyInput={false} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
