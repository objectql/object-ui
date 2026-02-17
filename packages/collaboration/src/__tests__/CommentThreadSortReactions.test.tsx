/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CommentThread } from '../CommentThread';
import type { Comment } from '../CommentThread';

const mockComments: Comment[] = [
  {
    id: '1',
    author: { id: 'u1', name: 'Alice' },
    content: 'First',
    mentions: [],
    createdAt: '2025-01-01T10:00:00Z',
  },
  {
    id: '2',
    author: { id: 'u2', name: 'Bob' },
    content: 'Second',
    mentions: [],
    createdAt: '2025-01-02T10:00:00Z',
  },
  {
    id: '3',
    author: { id: 'u1', name: 'Alice' },
    content: 'Third',
    mentions: [],
    createdAt: '2025-01-03T10:00:00Z',
    reactions: { '👍': ['u2'] },
  },
];

const currentUser = { id: 'u1', name: 'Alice' };

describe('CommentThread - Sorting & Reactions', () => {
  describe('Sort dropdown', () => {
    it('renders a sort dropdown with "Oldest" and "Newest" options', () => {
      render(
        <CommentThread
          threadId="t1"
          comments={mockComments}
          currentUser={currentUser}
        />
      );

      const sortSelect = screen.getByRole('combobox', { name: 'Sort comments' });
      expect(sortSelect).toBeInTheDocument();

      const options = sortSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map(o => o.textContent);
      expect(optionTexts).toContain('Oldest');
      expect(optionTexts).toContain('Newest');
    });

    it('defaults to "Oldest" sort order showing comments in chronological order', () => {
      const { container } = render(
        <CommentThread
          threadId="t1"
          comments={mockComments}
          currentUser={currentUser}
        />
      );

      const commentElements = container.querySelectorAll('[data-comment-id]');
      const ids = Array.from(commentElements).map(el => el.getAttribute('data-comment-id'));
      expect(ids).toEqual(['1', '2', '3']);
    });

    it('changes to "Newest" sort order and reverses comment display', () => {
      const { container } = render(
        <CommentThread
          threadId="t1"
          comments={mockComments}
          currentUser={currentUser}
        />
      );

      // Change sort to newest
      const sortSelect = screen.getByRole('combobox', { name: 'Sort comments' });
      fireEvent.change(sortSelect, { target: { value: 'newest' } });

      // After re-sort, comments should be in reverse chronological order
      const commentElements = container.querySelectorAll('[data-comment-id]');
      const ids = Array.from(commentElements).map(el => el.getAttribute('data-comment-id'));
      expect(ids).toEqual(['3', '2', '1']);
    });
  });

  describe('Reaction buttons', () => {
    it('renders 👍 and ❤️ reaction buttons in comment actions when onReaction is provided', () => {
      render(
        <CommentThread
          threadId="t1"
          comments={mockComments}
          currentUser={currentUser}
          onReaction={vi.fn()}
        />
      );

      // Each comment should have reaction action buttons
      const thumbsUpButtons = screen.getAllByRole('button', { name: /👍/ });
      expect(thumbsUpButtons.length).toBeGreaterThan(0);

      const heartButtons = screen.getAllByRole('button', { name: /❤️/ });
      expect(heartButtons.length).toBeGreaterThan(0);
    });

    it('calls onReaction when clicking a 👍 action button', () => {
      const onReaction = vi.fn();
      render(
        <CommentThread
          threadId="t1"
          comments={mockComments}
          currentUser={currentUser}
          onReaction={onReaction}
        />
      );

      // Find the 👍 action buttons (in the actions div, not the reaction bar)
      const allThumbsButtons = screen.getAllByText('👍');
      // Click the first one
      fireEvent.click(allThumbsButtons[0]);

      expect(onReaction).toHaveBeenCalled();
      // Should be called with a comment id and the emoji
      const [commentId, emoji] = onReaction.mock.calls[0];
      expect(emoji).toBe('👍');
    });

    it('calls onReaction when clicking a ❤️ action button', () => {
      const onReaction = vi.fn();
      render(
        <CommentThread
          threadId="t1"
          comments={mockComments}
          currentUser={currentUser}
          onReaction={onReaction}
        />
      );

      const heartButtons = screen.getAllByText('❤️');
      fireEvent.click(heartButtons[0]);

      expect(onReaction).toHaveBeenCalled();
      const [, emoji] = onReaction.mock.calls[0];
      expect(emoji).toBe('❤️');
    });
  });

  describe('Existing reactions display', () => {
    it('displays existing reactions with count', () => {
      render(
        <CommentThread
          threadId="t1"
          comments={mockComments}
          currentUser={currentUser}
          onReaction={vi.fn()}
        />
      );

      // Comment 3 has a 👍 reaction from u2 with count 1
      // The reaction bar shows "👍 1"
      expect(screen.getByText('👍 1')).toBeInTheDocument();
    });

    it('calls onReaction when clicking an existing reaction badge', () => {
      const onReaction = vi.fn();
      render(
        <CommentThread
          threadId="t1"
          comments={mockComments}
          currentUser={currentUser}
          onReaction={onReaction}
        />
      );

      // Click the existing "👍 1" reaction badge on comment 3
      const reactionBadge = screen.getByText('👍 1');
      fireEvent.click(reactionBadge);

      expect(onReaction).toHaveBeenCalledWith('3', '👍');
    });

    it('does not render reaction action buttons when onReaction is not provided', () => {
      render(
        <CommentThread
          threadId="t1"
          comments={[mockComments[0]]}
          currentUser={currentUser}
        />
      );

      // Without onReaction, the action buttons for 👍 and ❤️ should not appear
      // Only "Reply" should be present (and possibly Edit/Delete for own comments)
      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map(b => b.textContent);
      expect(buttonTexts).not.toContain('👍');
      expect(buttonTexts).not.toContain('❤️');
    });
  });
});
