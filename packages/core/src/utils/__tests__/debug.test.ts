/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debugLog, debugTime, debugTimeEnd } from '../debug';

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
});
