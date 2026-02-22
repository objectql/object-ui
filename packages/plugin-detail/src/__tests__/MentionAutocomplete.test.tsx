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
import { MentionAutocomplete, createMentionFromSuggestion } from '../MentionAutocomplete';
import type { MentionSuggestionItem } from '../MentionAutocomplete';

const mockSuggestions: MentionSuggestionItem[] = [
  { id: 'u1', name: 'Alice Smith', type: 'user' },
  { id: 'u2', name: 'Bob Johnson', type: 'user', avatarUrl: 'https://example.com/bob.jpg' },
  { id: 't1', name: 'Engineering', type: 'team' },
];

describe('MentionAutocomplete', () => {
  it('should render suggestions when visible', () => {
    const onSelect = vi.fn();
    render(
      <MentionAutocomplete query="" suggestions={mockSuggestions} onSelect={onSelect} visible />,
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <MentionAutocomplete query="" suggestions={mockSuggestions} onSelect={onSelect} visible={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('should filter suggestions by query', () => {
    const onSelect = vi.fn();
    render(
      <MentionAutocomplete query="Ali" suggestions={mockSuggestions} onSelect={onSelect} visible />,
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
  });

  it('should show type label for non-user types', () => {
    const onSelect = vi.fn();
    render(
      <MentionAutocomplete query="Eng" suggestions={mockSuggestions} onSelect={onSelect} visible />,
    );
    expect(screen.getByText('(team)')).toBeInTheDocument();
  });

  it('should call onSelect when a suggestion is clicked', () => {
    const onSelect = vi.fn();
    render(
      <MentionAutocomplete query="" suggestions={mockSuggestions} onSelect={onSelect} visible />,
    );
    fireEvent.mouseDown(screen.getByText('Alice Smith'));
    expect(onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
  });

  it('should render avatar image when avatarUrl is present', () => {
    const onSelect = vi.fn();
    render(
      <MentionAutocomplete query="" suggestions={mockSuggestions} onSelect={onSelect} visible />,
    );
    const img = screen.getByAltText('Bob Johnson');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/bob.jpg');
  });

  it('should not render when no matching suggestions', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <MentionAutocomplete query="xyz" suggestions={mockSuggestions} onSelect={onSelect} visible />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('createMentionFromSuggestion', () => {
  it('should create a Mention object from a suggestion item', () => {
    const item: MentionSuggestionItem = { id: 'u1', name: 'Alice', type: 'user' };
    const mention = createMentionFromSuggestion(item, 5, 6);
    expect(mention).toEqual({
      type: 'user',
      id: 'u1',
      name: 'Alice',
      offset: 5,
      length: 6,
    });
  });
});
