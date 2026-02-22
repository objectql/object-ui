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

  it('should show title for subscribed state', () => {
    const sub: RecordSubscription = { recordId: '1', subscribed: true };
    render(<SubscriptionToggle subscription={sub} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Subscribed — click to unsubscribe');
  });

  it('should show title for unsubscribed state', () => {
    const sub: RecordSubscription = { recordId: '1', subscribed: false };
    render(<SubscriptionToggle subscription={sub} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Subscribe to notifications');
  });

  it('should be disabled during loading after click', async () => {
    let resolveToggle: () => void;
    const onToggle = vi.fn(() => new Promise<void>((r) => { resolveToggle = r; }));
    const sub: RecordSubscription = { recordId: '1', subscribed: false };
    render(<SubscriptionToggle subscription={sub} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeDisabled();
    resolveToggle!();
    await vi.waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  it('should update aria-label based on subscribed state', () => {
    const sub: RecordSubscription = { recordId: '1', subscribed: true };
    const { rerender } = render(<SubscriptionToggle subscription={sub} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Unsubscribe from notifications');
    rerender(<SubscriptionToggle subscription={{ ...sub, subscribed: false }} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Subscribe to notifications');
  });
});
