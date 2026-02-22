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
import { RecordComments } from '../RecordComments';
import type { CommentEntry } from '@object-ui/types';

const mockComments: CommentEntry[] = [
  {
    id: '1',
    text: 'First comment about the project',
    author: 'Alice',
    createdAt: '2026-02-16T08:00:00Z',
  },
  {
    id: '2',
    text: 'Second comment on this record',
    author: 'Bob',
    avatarUrl: 'https://example.com/bob.jpg',
    createdAt: '2026-02-16T09:00:00Z',
    pinned: true,
  },
  {
    id: '3',
    text: 'Third comment here',
    author: 'Charlie',
    createdAt: '2026-02-16T10:00:00Z',
  },
];

describe('RecordComments - Pinning', () => {
  it('shows "Pinned" label on pinned comments', () => {
    render(<RecordComments comments={mockComments} />);
    expect(screen.getByText('Pinned')).toBeInTheDocument();
  });

  it('sorts pinned comments to the top', () => {
    const { container } = render(<RecordComments comments={mockComments} />);
    // Bob (pinned) should appear first
    const authors = container.querySelectorAll('.text-sm.font-medium');
    const authorTexts = Array.from(authors).map(el => el.textContent);
    expect(authorTexts[0]).toBe('Bob');
  });

  it('renders pin/unpin button when onTogglePin is provided', () => {
    const onTogglePin = vi.fn();
    render(<RecordComments comments={mockComments} onTogglePin={onTogglePin} />);

    // Should show "Unpin" for Bob (pinned) and "Pin" for others
    expect(screen.getByText('Unpin')).toBeInTheDocument();
    expect(screen.getAllByText('Pin')).toHaveLength(2);
  });

  it('does not render pin button when onTogglePin is not provided', () => {
    render(<RecordComments comments={mockComments} />);
    expect(screen.queryByText('Unpin')).not.toBeInTheDocument();
    expect(screen.queryAllByText('Pin')).toHaveLength(0);
  });

  it('calls onTogglePin when pin button is clicked', () => {
    const onTogglePin = vi.fn();
    render(<RecordComments comments={mockComments} onTogglePin={onTogglePin} />);

    const unpinBtn = screen.getByText('Unpin');
    fireEvent.click(unpinBtn);

    expect(onTogglePin).toHaveBeenCalledWith('2');
  });
});

describe('RecordComments - Search', () => {
  it('does not render search input when searchable is false/not provided', () => {
    render(<RecordComments comments={mockComments} />);
    expect(screen.queryByLabelText('Search comments')).not.toBeInTheDocument();
  });

  it('renders search input when searchable is true', () => {
    render(<RecordComments comments={mockComments} searchable />);
    expect(screen.getByLabelText('Search comments')).toBeInTheDocument();
  });

  it('filters comments by text when searching', () => {
    render(<RecordComments comments={mockComments} searchable />);

    const searchInput = screen.getByLabelText('Search comments');
    fireEvent.change(searchInput, { target: { value: 'project' } });

    expect(screen.getByText('First comment about the project')).toBeInTheDocument();
    expect(screen.queryByText('Second comment on this record')).not.toBeInTheDocument();
    expect(screen.queryByText('Third comment here')).not.toBeInTheDocument();
  });

  it('filters comments by author when searching', () => {
    render(<RecordComments comments={mockComments} searchable />);

    const searchInput = screen.getByLabelText('Search comments');
    fireEvent.change(searchInput, { target: { value: 'Charlie' } });

    expect(screen.getByText('Third comment here')).toBeInTheDocument();
    expect(screen.queryByText('First comment about the project')).not.toBeInTheDocument();
  });

  it('shows "No matching comments" when search has no results', () => {
    render(<RecordComments comments={mockComments} searchable />);

    const searchInput = screen.getByLabelText('Search comments');
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });

    expect(screen.getByText('No matching comments')).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', () => {
    render(<RecordComments comments={mockComments} searchable />);

    const searchInput = screen.getByLabelText('Search comments');
    fireEvent.change(searchInput, { target: { value: 'project' } });

    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);

    // All comments should be visible again
    expect(screen.getByText('First comment about the project')).toBeInTheDocument();
    expect(screen.getByText('Second comment on this record')).toBeInTheDocument();
    expect(screen.getByText('Third comment here')).toBeInTheDocument();
  });
});
