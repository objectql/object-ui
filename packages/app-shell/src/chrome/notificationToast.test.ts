/**
 * The console's `toast` surface — the one display type `NotificationProvider`
 * delegates instead of rendering itself (#3014). These pin the mapping onto
 * sonner; which notifications ever get here is covered by
 * `console/__tests__/ConsoleShell.notifications.test.tsx`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NotificationItem } from '@object-ui/react';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(),
  }),
}));

import { toast } from 'sonner';
import { presentNotificationToast } from './notificationToast';

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    title: 'Saved',
    severity: 'success',
    createdAt: new Date(0),
    ...overrides,
  };
}

describe('presentNotificationToast', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('maps each severity to its sonner variant', () => {
    presentNotificationToast(item({ severity: 'info' }));
    presentNotificationToast(item({ severity: 'success' }));
    presentNotificationToast(item({ severity: 'warning' }));
    presentNotificationToast(item({ severity: 'error' }));

    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('passes the message through as the toast description', () => {
    presentNotificationToast(item({ message: 'Record updated' }));
    expect(toast.success).toHaveBeenCalledWith('Saved', expect.objectContaining({
      description: 'Record updated',
    }));
  });

  it('turns duration 0 into a persistent toast', () => {
    // `0 = persistent` is the notification contract; sonner spells it Infinity.
    // Passing the 0 through would make the toast vanish on the next tick.
    presentNotificationToast(item({ duration: 0 }));
    expect(toast.success).toHaveBeenCalledWith('Saved', expect.objectContaining({
      duration: Infinity,
    }));
  });

  it('leaves an unset duration to the ConsoleToaster default', () => {
    presentNotificationToast(item());
    expect(toast.success).toHaveBeenCalledWith('Saved', expect.objectContaining({
      duration: undefined,
    }));
  });

  it('forwards an explicit duration unchanged', () => {
    presentNotificationToast(item({ duration: 12_000 }));
    expect(toast.success).toHaveBeenCalledWith('Saved', expect.objectContaining({
      duration: 12_000,
    }));
  });

  it('maps the first action to the toast action button', () => {
    const onClick = vi.fn();
    presentNotificationToast(item({
      actions: [
        { label: 'Undo', onClick },
        { label: 'Ignored — a toast has one action slot', onClick: vi.fn() },
      ],
    }));

    const options = vi.mocked(toast.success).mock.calls[0][1] as {
      action?: { label: string; onClick: () => void };
    };
    expect(options.action?.label).toBe('Undo');
    options.action?.onClick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits the action slot entirely when none is declared', () => {
    presentNotificationToast(item());
    const options = vi.mocked(toast.success).mock.calls[0][1] as Record<string, unknown>;
    expect(options).not.toHaveProperty('action');
  });

  it('forwards dismissible', () => {
    presentNotificationToast(item({ dismissible: false }));
    expect(toast.success).toHaveBeenCalledWith('Saved', expect.objectContaining({
      dismissible: false,
    }));
  });
});
