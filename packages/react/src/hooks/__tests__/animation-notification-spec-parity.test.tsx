/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Animation / notification / navigation ↔ spec vocabulary parity (#2942).
 *
 * Four hyphen-vs-underscore (and coverage) drifts lived in this package:
 *
 * - `useAnimation`'s preset map was keyed in hyphens while the spec enum uses
 *   underscores, and `rotate`/`flip` were absent — 6 of 9 spec presets looked
 *   up NOTHING and rendered no animation;
 * - its easing map had the same split, and the `EASING_MAP[easing] || easing`
 *   fallthrough emitted `animationTimingFunction: 'ease_in_out'` — invalid
 *   CSS the browser silently dropped;
 * - `NotificationContext` carried a `modal` dialect, missed `alert`/`inline`,
 *   and keyed positions in hyphens — all under comments claiming alignment;
 * - `useNavigationOverlay` read only the deprecated `width`, so an authored
 *   `size` bucket was ignored by every host except app-shell.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  TransitionPresetSchema,
  EasingFunctionSchema,
  NotificationTypeSchema,
  NotificationPositionSchema,
} from '@objectstack/spec/ui';
import {
  useAnimation,
  SUPPORTED_TRANSITION_PRESETS,
  SUPPORTED_EASING_FUNCTIONS,
} from '../useAnimation';
import { resolveOverlayWidth } from '../useNavigationOverlay';
import {
  SUPPORTED_NOTIFICATION_DISPLAY_TYPES,
  SUPPORTED_NOTIFICATION_POSITIONS,
} from '../../context/NotificationContext';

function options(schema: unknown): string[] {
  const raw = (schema as { options?: readonly string[] }).options;
  return Array.isArray(raw) ? [...raw] : [];
}

function assertParity(specNames: string[], implemented: ReadonlySet<string>, what: string) {
  expect(specNames, `could not read the ${what} enum from the spec`).not.toEqual([]);
  expect(
    specNames.filter((name) => !implemented.has(name)),
    `spec ${what} values with no implementation`,
  ).toEqual([]);
  expect(
    [...implemented].filter((name) => !specNames.includes(name)),
    `renderer-local ${what} dialect — promote into @objectstack/spec instead`,
  ).toEqual([]);
}

describe('react hooks cover the spec animation/notification vocabularies', () => {
  it('transition presets match TransitionPresetSchema both ways', () => {
    assertParity(options(TransitionPresetSchema), SUPPORTED_TRANSITION_PRESETS, 'transition preset');
  });

  it('easing functions match EasingFunctionSchema both ways', () => {
    assertParity(options(EasingFunctionSchema), SUPPORTED_EASING_FUNCTIONS, 'easing');
  });

  it('notification display types match NotificationTypeSchema both ways', () => {
    assertParity(options(NotificationTypeSchema), SUPPORTED_NOTIFICATION_DISPLAY_TYPES, 'notification display type');
  });

  it('notification positions match NotificationPositionSchema both ways', () => {
    assertParity(options(NotificationPositionSchema), SUPPORTED_NOTIFICATION_POSITIONS, 'notification position');
  });
});

describe('useAnimation renders every spec preset and easing', () => {
  it('every spec preset except none resolves to non-empty classes', () => {
    for (const preset of options(TransitionPresetSchema)) {
      const { result } = renderHook(() => useAnimation({ preset: preset as never }));
      if (preset === 'none') {
        expect(result.current.className).toBe('');
      } else {
        expect(result.current.className, `preset '${preset}' must animate`).not.toBe('');
      }
    }
  });

  it('every spec easing resolves to valid CSS (never the raw underscore token)', () => {
    for (const easing of options(EasingFunctionSchema)) {
      const { result } = renderHook(() => useAnimation({ preset: 'fade', easing: easing as never }));
      const value = result.current.style.animationTimingFunction;
      expect(value, `easing '${easing}' must map to CSS`).toBeTruthy();
      expect(String(value), `easing '${easing}' leaked an invalid raw token`).not.toContain('_');
    }
  });

  it('legacy hyphen spellings keep animating (stored-config compatibility)', () => {
    const { result } = renderHook(() =>
      useAnimation({ preset: 'slide-up' as never, easing: 'ease-in-out' as never }),
    );
    expect(result.current.className).toContain('slide-in-from-bottom');
    expect(result.current.style.animationTimingFunction).toBe('ease-in-out');
  });

  it('an out-of-vocabulary easing is dropped rather than emitted as invalid CSS', () => {
    const { result } = renderHook(() => useAnimation({ preset: 'fade', easing: 'bouncy_town' as never }));
    expect(result.current.style.animationTimingFunction).toBeUndefined();
  });

  it('raw CSS timing functions still pass through', () => {
    const { result } = renderHook(() =>
      useAnimation({ preset: 'fade', easing: 'cubic-bezier(0.1, 0.2, 0.3, 0.4)' as never }),
    );
    expect(result.current.style.animationTimingFunction).toBe('cubic-bezier(0.1, 0.2, 0.3, 0.4)');
  });
});

describe('useNavigationOverlay honors the spec size buckets', () => {
  it('every explicit bucket resolves to a viewport-clamped width', () => {
    for (const size of ['sm', 'md', 'lg', 'xl', 'full'] as const) {
      const width = resolveOverlayWidth({ mode: 'drawer', size });
      expect(width, `size '${size}' must resolve a width`).toMatch(/^min\(92vw, \d+px\)$/);
    }
  });

  it("an explicit width wins over the bucket; 'auto' stays host-derived", () => {
    expect(resolveOverlayWidth({ mode: 'drawer', size: 'xl', width: 500 })).toBe(500);
    expect(resolveOverlayWidth({ mode: 'drawer', size: 'auto' })).toBeUndefined();
    expect(resolveOverlayWidth({ mode: 'drawer' })).toBeUndefined();
  });
});
