/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavigationOverlay } from '../hooks/useNavigationOverlay';
import type { NavigationConfig } from '../hooks/useNavigationOverlay';

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', { value: mockWindowOpen, writable: true });

describe('useNavigationOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // Default behavior (no navigation config)
  // ============================================================

  describe('default behavior (no config)', () => {
    it('should call onNavigate with record ID when no navigation config', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useNavigationOverlay({
          objectName: 'contacts',
          onNavigate,
        })
      );

      act(() => {
        result.current.handleClick({ _id: '123', name: 'Test' });
      });

      expect(onNavigate).toHaveBeenCalledWith('123', 'view');
      expect(result.current.isOpen).toBe(false);
    });

    it('should use id field when _id is not present', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useNavigationOverlay({
          objectName: 'contacts',
          onNavigate,
        })
      );

      act(() => {
        result.current.handleClick({ id: '456', name: 'Test' });
      });

      expect(onNavigate).toHaveBeenCalledWith('456', 'view');
    });

    it('should do nothing when no onNavigate and no navigation config', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({ objectName: 'contacts' })
      );

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  // ============================================================
  // onRowClick priority
  // ============================================================

  describe('onRowClick priority', () => {
    it('should call onRowClick instead of navigation when provided', () => {
      const onRowClick = vi.fn();
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'drawer' },
          objectName: 'contacts',
          onNavigate,
          onRowClick,
        })
      );

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(onRowClick).toHaveBeenCalledWith({ _id: '123' });
      expect(onNavigate).not.toHaveBeenCalled();
      expect(result.current.isOpen).toBe(false);
    });
  });

  // ============================================================
  // mode: 'none'
  // ============================================================

  describe('mode: none', () => {
    it('should do nothing when mode is none', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'none' },
          objectName: 'contacts',
          onNavigate,
        })
      );

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(onNavigate).not.toHaveBeenCalled();
      expect(result.current.isOpen).toBe(false);
    });

    it('should do nothing when preventNavigation is true', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'page', preventNavigation: true },
          objectName: 'contacts',
          onNavigate,
        })
      );

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // mode: 'page'
  // ============================================================

  describe('mode: page', () => {
    it('should call onNavigate for page mode', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'page' },
          objectName: 'contacts',
          onNavigate,
        })
      );

      act(() => {
        result.current.handleClick({ _id: 'abc' });
      });

      expect(onNavigate).toHaveBeenCalledWith('abc', 'view');
      expect(result.current.isOpen).toBe(false);
    });
  });

  // ============================================================
  // mode: 'new_window'
  // ============================================================

  describe('mode: new_window', () => {
    it('should open a new window for new_window mode', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'new_window' },
          objectName: 'contacts',
        })
      );

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(mockWindowOpen).toHaveBeenCalledWith('/contacts/123', '_blank');
      expect(result.current.isOpen).toBe(false);
    });

    it('should open a new window when openNewTab is true regardless of mode', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'page', openNewTab: true },
          objectName: 'users',
        })
      );

      act(() => {
        result.current.handleClick({ id: '456' });
      });

      expect(mockWindowOpen).toHaveBeenCalledWith('/users/456', '_blank');
    });

    it('should delegate to onNavigate with new_window action when onNavigate is provided', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'new_window' },
          objectName: 'contacts',
          onNavigate,
        })
      );

      act(() => {
        result.current.handleClick({ _id: '789' });
      });

      expect(onNavigate).toHaveBeenCalledWith('789', 'new_window');
      expect(mockWindowOpen).not.toHaveBeenCalled();
      expect(result.current.isOpen).toBe(false);
    });

    it('should fallback to window.open when onNavigate is not provided', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'new_window' },
          objectName: 'accounts',
        })
      );

      act(() => {
        result.current.handleClick({ _id: '101' });
      });

      expect(mockWindowOpen).toHaveBeenCalledWith('/accounts/101', '_blank');
    });
  });

  // ============================================================
  // mode: 'drawer'
  // ============================================================

  describe('mode: drawer', () => {
    it('should open overlay for drawer mode', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'drawer' },
          objectName: 'contacts',
        })
      );

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isOverlay).toBe(true);
      expect(result.current.mode).toBe('drawer');

      act(() => {
        result.current.handleClick({ _id: '123', name: 'John' });
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.selectedRecord).toEqual({ _id: '123', name: 'John' });
    });

    it('should close the overlay', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'drawer' },
          objectName: 'contacts',
        })
      );

      act(() => {
        result.current.handleClick({ _id: '123' });
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.close();
      });
      expect(result.current.isOpen).toBe(false);
      expect(result.current.selectedRecord).toBe(null);
    });

    it('should expose width from config', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'drawer', width: '600px' },
          objectName: 'contacts',
        })
      );

      expect(result.current.width).toBe('600px');
    });
  });

  // ============================================================
  // mode: 'modal'
  // ============================================================

  describe('mode: modal', () => {
    it('should open overlay for modal mode', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'modal' },
          objectName: 'contacts',
        })
      );

      expect(result.current.isOverlay).toBe(true);
      expect(result.current.mode).toBe('modal');

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should support numeric width', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'modal', width: 800 },
          objectName: 'contacts',
        })
      );

      expect(result.current.width).toBe(800);
    });
  });

  // ============================================================
  // mode: 'split'
  // ============================================================

  describe('mode: split', () => {
    it('should open overlay for split mode', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'split' },
          objectName: 'contacts',
        })
      );

      expect(result.current.isOverlay).toBe(true);
      expect(result.current.mode).toBe('split');

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  // ============================================================
  // mode: 'popover'
  // ============================================================

  describe('mode: popover', () => {
    it('should open overlay for popover mode', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'popover' },
          objectName: 'contacts',
        })
      );

      expect(result.current.isOverlay).toBe(true);
      expect(result.current.mode).toBe('popover');

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  // ============================================================
  // open / close helpers
  // ============================================================

  describe('open/close helpers', () => {
    it('should support programmatic open', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'drawer' },
          objectName: 'contacts',
        })
      );

      act(() => {
        result.current.open({ _id: 'test', name: 'Direct open' });
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.selectedRecord).toEqual({ _id: 'test', name: 'Direct open' });
    });

    it('should support setIsOpen for controlled overlay', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'modal' },
          objectName: 'contacts',
        })
      );

      act(() => {
        result.current.open({ _id: '1' });
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.setIsOpen(false);
      });
      expect(result.current.isOpen).toBe(false);
    });
  });

  // ============================================================
  // isOverlay flag
  // ============================================================

  describe('isOverlay flag', () => {
    const overlayModes: NavigationConfig['mode'][] = ['drawer', 'modal', 'split', 'popover'];
    const nonOverlayModes: NavigationConfig['mode'][] = ['page', 'new_window', 'none'];

    overlayModes.forEach((mode) => {
      it(`should be true for mode: ${mode}`, () => {
        const { result } = renderHook(() =>
          useNavigationOverlay({
            navigation: { mode },
            objectName: 'test',
          })
        );
        expect(result.current.isOverlay).toBe(true);
      });
    });

    nonOverlayModes.forEach((mode) => {
      it(`should be false for mode: ${mode}`, () => {
        const { result } = renderHook(() =>
          useNavigationOverlay({
            navigation: { mode },
            objectName: 'test',
          })
        );
        expect(result.current.isOverlay).toBe(false);
      });
    });
  });

  // ============================================================
  // navigation.view property
  // ============================================================

  describe('navigation.view property', () => {
    it('should expose the view property from config', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'drawer', view: 'edit_form' },
          objectName: 'contacts',
        })
      );

      expect(result.current.view).toBe('edit_form');
    });

    it('should pass view to onNavigate for page mode', () => {
      const onNavigate = vi.fn();
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'page', view: 'detail_view' },
          objectName: 'contacts',
          onNavigate,
        })
      );

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(onNavigate).toHaveBeenCalledWith('123', 'detail_view');
    });

    it('should include view in new_window URL', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'new_window', view: 'edit_form' },
          objectName: 'contacts',
        })
      );

      act(() => {
        result.current.handleClick({ _id: '123' });
      });

      expect(mockWindowOpen).toHaveBeenCalledWith('/contacts/123/edit_form', '_blank');
    });

    it('should return undefined view when not configured', () => {
      const { result } = renderHook(() =>
        useNavigationOverlay({
          navigation: { mode: 'drawer' },
          objectName: 'contacts',
        })
      );

      expect(result.current.view).toBeUndefined();
    });
  });
});
