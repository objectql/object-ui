/**
 * Tests for useConflictResolution hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConflictResolution } from '../useConflictResolution';

describe('useConflictResolution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state with empty versions and no conflicts', () => {
    const { result } = renderHook(() => useConflictResolution('user-1', 'Alice'));

    expect(result.current.versions).toEqual([]);
    expect(result.current.currentVersion).toBe(0);
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.hasConflicts).toBe(false);
  });

  it('recordVersion adds a version entry', () => {
    const { result } = renderHook(() => useConflictResolution('user-1', 'Alice'));

    act(() => {
      result.current.recordVersion({ name: { before: 'Old', after: 'New' } }, 'Updated name');
    });

    expect(result.current.versions).toHaveLength(1);
    expect(result.current.versions[0].version).toBe(1);
    expect(result.current.versions[0].userId).toBe('user-1');
    expect(result.current.versions[0].userName).toBe('Alice');
    expect(result.current.versions[0].changes.name).toEqual({ before: 'Old', after: 'New' });
    expect(result.current.versions[0].message).toBe('Updated name');
    expect(result.current.currentVersion).toBe(1);
  });

  it('addConflict adds a conflict and sets hasConflicts to true', () => {
    const { result } = renderHook(() => useConflictResolution('user-1', 'Alice'));

    act(() => {
      result.current.addConflict({
        field: 'title',
        localValue: 'Local Title',
        remoteValue: 'Remote Title',
        baseValue: 'Base Title',
        localTimestamp: new Date().toISOString(),
        remoteTimestamp: new Date().toISOString(),
        remoteUserId: 'user-2',
      });
    });

    expect(result.current.conflicts).toHaveLength(1);
    expect(result.current.hasConflicts).toBe(true);
    expect(result.current.conflicts[0].field).toBe('title');
    expect(result.current.conflicts[0].id).toContain('conflict-');
  });

  it('resolveConflict removes the conflict from the list', () => {
    const { result } = renderHook(() => useConflictResolution('user-1', 'Alice'));

    act(() => {
      result.current.addConflict({
        field: 'title',
        localValue: 'Local',
        remoteValue: 'Remote',
        baseValue: 'Base',
        localTimestamp: new Date().toISOString(),
        remoteTimestamp: new Date().toISOString(),
        remoteUserId: 'user-2',
      });
    });

    const conflictId = result.current.conflicts[0].id;

    act(() => {
      result.current.resolveConflict(conflictId, 'local');
    });

    expect(result.current.conflicts).toHaveLength(0);
    expect(result.current.hasConflicts).toBe(false);
  });

  it('resolveAllConflicts clears all conflicts', () => {
    const { result } = renderHook(() => useConflictResolution('user-1', 'Alice'));

    act(() => {
      result.current.addConflict({
        field: 'title',
        localValue: 'L1',
        remoteValue: 'R1',
        baseValue: 'B1',
        localTimestamp: new Date().toISOString(),
        remoteTimestamp: new Date().toISOString(),
        remoteUserId: 'user-2',
      });
    });
    act(() => {
      result.current.addConflict({
        field: 'status',
        localValue: 'active',
        remoteValue: 'inactive',
        baseValue: 'active',
        localTimestamp: new Date().toISOString(),
        remoteTimestamp: new Date().toISOString(),
        remoteUserId: 'user-3',
      });
    });

    expect(result.current.conflicts).toHaveLength(2);

    act(() => {
      result.current.resolveAllConflicts('local');
    });

    expect(result.current.conflicts).toHaveLength(0);
    expect(result.current.hasConflicts).toBe(false);
  });

  it('revertToVersion returns the correct state snapshot', () => {
    const { result } = renderHook(() => useConflictResolution('user-1', 'Alice'));

    act(() => {
      result.current.recordVersion({ name: { before: undefined, after: 'Alice' } });
    });
    act(() => {
      result.current.recordVersion({ name: { before: 'Alice', after: 'Bob' } });
    });

    const firstVersionId = result.current.versions[0].id;

    let state: Record<string, unknown> | null = null;
    act(() => {
      state = result.current.revertToVersion(firstVersionId);
    });

    expect(state).toEqual({ name: 'Alice' });
  });

  it('compareVersions returns diff between two versions', () => {
    const { result } = renderHook(() => useConflictResolution('user-1', 'Alice'));

    act(() => {
      result.current.recordVersion({ name: { before: undefined, after: 'Alice' } });
    });
    act(() => {
      result.current.recordVersion({ name: { before: 'Alice', after: 'Bob' } });
    });

    const versionA = result.current.versions[0].id;
    const versionB = result.current.versions[1].id;

    let diff: Record<string, { before: unknown; after: unknown }> | null = null;
    act(() => {
      diff = result.current.compareVersions(versionA, versionB);
    });

    expect(diff).toEqual({ name: { before: 'Alice', after: 'Bob' } });
  });

  it('clearHistory removes all version entries', () => {
    const { result } = renderHook(() => useConflictResolution('user-1', 'Alice'));

    act(() => {
      result.current.recordVersion({ name: { before: undefined, after: 'Alice' } });
    });
    act(() => {
      result.current.addConflict({
        field: 'title',
        localValue: 'L',
        remoteValue: 'R',
        baseValue: 'B',
        localTimestamp: new Date().toISOString(),
        remoteTimestamp: new Date().toISOString(),
        remoteUserId: 'user-2',
      });
    });

    expect(result.current.versions).toHaveLength(1);
    expect(result.current.conflicts).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.versions).toHaveLength(0);
    expect(result.current.conflicts).toHaveLength(0);
    expect(result.current.currentVersion).toBe(0);
  });
});
