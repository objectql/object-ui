/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debugLog, debugTime, debugTimeEnd, parseDebugFlags, isDebugEnabled } from '../debug';

describe('Debug Utilities', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    (globalThis as any).OBJECTUI_DEBUG = undefined;
  });

  describe('debugLog', () => {
    it('should not log when debug is disabled', () => {
      (globalThis as any).OBJECTUI_DEBUG = false;
      debugLog('schema', 'test message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log when OBJECTUI_DEBUG is true', () => {
      (globalThis as any).OBJECTUI_DEBUG = true;
      debugLog('schema', 'Resolving component');
      expect(consoleSpy).toHaveBeenCalledWith('[ObjectUI Debug][schema] Resolving component');
    });

    it('should log with data when provided', () => {
      (globalThis as any).OBJECTUI_DEBUG = true;
      debugLog('registry', 'Registered', { type: 'Button' });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ObjectUI Debug][registry] Registered',
        { type: 'Button' }
      );
    });

    it('should not log when debug is undefined', () => {
      debugLog('action', 'test');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('debugTime / debugTimeEnd', () => {
    it('should not log timing when debug is disabled', () => {
      (globalThis as any).OBJECTUI_DEBUG = false;
      debugTime('test-timer');
      debugTimeEnd('test-timer');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should measure and log elapsed time when debug is enabled', () => {
      (globalThis as any).OBJECTUI_DEBUG = true;
      debugTime('render-test');

      // Simulate some delay via a busy loop
      const start = performance.now();
      while (performance.now() - start < 5) {
        // wait ~5ms
      }

      debugTimeEnd('render-test');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\[ObjectUI Debug\]\[perf\] render-test: \d+\.\d{2}ms$/)
      );
    });

    it('should not log if debugTimeEnd is called without debugTime', () => {
      (globalThis as any).OBJECTUI_DEBUG = true;
      debugTimeEnd('nonexistent');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('parseDebugFlags', () => {
    it('should return enabled:false for empty search string', () => {
      expect(parseDebugFlags('')).toEqual({ enabled: false });
    });

    it('should detect __debug master switch', () => {
      expect(parseDebugFlags('?__debug')).toEqual({ enabled: true });
    });

    it('should detect individual sub-flags', () => {
      expect(parseDebugFlags('?__debug_schema')).toEqual({ enabled: true, schema: true });
      expect(parseDebugFlags('?__debug_perf')).toEqual({ enabled: true, perf: true });
      expect(parseDebugFlags('?__debug_data')).toEqual({ enabled: true, data: true });
      expect(parseDebugFlags('?__debug_expr')).toEqual({ enabled: true, expr: true });
      expect(parseDebugFlags('?__debug_events')).toEqual({ enabled: true, events: true });
      expect(parseDebugFlags('?__debug_registry')).toEqual({ enabled: true, registry: true });
    });

    it('should combine multiple sub-flags', () => {
      const flags = parseDebugFlags('?__debug_schema&__debug_perf&__debug_data');
      expect(flags).toEqual({ enabled: true, schema: true, perf: true, data: true });
    });

    it('should handle unrelated params gracefully', () => {
      const flags = parseDebugFlags('?foo=bar&baz=1');
      expect(flags).toEqual({ enabled: false });
    });

    it('should handle __debug mixed with sub-flags', () => {
      const flags = parseDebugFlags('?__debug&__debug_schema');
      expect(flags).toEqual({ enabled: true, schema: true });
    });
  });

  describe('isDebugEnabled', () => {
    it('should return true when globalThis.OBJECTUI_DEBUG is true', () => {
      (globalThis as any).OBJECTUI_DEBUG = true;
      expect(isDebugEnabled()).toBe(true);
    });

    it('should return true when globalThis.OBJECTUI_DEBUG is "true"', () => {
      (globalThis as any).OBJECTUI_DEBUG = 'true';
      expect(isDebugEnabled()).toBe(true);
    });

    it('should return false when no debug flag is set', () => {
      (globalThis as any).OBJECTUI_DEBUG = undefined;
      expect(isDebugEnabled()).toBe(false);
    });
  });
});
