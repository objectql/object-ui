/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo } from "react"
import type { KanbanColumn, ColumnWidthConfig } from "./types"

const STORAGE_KEY = "objectui:kanban-column-widths"

export interface UseColumnWidthsOptions {
  /** Columns on the board */
  columns: KanbanColumn[]
  /** Default width in pixels applied to every column */
  defaultWidth?: number
  /** Minimum allowed column width in pixels */
  minWidth?: number
  /** Maximum allowed column width in pixels */
  maxWidth?: number
  /** Optional persistence key suffix (to scope per-board) */
  storageKey?: string
}

export interface UseColumnWidthsReturn {
  /** Get the current width for a column (in px) */
  getColumnWidth: (columnId: string) => number
  /** Set an override width for a column */
  setColumnWidth: (columnId: string, width: number) => void
  /** Reset all overrides back to default widths */
  resetWidths: () => void
  /** The full config (useful for serialization) */
  config: ColumnWidthConfig
}

function loadPersistedWidths(key: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, number>
      }
    }
  } catch {
    /* ignore corrupt data */
  }
  return {}
}

function persistWidths(key: string, overrides: Record<string, number>) {
  try {
    localStorage.setItem(key, JSON.stringify(overrides))
  } catch {
    /* quota exceeded */
  }
}

/**
 * Hook for managing custom per-column widths with localStorage persistence.
 * Supports per-column overrides clamped between minWidth and maxWidth.
 */
export function useColumnWidths({
  columns: _columns,
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 600,
  storageKey,
}: UseColumnWidthsOptions): UseColumnWidthsReturn {
  const fullKey = storageKey ? `${STORAGE_KEY}:${storageKey}` : STORAGE_KEY

  const [overrides, setOverrides] = useState<Record<string, number>>(() =>
    loadPersistedWidths(fullKey),
  )

  const clamp = useCallback(
    (value: number) => Math.max(minWidth, Math.min(maxWidth, value)),
    [minWidth, maxWidth],
  )

  const getColumnWidth = useCallback(
    (columnId: string): number => {
      const override = overrides[columnId]
      return override != null ? clamp(override) : defaultWidth
    },
    [overrides, defaultWidth, clamp],
  )

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      const clamped = clamp(width)
      setOverrides(prev => {
        const next = { ...prev, [columnId]: clamped }
        persistWidths(fullKey, next)
        return next
      })
    },
    [clamp, fullKey],
  )

  const resetWidths = useCallback(() => {
    setOverrides({})
    try {
      localStorage.removeItem(fullKey)
    } catch {
      /* ignore */
    }
  }, [fullKey])

  const config: ColumnWidthConfig = useMemo(
    () => ({
      defaultWidth,
      minWidth,
      maxWidth,
      overrides: { ...overrides },
    }),
    [defaultWidth, minWidth, maxWidth, overrides],
  )

  return { getColumnWidth, setColumnWidth, resetWidths, config }
}

export default useColumnWidths
