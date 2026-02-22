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

  it('should have aria-expanded=false when collapsed', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={mockReplies} />,
    );
    const toggle = screen.getByText('2 replies').closest('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('should have aria-expanded=true when expanded', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={mockReplies} />,
    );
    fireEvent.click(screen.getByText('2 replies'));
    const toggle = screen.getByText('2 replies').closest('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('should render avatarUrl when provided on reply', () => {
    const repliesWithAvatar: FeedItem[] = [
      {
        id: 'r1',
        type: 'comment',
        actor: 'Bob',
        actorAvatarUrl: 'https://example.com/bob.png',
        body: 'With avatar',
        createdAt: '2026-02-20T11:00:00Z',
        parentId: 'p1',
      },
    ];
    render(
      <ThreadedReplies parentItem={parentItem} replies={repliesWithAvatar} />,
    );
    fireEvent.click(screen.getByText('1 reply'));
    const img = screen.getByAltText('Bob');
    expect(img).toHaveAttribute('src', 'https://example.com/bob.png');
  });

  it('should render first-letter avatar fallback', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={mockReplies} />,
    );
    fireEvent.click(screen.getByText('2 replies'));
    // Bob should show 'B' as fallback initial
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('should submit reply via Ctrl+Enter', () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <ThreadedReplies parentItem={parentItem} replies={[]} onAddReply={onAdd} showReplyInput />,
    );
    const input = screen.getByPlaceholderText('Reply…');
    fireEvent.change(input, { target: { value: 'Ctrl reply' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(onAdd).toHaveBeenCalledWith('p1', 'Ctrl reply');
  });

  it('should disable Send button when input is empty', () => {
    const onAdd = vi.fn();
    render(
      <ThreadedReplies parentItem={parentItem} replies={[]} onAddReply={onAdd} showReplyInput />,
    );
    expect(screen.getByLabelText('Send reply')).toBeDisabled();
  });

  it('should disable input and button during reply submission', async () => {
    let resolveReply: () => void;
    const onAdd = vi.fn(() => new Promise<void>((r) => { resolveReply = r; }));
    render(
      <ThreadedReplies parentItem={parentItem} replies={[]} onAddReply={onAdd} showReplyInput />,
    );
    const input = screen.getByPlaceholderText('Reply…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'submitting reply' } });
    fireEvent.click(screen.getByLabelText('Send reply'));
    expect(input).toBeDisabled();
    expect(screen.getByLabelText('Send reply')).toBeDisabled();
    resolveReply!();
    await vi.waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });

  it('should clear input after successful reply submission', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <ThreadedReplies parentItem={parentItem} replies={[]} onAddReply={onAdd} showReplyInput />,
    );
    const input = screen.getByPlaceholderText('Reply…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'reply text' } });
    fireEvent.click(screen.getByLabelText('Send reply'));
    await vi.waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should render reply body and timestamp when expanded', () => {
    render(
      <ThreadedReplies parentItem={parentItem} replies={mockReplies} />,
    );
    fireEvent.click(screen.getByText('2 replies'));
    expect(screen.getByText('First reply')).toBeInTheDocument();
    expect(screen.getByText('Second reply')).toBeInTheDocument();
  });
});
