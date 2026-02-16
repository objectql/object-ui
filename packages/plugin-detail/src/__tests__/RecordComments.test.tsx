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
    text: 'This is the first comment',
    author: 'Alice',
    createdAt: '2026-02-16T08:00:00Z',
  },
  {
    id: '2',
    text: 'Second comment here',
    author: 'Bob',
    avatarUrl: 'https://example.com/bob.jpg',
    createdAt: '2026-02-16T09:00:00Z',
  },
];

describe('RecordComments', () => {
  it('should render comments heading with count', () => {
    render(<RecordComments comments={mockComments} />);
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('should render comment authors and text', () => {
    render(<RecordComments comments={mockComments} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('This is the first comment')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Second comment here')).toBeInTheDocument();
  });

  it('should show "No comments yet" when empty', () => {
    render(<RecordComments comments={[]} />);
    expect(screen.getByText('No comments yet')).toBeInTheDocument();
  });

  it('should render comment input when onAddComment is provided', () => {
    const onAdd = vi.fn();
    render(<RecordComments comments={[]} onAddComment={onAdd} />);
    const textarea = screen.getByPlaceholderText(/Add a comment/);
    expect(textarea).toBeInTheDocument();
  });

  it('should not render comment input when onAddComment is not provided', () => {
    render(<RecordComments comments={[]} />);
    const textarea = screen.queryByPlaceholderText(/Add a comment/);
    expect(textarea).not.toBeInTheDocument();
  });

  it('should call onAddComment when submit button is clicked', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<RecordComments comments={[]} onAddComment={onAdd} />);

    const textarea = screen.getByPlaceholderText(/Add a comment/);
    fireEvent.change(textarea, { target: { value: 'New comment' } });

    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);

    expect(onAdd).toHaveBeenCalledWith('New comment');
  });

  it('should disable submit button when textarea is empty', () => {
    const onAdd = vi.fn();
    render(<RecordComments comments={[]} onAddComment={onAdd} />);
    const submitButton = screen.getByRole('button');
    expect(submitButton).toBeDisabled();
  });

  it('should render avatar initials when no avatarUrl', () => {
    render(<RecordComments comments={[mockComments[0]]} />);
    // Alice's initial
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should render avatar image when avatarUrl is provided', () => {
    render(<RecordComments comments={[mockComments[1]]} />);
    const img = screen.getByAltText('Bob');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/bob.jpg');
  });
});
