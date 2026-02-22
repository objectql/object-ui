/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CommentThread } from '../CommentThread';
import type { Comment } from '../CommentThread';

const mockComments: Comment[] = [
  {
    id: '1',
    author: { id: 'u1', name: 'Alice' },
    content: 'Hello everyone',
    mentions: [],
    createdAt: '2025-01-01T10:00:00Z',
  },
];

const currentUser = { id: 'u1', name: 'Alice' };
const mentionableUsers = [
  { id: 'u2', name: 'Bob' },
  { id: 'u3', name: 'Charlie' },
];

describe('CommentThread - onMentionNotify', () => {
  it('calls onMentionNotify when posting a comment with @mentions', () => {
    const onAddComment = vi.fn();
    const onMentionNotify = vi.fn();

    render(
      <CommentThread
        threadId="t1"
        comments={mockComments}
        currentUser={currentUser}
        mentionableUsers={mentionableUsers}
        onAddComment={onAddComment}
        onMentionNotify={onMentionNotify}
      />,
    );

    // Type a comment with an @mention
    const textarea = screen.getByPlaceholderText(/Add a comment/);
    fireEvent.change(textarea, { target: { value: 'Hey @Bob check this' } });

    // Submit via Enter key
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onAddComment).toHaveBeenCalled();
    expect(onMentionNotify).toHaveBeenCalledWith(['u2'], 'Hey @Bob check this');
  });

  it('does not call onMentionNotify when there are no mentions', () => {
    const onAddComment = vi.fn();
    const onMentionNotify = vi.fn();

    render(
      <CommentThread
        threadId="t1"
        comments={mockComments}
        currentUser={currentUser}
        mentionableUsers={mentionableUsers}
        onAddComment={onAddComment}
        onMentionNotify={onMentionNotify}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Add a comment/);
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onAddComment).toHaveBeenCalled();
    expect(onMentionNotify).not.toHaveBeenCalled();
  });

  it('works without onMentionNotify callback', () => {
    const onAddComment = vi.fn();

    render(
      <CommentThread
        threadId="t1"
        comments={mockComments}
        currentUser={currentUser}
        mentionableUsers={mentionableUsers}
        onAddComment={onAddComment}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Add a comment/);
    fireEvent.change(textarea, { target: { value: 'Hey @Bob check this' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onAddComment).toHaveBeenCalled();
    // Should not throw
  });
});
