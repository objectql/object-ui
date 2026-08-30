/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
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
  // Refreshed in the MUTATION phase, never in the render body. Every caller
  // passes an inline object literal with inline `onUndo` / `onRedo` closures,
  // so `options` is a new object on every render and the ref is what lets
  // `undo` / `redo` keep a stable identity (the keydown effect below is keyed
  // on them) while still reaching the newest callbacks. Writing it during
  // render published the options of renders React discards or replays.
  // `useInsertionEffect` runs ahead of every layout effect, ref attachment and
  // paint in the commit, so the only window this moves is the render phase
  // itself — where `undo` / `redo`, being async data mutations, are not
  // callable. `useEffectEvent` would be idiomatic but is React 19.2+, and this
  // package's peer range starts at React 18.
  useInsertionEffect(() => {
    optionsRef.current = options;
  });

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
