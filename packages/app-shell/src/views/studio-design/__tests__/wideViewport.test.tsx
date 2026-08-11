/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3c follow-up — issue #2477 item 3: the Studio folded layout goes
 * side-by-side (canvas BESIDE properties) from `xl` (1280), not `2xl` (1536).
 *
 * This is the regression pin the original fix (PR #2478) shipped without: the
 * breakpoint lived as a module-private constant inside StudioDesignSurface, so
 * raising it back to 1536 — which re-hides the canvas behind the tab
 * auto-switch on every 1280–1512 laptop, the exact defect the card reported —
 * kept the whole suite green. `.test.tsx` for the DOM (matchMedia + innerWidth).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { WIDE_VIEWPORT_BREAKPOINT, useIsWideViewport } from '../wideViewport';

const realInnerWidth = window.innerWidth;

function setViewportWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: px,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  setViewportWidth(realInnerWidth);
});

describe('WIDE_VIEWPORT_BREAKPOINT (#2477 item 3 — xl, not 2xl)', () => {
  it('is Tailwind xl (1280) so the common laptop keeps the canvas visible', () => {
    // The card's whole complaint: at 2xl the 1280–1512 band tabbed, and the tab
    // auto-switch hides the canvas the moment a block is selected.
    expect(WIDE_VIEWPORT_BREAKPOINT).toBe(1280);
    expect(WIDE_VIEWPORT_BREAKPOINT).not.toBe(1536);
  });
});

describe('useIsWideViewport', () => {
  it('is wide at exactly the breakpoint (inclusive boundary)', () => {
    setViewportWidth(WIDE_VIEWPORT_BREAKPOINT);
    const { result } = renderHook(() => useIsWideViewport());
    expect(result.current).toBe(true);
  });

  it('is wide across the common laptop band the card named (1280–1512)', () => {
    for (const width of [1280, 1366, 1440, 1512]) {
      setViewportWidth(width);
      const { result, unmount } = renderHook(() => useIsWideViewport());
      expect(result.current, `${width}px should be side-by-side`).toBe(true);
      unmount();
    }
  });

  it('is NOT wide one pixel below the breakpoint — the tabs stay below xl', () => {
    setViewportWidth(WIDE_VIEWPORT_BREAKPOINT - 1);
    const { result } = renderHook(() => useIsWideViewport());
    expect(result.current).toBe(false);
  });

  it('keeps tabs on the narrow viewports that genuinely lack room', () => {
    for (const width of [768, 1024, 1152]) {
      setViewportWidth(width);
      const { result, unmount } = renderHook(() => useIsWideViewport());
      expect(result.current, `${width}px should still tab`).toBe(false);
      unmount();
    }
  });
});
