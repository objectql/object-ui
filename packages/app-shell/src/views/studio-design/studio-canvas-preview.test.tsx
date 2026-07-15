// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Contract tests for the Studio-canvas preview registry.
 *
 * The registry exists to give the Studio design surface a per-type, overridable
 * canvas renderer, replacing the hardcoded `object → object-view grid` branch in
 * `StudioDesignSurface` (issue #2337). These pin the three properties the
 * surface relies on:
 *   1. `object` ships a built-in default (so the grid still shows out of the box).
 *   2. Unknown types resolve to `undefined` (so the surface falls back to the
 *      generic MetadataPreview pipeline like every other type).
 *   3. Registration is last-write-wins (so downstream can override without
 *      forking the surface).
 */
import { describe, expect, it } from 'vitest';
import type { StudioCanvasPreviewProps } from './studio-canvas-preview';
import {
  getStudioCanvasPreview,
  registerStudioCanvasPreview,
  listStudioCanvasPreviewTypes,
  StudioObjectRecordsCanvas,
} from './studio-canvas-preview';

describe('studio-canvas-preview registry', () => {
  it('ships a built-in default for `object` (the records grid)', () => {
    expect(getStudioCanvasPreview('object')).toBe(StudioObjectRecordsCanvas);
    expect(listStudioCanvasPreviewTypes()).toContain('object');
  });

  it('returns undefined for types with no override (falls back to MetadataPreview)', () => {
    // `page`/`dashboard`/etc. have a MetadataPreview but no studio-canvas
    // override — they must NOT be intercepted here.
    expect(getStudioCanvasPreview('page')).toBeUndefined();
    expect(getStudioCanvasPreview('')).toBeUndefined();
    expect(getStudioCanvasPreview('does-not-exist')).toBeUndefined();
  });

  it('is last-write-wins so downstream can override the default', () => {
    const original = getStudioCanvasPreview('object');
    const Custom = (_props: StudioCanvasPreviewProps) => null;
    try {
      registerStudioCanvasPreview('object', Custom);
      expect(getStudioCanvasPreview('object')).toBe(Custom);
    } finally {
      // Restore so registry state doesn't leak into other suites (the registry
      // is module-global).
      registerStudioCanvasPreview('object', original!);
    }
    expect(getStudioCanvasPreview('object')).toBe(StudioObjectRecordsCanvas);
  });
});
