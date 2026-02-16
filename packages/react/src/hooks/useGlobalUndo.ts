/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { globalUndoManager, type UndoableOperation } from '@object-ui/core';

export interface UseGlobalUndoOptions {
  /** DataSource to execute undo/redo operations. */
  dataSource?: {
    create(objectName: string, data: Record<string, unknown>): Promise<unknown>;
    update(objectName: string, recordId: string, data: Record<string, unknown>): Promise<unknown>;
    delete(objectName: string, recordId: string): Promise<unknown>;
  };
  /** Callback after successful undo. */
  onUndo?: (op: UndoableOperation) => void;
  /** Callback after successful redo. */
  onRedo?: (op: UndoableOperation) => void;
}

function getSnapshot() {
  return {
    canUndo: globalUndoManager.canUndo,
    canRedo: globalUndoManager.canRedo,
    undoDescription: globalUndoManager.peekUndo()?.description,
    redoDescription: globalUndoManager.peekRedo()?.description,
    history: globalUndoManager.getHistory(),
  };
}

function getServerSnapshot() {
  return { canUndo: false, canRedo: false, undoDescription: undefined, redoDescription: undefined, history: [] as UndoableOperation[] };
}

// Cache reference to avoid re-renders when nothing changed
let cachedSnapshot = getSnapshot();
function subscribe(callback: () => void) {
  return globalUndoManager.subscribe(() => {
    cachedSnapshot = getSnapshot();
    callback();
  });
}
function getCachedSnapshot() { return cachedSnapshot; }

/**
 * React hook that wraps the global UndoManager for use in console components.
 *
 * Provides reactive undo/redo state, executes data operations through the
 * supplied dataSource, and registers Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts.
 */
export function useGlobalUndo(options: UseGlobalUndoOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const state = useSyncExternalStore(subscribe, getCachedSnapshot, getServerSnapshot);

  const executeOp = useCallback(async (op: UndoableOperation, data: Record<string, unknown>, mode: 'undo' | 'redo') => {
    const ds = optionsRef.current.dataSource;
    if (!ds) return;
    const action = mode === 'undo'
      ? ({ create: 'delete', update: 'update', delete: 'create' } as const)[op.type]
      : op.type;
    if (action === 'delete') await ds.delete(op.objectName, op.recordId);
    else if (action === 'update') await ds.update(op.objectName, op.recordId, data);
    else await ds.create(op.objectName, data);
  }, []);

  const undo = useCallback(async () => {
    const op = globalUndoManager.popUndo();
    if (!op) return;
    await executeOp(op, op.undoData, 'undo');
    optionsRef.current.onUndo?.(op);
  }, [executeOp]);

  const redo = useCallback(async () => {
    const op = globalUndoManager.popRedo();
    if (!op) return;
    await executeOp(op, op.redoData, 'redo');
    optionsRef.current.onRedo?.(op);
  }, [executeOp]);

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) { void redo(); } else { void undo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return useMemo(() => ({ ...state, undo, redo }), [state, undo, redo]);
}
