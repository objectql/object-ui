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
import { ReactionPicker } from '../ReactionPicker';
import type { Reaction } from '@object-ui/types';

const mockReactions: Reaction[] = [
  { emoji: '👍', count: 3, reacted: true },
  { emoji: '❤️', count: 1, reacted: false },
];

describe('ReactionPicker', () => {
  it('should render existing reactions with counts', () => {
    render(<ReactionPicker reactions={mockReactions} />);
    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should highlight reacted emoji', () => {
    render(<ReactionPicker reactions={mockReactions} />);
    const thumbs = screen.getByLabelText(/👍 3/);
    expect(thumbs).toHaveClass('bg-primary/10');
  });

  it('should show add reaction button when onToggleReaction provided', () => {
    const onToggle = vi.fn();
    render(<ReactionPicker reactions={[]} onToggleReaction={onToggle} />);
    expect(screen.getByLabelText('Add reaction')).toBeInTheDocument();
  });

  it('should not show add button when no onToggleReaction', () => {
    render(<ReactionPicker reactions={[]} />);
    expect(screen.queryByLabelText('Add reaction')).not.toBeInTheDocument();
  });

  it('should call onToggleReaction when clicking existing reaction', () => {
    const onToggle = vi.fn();
    render(<ReactionPicker reactions={mockReactions} onToggleReaction={onToggle} />);
    fireEvent.click(screen.getByLabelText(/👍 3/));
    expect(onToggle).toHaveBeenCalledWith('👍');
  });

  it('should show emoji picker when add button is clicked', () => {
    const onToggle = vi.fn();
    render(<ReactionPicker reactions={[]} onToggleReaction={onToggle} />);
    fireEvent.click(screen.getByLabelText('Add reaction'));
    expect(screen.getByRole('listbox', { name: 'Emoji picker' })).toBeInTheDocument();
  });

  it('should call onToggleReaction when emoji is selected from picker', () => {
    const onToggle = vi.fn();
    render(<ReactionPicker reactions={[]} onToggleReaction={onToggle} />);
    fireEvent.click(screen.getByLabelText('Add reaction'));
    // Select first emoji option (👍)
    const options = screen.getAllByRole('option');
    fireEvent.click(options[0]);
    expect(onToggle).toHaveBeenCalledWith('👍');
  });

  it('should disable reaction buttons when no onToggleReaction', () => {
    render(<ReactionPicker reactions={mockReactions} />);
    const thumbsBtn = screen.getByLabelText(/👍 3/);
    expect(thumbsBtn).toBeDisabled();
    const heartBtn = screen.getByLabelText(/❤️ 1/);
    expect(heartBtn).toBeDisabled();
  });

  it('should render custom emojiOptions', () => {
    const onToggle = vi.fn();
    const customEmoji = ['🚀', '🔥', '✅'];
    render(
      <ReactionPicker reactions={[]} onToggleReaction={onToggle} emojiOptions={customEmoji} />,
    );
    fireEvent.click(screen.getByLabelText('Add reaction'));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('🚀');
    expect(options[1]).toHaveTextContent('🔥');
    expect(options[2]).toHaveTextContent('✅');
  });

  it('should include emoji and count in aria-label', () => {
    render(<ReactionPicker reactions={mockReactions} />);
    expect(screen.getByLabelText('👍 3 reactions')).toBeInTheDocument();
    expect(screen.getByLabelText('❤️ 1 reaction')).toBeInTheDocument();
  });

  it('should show non-reacted emoji with bg-muted style', () => {
    render(<ReactionPicker reactions={mockReactions} />);
    const heart = screen.getByLabelText(/❤️ 1/);
    expect(heart).toHaveClass('bg-muted');
  });

  it('should close picker after selecting emoji', () => {
    const onToggle = vi.fn();
    render(<ReactionPicker reactions={[]} onToggleReaction={onToggle} />);
    fireEvent.click(screen.getByLabelText('Add reaction'));
    expect(screen.getByRole('listbox', { name: 'Emoji picker' })).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    fireEvent.click(options[0]);
    expect(screen.queryByRole('listbox', { name: 'Emoji picker' })).not.toBeInTheDocument();
  });
});
