/**
 * Tests for NotificationProvider and useNotifications
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  NOTIFICATION_PRESENTATIONS,
  NotificationProvider,
  resolveNotificationPresentation,
  useNotifications,
  useNotificationsByPresentation,
  useHasNotificationProvider,
  type NotificationPresentation,
} from '../NotificationContext';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

describe('NotificationProvider', () => {
  it('provides notifications context', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('adds a notification via notify', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.notify({ title: 'Hello', severity: 'info' });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe('Hello');
    expect(result.current.unreadCount).toBe(1);
  });

  it('adds info notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.info('Info title', 'Info message');
    });

    expect(result.current.notifications[0].severity).toBe('info');
  });

  it('adds success notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.success('Success!');
    });

    expect(result.current.notifications[0].severity).toBe('success');
  });

  it('adds warning notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.warning('Warning!');
    });

    expect(result.current.notifications[0].severity).toBe('warning');
  });

  it('adds error notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.error('Error!');
    });

    expect(result.current.notifications[0].severity).toBe('error');
  });

  it('marks notification as read', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    let id: string = '';
    act(() => {
      id = result.current.info('Test');
    });

    act(() => {
      result.current.markAsRead(id);
    });

    expect(result.current.notifications[0].read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('marks all as read', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.info('Test 1');
      result.current.info('Test 2');
    });

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('dismisses a notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    let id: string = '';
    act(() => {
      id = result.current.info('Test');
    });

    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('clears all notifications', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.info('Test 1');
      result.current.info('Test 2');
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('calls onToast handler', () => {
    const onToast = vi.fn();
    const customWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <NotificationProvider onToast={onToast}>{children}</NotificationProvider>
    );

    const { result } = renderHook(() => useNotifications(), {
      wrapper: customWrapper,
    });

    act(() => {
      result.current.info('Toast test');
    });

    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Toast test', severity: 'info' })
    );
  });
});

/**
 * Presentation routing (#3014).
 *
 * `onToast` used to receive EVERY notification, so a `banner` and an `inline`
 * both surfaced as a toast — the value reached the delegate but nothing branched
 * on it. Each presentation now goes to its own surface.
 */
describe('displayType routes to a distinct presentation', () => {
  const warn = vi.spyOn(console, 'warn');
  beforeEach(() => { warn.mockImplementation(() => {}); });
  afterEach(() => { warn.mockReset(); });

  function setup(onToast?: (n: unknown) => void) {
    const customWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <NotificationProvider onToast={onToast}>{children}</NotificationProvider>
    );
    return renderHook(
      () => ({
        ctx: useNotifications(),
        toast: useNotificationsByPresentation('toast'),
        snackbar: useNotificationsByPresentation('snackbar'),
        banner: useNotificationsByPresentation('banner'),
        alert: useNotificationsByPresentation('alert'),
        inline: useNotificationsByPresentation('inline'),
      }),
      { wrapper: customWrapper },
    );
  }

  it('hands the toast delegate ONLY the toast notifications', () => {
    const onToast = vi.fn();
    const { result } = setup(onToast);

    act(() => {
      result.current.ctx.notify({ title: 'A toast', severity: 'info', displayType: 'toast' });
      result.current.ctx.notify({ title: 'A banner', severity: 'warning', displayType: 'banner' });
      result.current.ctx.notify({ title: 'A snackbar', severity: 'info', displayType: 'snackbar' });
      result.current.ctx.notify({ title: 'An alert', severity: 'error', displayType: 'alert' });
      result.current.ctx.notify({ title: 'Inline', severity: 'info', displayType: 'inline' });
    });

    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'A toast' }));
  });

  it('exposes each notification to exactly one presentation surface', () => {
    const { result } = setup(vi.fn());

    act(() => {
      result.current.ctx.notify({ title: 'A toast', severity: 'info', displayType: 'toast' });
      result.current.ctx.notify({ title: 'A banner', severity: 'warning', displayType: 'banner' });
      result.current.ctx.notify({ title: 'A snackbar', severity: 'info', displayType: 'snackbar' });
      result.current.ctx.notify({ title: 'An alert', severity: 'error', displayType: 'alert' });
      result.current.ctx.notify({ title: 'Inline', severity: 'info', displayType: 'inline' });
    });

    expect(result.current.toast.map((n) => n.title)).toEqual(['A toast']);
    expect(result.current.banner.map((n) => n.title)).toEqual(['A banner']);
    expect(result.current.snackbar.map((n) => n.title)).toEqual(['A snackbar']);
    expect(result.current.alert.map((n) => n.title)).toEqual(['An alert']);
    expect(result.current.inline.map((n) => n.title)).toEqual(['Inline']);
  });

  it('defaults to toast and resolves the deprecated modal dialect to alert', () => {
    const onToast = vi.fn();
    const { result } = setup(onToast);

    act(() => {
      result.current.ctx.notify({ title: 'Default', severity: 'info' });
      result.current.ctx.notify({ title: 'Legacy', severity: 'info', displayType: 'modal' });
    });

    expect(result.current.toast.map((n) => n.title)).toEqual(['Default']);
    expect(result.current.alert.map((n) => n.title)).toEqual(['Legacy']);
    // The stored item carries the RESOLVED presentation, never `modal`.
    expect(result.current.alert[0].displayType).toBe('alert');
    expect(onToast).toHaveBeenCalledTimes(1);
  });

  it('keeps the persistent presentations on screen past the transient timer', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup(vi.fn());

      act(() => {
        result.current.ctx.notify({ title: 'A toast', severity: 'info', displayType: 'toast' });
        result.current.ctx.notify({ title: 'A snackbar', severity: 'info', displayType: 'snackbar' });
        result.current.ctx.notify({ title: 'A banner', severity: 'warning', displayType: 'banner' });
        result.current.ctx.notify({ title: 'An alert', severity: 'error', displayType: 'alert' });
        result.current.ctx.notify({ title: 'Inline', severity: 'info', displayType: 'inline' });
      });

      act(() => { vi.advanceTimersByTime(10_000); });

      // A banner that evaporates after the shared 5s toast timer is not a banner.
      expect(result.current.ctx.notifications.map((n) => n.title))
        .toEqual(['Inline', 'An alert', 'A banner']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors an explicit duration on a persistent presentation', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup(vi.fn());

      act(() => {
        result.current.ctx.notify({
          title: 'Timed banner', severity: 'info', displayType: 'banner', duration: 1000,
        });
      });
      act(() => { vi.advanceTimersByTime(1500); });

      expect(result.current.ctx.notifications).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('routes inline notifications by scope', () => {
    const scoped: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <NotificationProvider>{children}</NotificationProvider>
    );
    const { result } = renderHook(
      () => ({
        ctx: useNotifications(),
        formA: useNotificationsByPresentation('inline', 'form-a'),
        formB: useNotificationsByPresentation('inline', 'form-b'),
        unscoped: useNotificationsByPresentation('inline'),
      }),
      { wrapper: scoped },
    );

    act(() => {
      result.current.ctx.notify({ title: 'A', severity: 'error', displayType: 'inline', scope: 'form-a' });
      result.current.ctx.notify({ title: 'B', severity: 'error', displayType: 'inline', scope: 'form-b' });
      result.current.ctx.notify({ title: 'Page', severity: 'info', displayType: 'inline' });
    });

    expect(result.current.formA.map((n) => n.title)).toEqual(['A']);
    expect(result.current.formB.map((n) => n.title)).toEqual(['B']);
    expect(result.current.unscoped.map((n) => n.title)).toEqual(['Page']);
  });

  it('warns when a surface-rendered presentation has no surface mounted', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.notify({ title: 'Orphan', severity: 'warning', displayType: 'banner' });
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("declares displayType 'banner'"));
  });

  it('stays quiet for a store-only provider raising toasts', () => {
    // No `onToast` is the supported notification-centre mode, not a mistake.
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => { result.current.info('Just stored'); });

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn once the surface is mounted', () => {
    const { result } = renderHook(
      () => ({ ctx: useNotifications(), banners: useNotificationsByPresentation('banner') }),
      { wrapper },
    );

    act(() => {
      result.current.ctx.notify({ title: 'Seen', severity: 'info', displayType: 'banner' });
    });

    expect(warn).not.toHaveBeenCalled();
    expect(result.current.banners).toHaveLength(1);
  });
});

describe('presentation table', () => {
  it('gives every display type its own surface', () => {
    const surfaces = Object.values(NOTIFICATION_PRESENTATIONS).map((p) => p.surface);
    // The bug: five display types, one surface. Distinct surfaces is the fix.
    expect(new Set(surfaces).size).toBe(surfaces.length);
  });

  it('resolves unknown / absent display types to the spec default', () => {
    expect(resolveNotificationPresentation(undefined)).toBe('toast');
    expect(resolveNotificationPresentation('modal')).toBe('alert');
    expect(resolveNotificationPresentation('nonsense' as NotificationPresentation)).toBe('toast');
  });
});

describe('useHasNotificationProvider', () => {
  it('returns false outside provider', () => {
    const { result } = renderHook(() => useHasNotificationProvider());
    expect(result.current).toBe(false);
  });

  it('returns true inside provider', () => {
    const { result } = renderHook(() => useHasNotificationProvider(), { wrapper });
    expect(result.current).toBe(true);
  });
});

describe('useNotifications without provider', () => {
  it('throws error', () => {
    expect(() => {
      renderHook(() => useNotifications());
    }).toThrow('useNotifications must be used within a <NotificationProvider>');
  });
});
