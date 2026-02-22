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
import { CommentInput } from '../CommentInput';

describe('CommentInput', () => {
  it('should render placeholder text', () => {
    const onSubmit = vi.fn();
    render(<CommentInput onSubmit={onSubmit} />);
    expect(screen.getByPlaceholderText('Leave a comment…')).toBeInTheDocument();
  });

  it('should render custom placeholder', () => {
    const onSubmit = vi.fn();
    render(<CommentInput onSubmit={onSubmit} placeholder="Type here…" />);
    expect(screen.getByPlaceholderText('Type here…')).toBeInTheDocument();
  });

  it('should disable submit when textarea is empty', () => {
    const onSubmit = vi.fn();
    render(<CommentInput onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Submit comment')).toBeDisabled();
  });

  it('should enable submit when text is entered', () => {
    const onSubmit = vi.fn();
    render(<CommentInput onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Hello' },
    });
    expect(screen.getByLabelText('Submit comment')).not.toBeDisabled();
  });

  it('should call onSubmit with text when clicked', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CommentInput onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Hello world' },
    });
    fireEvent.click(screen.getByLabelText('Submit comment'));
    expect(onSubmit).toHaveBeenCalledWith('Hello world');
  });

  it('should disable input when disabled prop is true', () => {
    const onSubmit = vi.fn();
    render(<CommentInput onSubmit={onSubmit} disabled />);
    expect(screen.getByPlaceholderText('Leave a comment…')).toBeDisabled();
  });
});
