/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo } from 'react';

/** Density mode aligned with DensityMode from @objectstack/spec v2.0.7 */
export type DensityModeValue = 'compact' | 'comfortable' | 'spacious';

export interface DensityConfig {
  /** Row height in pixels for each density mode */
  rowHeights?: Record<DensityModeValue, number>;
  /** Padding classes for each density mode */
  paddingClasses?: Record<DensityModeValue, string>;
  /** Font size classes for each density mode */
  fontSizeClasses?: Record<DensityModeValue, string>;
}

export interface DensityResult {
  /** Current density mode */
  mode: DensityModeValue;
  /** Set the density mode */
  setMode: (mode: DensityModeValue) => void;
  /** Cycle through density modes */
  cycle: () => void;
  /** Row height for the current mode (in pixels) */
  rowHeight: number;
  /** Tailwind padding class for the current mode */
  paddingClass: string;
  /** Tailwind font-size class for the current mode */
  fontSizeClass: string;
}

const DEFAULT_ROW_HEIGHTS: Record<DensityModeValue, number> = {
  compact: 32,
  comfortable: 40,
  spacious: 52,
};

const DEFAULT_PADDING_CLASSES: Record<DensityModeValue, string> = {
  compact: 'py-1 px-2',
  comfortable: 'py-2 px-3',
  spacious: 'py-3 px-4',
};

const DEFAULT_FONT_SIZE_CLASSES: Record<DensityModeValue, string> = {
  compact: 'text-xs',
  comfortable: 'text-sm',
  spacious: 'text-base',
};

const DENSITY_ORDER: DensityModeValue[] = ['compact', 'comfortable', 'spacious'];

/**
 * Hook for managing view density modes (compact/comfortable/spacious).
 * Implements DensityMode from @objectstack/spec v2.0.7.
 *
 * @example
 * ```tsx
 * const density = useDensityMode('comfortable');
 *
 * return (
 *   <div className={density.paddingClass}>
 *     <table style={{ rowHeight: density.rowHeight }}>...</table>
 *     <button onClick={density.cycle}>Toggle Density</button>
 *   </div>
 * );
 * ```
 */
export function useDensityMode(
  initialMode: DensityModeValue = 'comfortable',
  config?: DensityConfig
): DensityResult {
  const [mode, setMode] = useState<DensityModeValue>(initialMode);

  const rowHeights = config?.rowHeights ?? DEFAULT_ROW_HEIGHTS;
  const paddingClasses = config?.paddingClasses ?? DEFAULT_PADDING_CLASSES;
  const fontSizeClasses = config?.fontSizeClasses ?? DEFAULT_FONT_SIZE_CLASSES;

  const cycle = useCallback(() => {
    setMode((current) => {
      const idx = DENSITY_ORDER.indexOf(current);
      return DENSITY_ORDER[(idx + 1) % DENSITY_ORDER.length];
    });
  }, []);

  return useMemo(
    () => ({
      mode,
      setMode,
      cycle,
      rowHeight: rowHeights[mode],
      paddingClass: paddingClasses[mode],
      fontSizeClass: fontSizeClasses[mode],
    }),
    [mode, cycle, rowHeights, paddingClasses, fontSizeClasses]
  );
}
