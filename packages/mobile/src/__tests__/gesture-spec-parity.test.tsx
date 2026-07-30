/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Gesture type ↔ spec vocabulary parity + dispatch (#2942).
 *
 * `useSpecGesture` never read `config.type` — it branched on which
 * sub-object was present, so the spec's `pan` / `drag` / `rotate` /
 * `double_tap` (types with no sub-object) all kept the `'tap'` initializer
 * and fired on a tap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GestureTypeSchema } from '@objectstack/spec/ui';
import { useSpecGesture, SPEC_GESTURE_TYPE_MAP } from '../useSpecGesture';
import { useGesture } from '../useGesture';

vi.mock('../useGesture', () => ({ useGesture: vi.fn(() => ({ current: null })) }));

const specNames: string[] = (() => {
  const raw = (GestureTypeSchema as unknown as { options?: readonly string[] }).options;
  return Array.isArray(raw) ? [...raw] : [];
})();

describe('useSpecGesture covers the spec gesture vocabulary', () => {
  it('reads a non-empty enum from the spec', () => {
    expect(specNames, 'could not read GestureTypeSchema.options from the spec').not.toEqual([]);
  });

  it('maps every spec gesture type onto a recognizer', () => {
    const unmapped = specNames.filter((name) => !(name in SPEC_GESTURE_TYPE_MAP));
    expect(unmapped, 'these validate and then recognize as a plain tap').toEqual([]);
  });

  it('maps only spec gesture types', () => {
    const extra = Object.keys(SPEC_GESTURE_TYPE_MAP).filter((name) => !specNames.includes(name));
    expect(extra, 'renderer-local gesture dialect — promote into @objectstack/spec instead').toEqual([]);
  });
});

describe('the declared type drives recognition', () => {
  beforeEach(() => vi.mocked(useGesture).mockClear());

  const recognizerFor = (config: Record<string, unknown>) => {
    renderHook(() => useSpecGesture({ config: config as never, onGesture: () => {} }));
    return vi.mocked(useGesture).mock.calls.at(-1)?.[0]?.type;
  };

  it("'double_tap' / 'pan' / 'drag' / 'rotate' no longer collapse to tap", () => {
    expect(recognizerFor({ type: 'double_tap' })).toBe('double-tap');
    expect(recognizerFor({ type: 'pan' })).toBe('pan');
    expect(recognizerFor({ type: 'drag' })).toBe('pan');
    expect(recognizerFor({ type: 'rotate' })).toBe('rotate');
  });

  it('swipe resolves per configured direction', () => {
    expect(recognizerFor({ type: 'swipe', swipe: { direction: ['up'] } })).toBe('swipe-up');
  });

  it('legacy configs without a type still resolve from their sub-object', () => {
    expect(recognizerFor({ longPress: { duration: 400 } })).toBe('long-press');
    expect(recognizerFor({ pinch: {} })).toBe('pinch');
  });
});
