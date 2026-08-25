/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import type { RowColorConfig } from '@object-ui/types';

/**
 * CSS color to Tailwind-compatible background class mapping.
 * For colors not in this map, a CSS custom property approach is used.
 */
const COLOR_TO_CLASS: Record<string, string> = {
  red: 'bg-red-100',
  green: 'bg-green-100',
  blue: 'bg-blue-100',
  yellow: 'bg-yellow-100',
  orange: 'bg-orange-100',
  purple: 'bg-purple-100',
  pink: 'bg-pink-100',
  gray: 'bg-gray-100',
  grey: 'bg-gray-100',
  indigo: 'bg-indigo-100',
  teal: 'bg-teal-100',
  cyan: 'bg-cyan-100',
  amber: 'bg-amber-100',
  lime: 'bg-lime-100',
  emerald: 'bg-emerald-100',
  rose: 'bg-rose-100',
  sky: 'bg-sky-100',
  violet: 'bg-violet-100',
  fuchsia: 'bg-fuchsia-100',
  slate: 'bg-slate-100',
  zinc: 'bg-zinc-100',
  stone: 'bg-stone-100',
  neutral: 'bg-neutral-100',
};

/**
 * Maps a CSS color string to a Tailwind background class.
 * Falls back to undefined for unrecognised values (dynamic CSS colors
 * that cannot be represented as static Tailwind classes).
 */
function colorToClass(color: string): string | undefined {
  // Direct Tailwind class (e.g. "bg-red-200")
  if (color.startsWith('bg-')) return color;

  const lower = color.toLowerCase().trim();
  // `hasOwnProperty` rather than a bare index (objectui#6295, the quiet half):
  // this object literal inherits `constructor`, `toString` and friends, so an
  // authored colour value naming one of them used to hand the inherited member
  // back as the row's className. That never threw — it reached React as a class
  // attribute. (`Object.hasOwn` is ES2022; this workspace compiles against the
  // ES2020 lib.)
  return Object.prototype.hasOwnProperty.call(COLOR_TO_CLASS, lower)
    ? COLOR_TO_CLASS[lower]
    : undefined;
}

/**
 * Hook that returns a row-className resolver based on RowColorConfig.
 *
 * @param config  - RowColorConfig from the grid schema (optional)
 * @returns a function `(row) => className | undefined`
 */
export function useRowColor(config: RowColorConfig | undefined) {
  return useCallback(
    (row: Record<string, any>): string | undefined => {
      if (!config?.field || !config.colors) return undefined;

      const value = String(row[config.field] ?? '');
      // The same guard one call out, and this read is reached with RECORD DATA
      // (objectui#6295, the loud half): the authored map inherits
      // `Object.prototype`, so a record whose colour field holds `constructor` /
      // `toString` / `valueOf` / `hasOwnProperty` resolved to an inherited
      // FUNCTION. `if (!color)` below passes it (functions are truthy) and
      // `colorToClass` then called `.startsWith` on it — a TypeError thrown
      // inside the row-className resolver during render, crashing the grid on
      // data rather than on metadata.
      const color = Object.prototype.hasOwnProperty.call(config.colors, value)
        ? config.colors[value]
        : undefined;
      if (!color) return undefined;

      return colorToClass(color);
    },
    [config?.field, config?.colors],
  );
}
