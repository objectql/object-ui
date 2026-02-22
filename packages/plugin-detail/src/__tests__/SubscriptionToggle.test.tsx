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
import { SubscriptionToggle } from '../SubscriptionToggle';
import type { RecordSubscription } from '@object-ui/types';

describe('SubscriptionToggle', () => {
  it('should render subscribed state', () => {
    const sub: RecordSubscription = { recordId: '1', subscribed: true };
    render(<SubscriptionToggle subscription={sub} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Unsubscribe from notifications');
  });

  it('should render unsubscribed state', () => {
    const sub: RecordSubscription = { recordId: '1', subscribed: false };
    render(<SubscriptionToggle subscription={sub} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Subscribe to notifications');
  });

  it('should call onToggle with new state when clicked', () => {
    const onToggle = vi.fn();
    const sub: RecordSubscription = { recordId: '1', subscribed: false };
    render(<SubscriptionToggle subscription={sub} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('should call onToggle with false when unsubscribing', () => {
    const onToggle = vi.fn();
    const sub: RecordSubscription = { recordId: '1', subscribed: true };
    render(<SubscriptionToggle subscription={sub} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('should be disabled when no onToggle provided', () => {
    const sub: RecordSubscription = { recordId: '1', subscribed: true };
    render(<SubscriptionToggle subscription={sub} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
