/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigDraft } from '../hooks/use-config-draft';

describe('useConfigDraft', () => {
  const source = { name: 'Test', columns: 3, gap: 4, enabled: true };

  it('should initialize draft from source', () => {
    const { result } = renderHook(() => useConfigDraft(source));
    expect(result.current.draft).toEqual(source);
    expect(result.current.isDirty).toBe(false);
  });

  it('should start dirty in create mode', () => {
    const { result } = renderHook(() =>
      useConfigDraft(source, { mode: 'create' }),
    );
    expect(result.current.isDirty).toBe(true);
  });

  it('should start clean in edit mode', () => {
    const { result } = renderHook(() =>
      useConfigDraft(source, { mode: 'edit' }),
    );
    expect(result.current.isDirty).toBe(false);
  });

  it('should update a single field and mark dirty', () => {
    const { result } = renderHook(() => useConfigDraft(source));
    act(() => {
      result.current.updateField('columns', 6);
    });
    expect(result.current.draft.columns).toBe(6);
    expect(result.current.isDirty).toBe(true);
  });

  it('should preserve other fields when updating one', () => {
    const { result } = renderHook(() => useConfigDraft(source));
    act(() => {
      result.current.updateField('gap', 8);
    });
    expect(result.current.draft.name).toBe('Test');
    expect(result.current.draft.columns).toBe(3);
    expect(result.current.draft.gap).toBe(8);
  });

  it('should discard changes and revert to source', () => {
    const { result } = renderHook(() => useConfigDraft(source));
    act(() => {
      result.current.updateField('name', 'Modified');
      result.current.updateField('columns', 12);
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.discard();
    });
    expect(result.current.draft).toEqual(source);
    expect(result.current.isDirty).toBe(false);
  });

  it('should call onUpdate callback when field changes', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useConfigDraft(source, { onUpdate }),
    );
    act(() => {
      result.current.updateField('gap', 10);
    });
    expect(onUpdate).toHaveBeenCalledWith('gap', 10);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('should reset draft when source changes', () => {
    const source1 = { name: 'A', value: 1 };
    const source2 = { name: 'B', value: 2 };

    const { result, rerender } = renderHook(
      ({ src }) => useConfigDraft(src),
      { initialProps: { src: source1 } },
    );

    act(() => {
      result.current.updateField('name', 'Modified');
    });
    expect(result.current.isDirty).toBe(true);

    rerender({ src: source2 });
    expect(result.current.draft).toEqual(source2);
    expect(result.current.isDirty).toBe(false);
  });

  it('should handle setDraft for advanced use cases', () => {
    const { result } = renderHook(() => useConfigDraft(source));
    act(() => {
      result.current.setDraft({ ...source, name: 'Advanced', extra: 42 });
    });
    expect(result.current.draft.name).toBe('Advanced');
    expect(result.current.draft.extra).toBe(42);
  });

  it('should not share reference with source', () => {
    const mutableSource = { name: 'Original' };
    const { result } = renderHook(() => useConfigDraft(mutableSource));
    expect(result.current.draft).not.toBe(mutableSource);
    expect(result.current.draft).toEqual(mutableSource);
  });

  // ── Undo / Redo ──────────────────────────────────────────────

  describe('undo/redo', () => {
    it('should start with canUndo=false and canRedo=false', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should enable undo after a field update', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      act(() => {
        result.current.updateField('name', 'Changed');
      });
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('should undo to previous state', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      act(() => {
        result.current.updateField('name', 'Changed');
      });
      expect(result.current.draft.name).toBe('Changed');

      act(() => {
        result.current.undo();
      });
      expect(result.current.draft.name).toBe('Test');
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it('should redo after undo', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      act(() => {
        result.current.updateField('name', 'Changed');
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.redo();
      });
      expect(result.current.draft.name).toBe('Changed');
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('should clear redo stack when a new change is made after undo', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      act(() => {
        result.current.updateField('name', 'First');
      });
      act(() => {
        result.current.updateField('name', 'Second');
      });
      act(() => {
        result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.updateField('name', 'Third');
      });
      expect(result.current.canRedo).toBe(false);
      expect(result.current.draft.name).toBe('Third');
    });

    it('should support multiple undo steps', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      act(() => {
        result.current.updateField('name', 'A');
      });
      act(() => {
        result.current.updateField('name', 'B');
      });
      act(() => {
        result.current.updateField('name', 'C');
      });
      expect(result.current.draft.name).toBe('C');

      act(() => {
        result.current.undo();
      });
      expect(result.current.draft.name).toBe('B');

      act(() => {
        result.current.undo();
      });
      expect(result.current.draft.name).toBe('A');

      act(() => {
        result.current.undo();
      });
      expect(result.current.draft.name).toBe('Test');
      expect(result.current.canUndo).toBe(false);
    });

    it('should do nothing when undoing with empty history', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      act(() => {
        result.current.undo();
      });
      expect(result.current.draft).toEqual(source);
    });

    it('should do nothing when redoing with empty future', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      act(() => {
        result.current.redo();
      });
      expect(result.current.draft).toEqual(source);
    });

    it('should clear history on discard', () => {
      const { result } = renderHook(() => useConfigDraft(source));
      act(() => {
        result.current.updateField('name', 'Changed');
      });
      expect(result.current.canUndo).toBe(true);

      act(() => {
        result.current.discard();
      });
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should clear history when source changes', () => {
      const source1 = { name: 'A', value: 1 };
      const source2 = { name: 'B', value: 2 };
      const { result, rerender } = renderHook(
        ({ src }) => useConfigDraft(src),
        { initialProps: { src: source1 } },
      );
      act(() => {
        result.current.updateField('name', 'Modified');
      });
      expect(result.current.canUndo).toBe(true);

      rerender({ src: source2 });
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should respect maxHistory limit', () => {
      const { result } = renderHook(() =>
        useConfigDraft(source, { maxHistory: 3 }),
      );
      act(() => {
        result.current.updateField('name', 'A');
      });
      act(() => {
        result.current.updateField('name', 'B');
      });
      act(() => {
        result.current.updateField('name', 'C');
      });
      act(() => {
        result.current.updateField('name', 'D');
      });
      // maxHistory=3, so only 3 undo steps (not 4)
      act(() => {
        result.current.undo();
      });
      expect(result.current.draft.name).toBe('C');
      act(() => {
        result.current.undo();
      });
      expect(result.current.draft.name).toBe('B');
      act(() => {
        result.current.undo();
      });
      // Should stop here — oldest entry was trimmed
      expect(result.current.canUndo).toBe(false);
    });
  });
});
