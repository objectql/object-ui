import { describe, it, expect } from 'vitest';
import type { KeyboardNavigationConfig, FocusTrapConfig } from '@object-ui/types';
import {
  resolveKeyboardConfig,
  parseShortcutKey,
  matchesShortcut,
  createFocusTrapConfig,
} from '../../protocols/KeyboardProtocol';

describe('KeyboardProtocol', () => {
  // ==========================================================================
  // resolveKeyboardConfig
  // ==========================================================================
  describe('resolveKeyboardConfig', () => {
    it('should apply defaults for empty config', () => {
      const config = {} as KeyboardNavigationConfig;
      const resolved = resolveKeyboardConfig(config);

      expect(resolved.shortcuts).toEqual([]);
      expect(resolved.rovingTabindex).toBe(false);
      expect(resolved.focusManagement.tabOrder).toBe('auto');
      expect(resolved.focusManagement.skipLinks).toBe(false);
      expect(resolved.focusManagement.focusVisible).toBe(true);
      expect(resolved.focusManagement.arrowNavigation).toBe(false);
      expect(resolved.focusManagement.focusTrap).toBeUndefined();
    });

    it('should resolve ariaLabel from string', () => {
      const config = { ariaLabel: 'Navigation' } as KeyboardNavigationConfig;
      const resolved = resolveKeyboardConfig(config);

      expect(resolved.ariaLabel).toBe('Navigation');
    });

    it('should resolve ariaLabel from translation object', () => {
      const config = {
        ariaLabel: { key: 'nav.label', defaultValue: 'Nav panel' },
      } as unknown as KeyboardNavigationConfig;
      const resolved = resolveKeyboardConfig(config);

      expect(resolved.ariaLabel).toBe('Nav panel');
    });

    it('should preserve explicit values', () => {
      const config = {
        rovingTabindex: true,
        role: 'toolbar',
        ariaDescribedBy: 'desc-id',
      } as KeyboardNavigationConfig;
      const resolved = resolveKeyboardConfig(config);

      expect(resolved.rovingTabindex).toBe(true);
      expect(resolved.role).toBe('toolbar');
      expect(resolved.ariaDescribedBy).toBe('desc-id');
    });
  });

  // ==========================================================================
  // parseShortcutKey
  // ==========================================================================
  describe('parseShortcutKey', () => {
    it('should parse Ctrl+S', () => {
      const parsed = parseShortcutKey('Ctrl+S');

      expect(parsed.key).toBe('s');
      expect(parsed.ctrlOrMeta).toBe(true);
      expect(parsed.shift).toBe(false);
      expect(parsed.alt).toBe(false);
    });

    it('should parse Alt+Shift+N', () => {
      const parsed = parseShortcutKey('Alt+Shift+N');

      expect(parsed.key).toBe('n');
      expect(parsed.ctrlOrMeta).toBe(false);
      expect(parsed.shift).toBe(true);
      expect(parsed.alt).toBe(true);
    });

    it('should parse single key Escape', () => {
      const parsed = parseShortcutKey('Escape');

      expect(parsed.key).toBe('escape');
      expect(parsed.ctrlOrMeta).toBe(false);
      expect(parsed.shift).toBe(false);
      expect(parsed.alt).toBe(false);
    });

    it('should be case insensitive', () => {
      const parsed = parseShortcutKey('ctrl+s');

      expect(parsed.key).toBe('s');
      expect(parsed.ctrlOrMeta).toBe(true);
    });

    it('should parse single key F1', () => {
      const parsed = parseShortcutKey('F1');

      expect(parsed.key).toBe('f1');
      expect(parsed.ctrlOrMeta).toBe(false);
      expect(parsed.shift).toBe(false);
      expect(parsed.alt).toBe(false);
    });

    it('should recognise Meta as ctrlOrMeta', () => {
      const parsed = parseShortcutKey('Meta+K');

      expect(parsed.ctrlOrMeta).toBe(true);
      expect(parsed.key).toBe('k');
    });
  });

  // ==========================================================================
  // matchesShortcut
  // ==========================================================================
  describe('matchesShortcut', () => {
    it('should match Ctrl+S event', () => {
      const event = { key: 's', ctrlKey: true };
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(true);
    });

    it('should match Meta+S event (Cmd on Mac)', () => {
      const event = { key: 's', metaKey: true };
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(true);
    });

    it('should not match when key differs', () => {
      const event = { key: 'a', ctrlKey: true };
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(false);
    });

    it('should not match when modifier is missing', () => {
      const event = { key: 's' };
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(false);
    });

    it('should not match when extra modifier is present', () => {
      const event = { key: 's', ctrlKey: true, shiftKey: true };
      expect(matchesShortcut(event, 'Ctrl+S')).toBe(false);
    });

    it('should match Escape without modifiers', () => {
      const event = { key: 'Escape' };
      expect(matchesShortcut(event, 'Escape')).toBe(true);
    });
  });

  // ==========================================================================
  // createFocusTrapConfig
  // ==========================================================================
  describe('createFocusTrapConfig', () => {
    it('should apply defaults for minimal config', () => {
      const config = {} as FocusTrapConfig;
      const resolved = createFocusTrapConfig(config);

      expect(resolved.enabled).toBe(false);
      expect(resolved.returnFocus).toBe(true);
      expect(resolved.escapeDeactivates).toBe(true);
      expect(resolved.initialFocus).toBeUndefined();
    });

    it('should preserve explicit values', () => {
      const config = {
        enabled: true,
        initialFocus: '#first-input',
        returnFocus: false,
        escapeDeactivates: false,
      } as FocusTrapConfig;
      const resolved = createFocusTrapConfig(config);

      expect(resolved.enabled).toBe(true);
      expect(resolved.initialFocus).toBe('#first-input');
      expect(resolved.returnFocus).toBe(false);
      expect(resolved.escapeDeactivates).toBe(false);
    });
  });
});
