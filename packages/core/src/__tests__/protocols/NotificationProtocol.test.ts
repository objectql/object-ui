import { describe, it, expect } from 'vitest';
import type {
  Notification as SpecNotification,
  NotificationConfig,
} from '@object-ui/types';
import {
  specNotificationToToast,
  mapSeverityToVariant,
  mapPosition,
  resolveNotificationConfig,
} from '../../protocols/NotificationProtocol';

describe('NotificationProtocol', () => {
  // ==========================================================================
  // mapSeverityToVariant
  // ==========================================================================
  describe('mapSeverityToVariant', () => {
    it.each([
      ['info', 'default'],
      ['success', 'success'],
      ['warning', 'warning'],
      ['error', 'destructive'],
    ] as const)('should map "%s" to "%s"', (severity, expected) => {
      expect(mapSeverityToVariant(severity)).toBe(expected);
    });

    it('should fall back to "default" for unknown severity', () => {
      expect(mapSeverityToVariant('critical')).toBe('default');
    });
  });

  // ==========================================================================
  // mapPosition
  // ==========================================================================
  describe('mapPosition', () => {
    it.each([
      ['top_left', 'top-left'],
      ['top_center', 'top-center'],
      ['top_right', 'top-right'],
      ['bottom_left', 'bottom-left'],
      ['bottom_center', 'bottom-center'],
      ['bottom_right', 'bottom-right'],
    ] as const)('should map "%s" to "%s"', (spec, expected) => {
      expect(mapPosition(spec)).toBe(expected);
    });

    it('should fall back to "top-right" for unknown position', () => {
      expect(mapPosition('center')).toBe('top-right');
    });
  });

  // ==========================================================================
  // resolveNotificationConfig
  // ==========================================================================
  describe('resolveNotificationConfig', () => {
    it('should apply all defaults for empty config', () => {
      const config = {} as NotificationConfig;
      const resolved = resolveNotificationConfig(config);

      expect(resolved.defaultPosition).toBe('top_right');
      expect(resolved.defaultDuration).toBe(5000);
      expect(resolved.maxVisible).toBe(5);
      expect(resolved.stackDirection).toBe('down');
      expect(resolved.pauseOnHover).toBe(true);
    });

    it('should preserve explicit values', () => {
      const config = {
        defaultPosition: 'bottom_left',
        defaultDuration: 3000,
        maxVisible: 3,
        stackDirection: 'up',
        pauseOnHover: false,
      } as NotificationConfig;
      const resolved = resolveNotificationConfig(config);

      expect(resolved.defaultPosition).toBe('bottom_left');
      expect(resolved.defaultDuration).toBe(3000);
      expect(resolved.maxVisible).toBe(3);
      expect(resolved.stackDirection).toBe('up');
      expect(resolved.pauseOnHover).toBe(false);
    });
  });

  // ==========================================================================
  // specNotificationToToast
  // ==========================================================================
  describe('specNotificationToToast', () => {
    it('should convert a basic notification to toast', () => {
      const notification = {
        message: 'Record saved',
        severity: 'success',
      } as SpecNotification;
      const toast = specNotificationToToast(notification);

      expect(toast.description).toBe('Record saved');
      expect(toast.variant).toBe('success');
      expect(toast.position).toBe('top-right');
      expect(toast.duration).toBe(5000);
      expect(toast.dismissible).toBe(true);
      expect(toast.actions).toEqual([]);
    });

    it('should handle translation objects for title and message', () => {
      const notification = {
        title: { key: 'notify.title', defaultValue: 'Heads up' },
        message: { key: 'notify.msg', defaultValue: 'Something happened' },
      } as unknown as SpecNotification;
      const toast = specNotificationToToast(notification);

      expect(toast.title).toBe('Heads up');
      expect(toast.description).toBe('Something happened');
    });

    it('should map actions to toast actions', () => {
      const notification = {
        message: 'Error occurred',
        severity: 'error',
        actions: [
          { label: 'Retry', action: 'retry', variant: 'primary' },
          { label: 'Dismiss', action: 'dismiss', variant: 'secondary' },
        ],
      } as unknown as SpecNotification;
      const toast = specNotificationToToast(notification);

      expect(toast.actions).toHaveLength(2);
      expect(toast.actions[0]).toEqual({ label: 'Retry', action: 'retry', variant: 'primary' });
      expect(toast.actions[1]).toEqual({ label: 'Dismiss', action: 'dismiss', variant: 'secondary' });
    });

    it('should apply defaults for missing fields', () => {
      const notification = {} as SpecNotification;
      const toast = specNotificationToToast(notification);

      expect(toast.description).toBe('');
      expect(toast.variant).toBe('default');
      expect(toast.position).toBe('top-right');
      expect(toast.duration).toBe(5000);
      expect(toast.dismissible).toBe(true);
    });
  });
});
