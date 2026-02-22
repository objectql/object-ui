/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMentionNotifications } from '../useMentionNotifications';
import type { MentionNotification } from '@object-ui/types';

const makeNotification = (overrides: Partial<MentionNotification> = {}): MentionNotification => ({
  id: 'n1',
  type: 'mention',
  recipientId: 'user1',
  commentId: 'c1',
  mentionedBy: 'Alice',
  commentText: 'Hey @user1 check this out',
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('useMentionNotifications', () => {
  it('initializes with empty notifications', () => {
    const { result } = renderHook(() =>
      useMentionNotifications({ currentUserId: 'user1' }),
    );
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('initializes with provided notifications filtered to current user', () => {
    const myNotif = makeNotification({ id: 'n1', recipientId: 'user1' });
    const otherNotif = makeNotification({ id: 'n2', recipientId: 'user2' });

    const { result } = renderHook(() =>
      useMentionNotifications({
        currentUserId: 'user1',
        initialNotifications: [myNotif, otherNotif],
      }),
    );
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe('n1');
  });

  it('adds a notification and calls onDeliver', () => {
    const onDeliver = vi.fn();
    const { result } = renderHook(() =>
      useMentionNotifications({ currentUserId: 'user1', onDeliver }),
    );

    const notif = makeNotification();
    act(() => {
      result.current.addNotification(notif);
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
    expect(onDeliver).toHaveBeenCalledWith(notif);
  });

  it('ignores notifications for other users', () => {
    const onDeliver = vi.fn();
    const { result } = renderHook(() =>
      useMentionNotifications({ currentUserId: 'user1', onDeliver }),
    );

    act(() => {
      result.current.addNotification(makeNotification({ recipientId: 'user2' }));
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(onDeliver).not.toHaveBeenCalled();
  });

  it('prevents duplicate notifications', () => {
    const { result } = renderHook(() =>
      useMentionNotifications({ currentUserId: 'user1' }),
    );

    const notif = makeNotification();
    act(() => {
      result.current.addNotification(notif);
      result.current.addNotification(notif);
    });

    expect(result.current.notifications).toHaveLength(1);
  });

  it('marks a notification as read', () => {
    const notif = makeNotification();
    const { result } = renderHook(() =>
      useMentionNotifications({
        currentUserId: 'user1',
        initialNotifications: [notif],
      }),
    );

    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markAsRead('n1');
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0].read).toBe(true);
  });

  it('marks all notifications as read', () => {
    const n1 = makeNotification({ id: 'n1' });
    const n2 = makeNotification({ id: 'n2' });
    const { result } = renderHook(() =>
      useMentionNotifications({
        currentUserId: 'user1',
        initialNotifications: [n1, n2],
      }),
    );

    expect(result.current.unreadCount).toBe(2);

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('dismisses a notification', () => {
    const notif = makeNotification();
    const { result } = renderHook(() =>
      useMentionNotifications({
        currentUserId: 'user1',
        initialNotifications: [notif],
      }),
    );

    act(() => {
      result.current.dismiss('n1');
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('clears all notifications', () => {
    const n1 = makeNotification({ id: 'n1' });
    const n2 = makeNotification({ id: 'n2' });
    const { result } = renderHook(() =>
      useMentionNotifications({
        currentUserId: 'user1',
        initialNotifications: [n1, n2],
      }),
    );

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
  });
});
