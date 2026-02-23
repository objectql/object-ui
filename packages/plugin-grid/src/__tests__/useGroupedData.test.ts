/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGroupedData } from '../useGroupedData';

const sampleData = [
  { category: 'A', priority: 'High', amount: 10 },
  { category: 'A', priority: 'Low', amount: 20 },
  { category: 'B', priority: 'High', amount: 30 },
  { category: 'B', priority: 'Medium', amount: 40 },
  { category: 'C', priority: 'Low', amount: 50 },
];

describe('useGroupedData – collapsed state management', () => {
  it('returns isGrouped=false when config is undefined', () => {
    const { result } = renderHook(() => useGroupedData(undefined, sampleData));
    expect(result.current.isGrouped).toBe(false);
    expect(result.current.groups).toEqual([]);
  });

  it('returns isGrouped=false when config has empty fields', () => {
    const { result } = renderHook(() => useGroupedData({ fields: [] }, sampleData));
    expect(result.current.isGrouped).toBe(false);
    expect(result.current.groups).toEqual([]);
  });

  it('groups data correctly with single field', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    expect(result.current.isGrouped).toBe(true);
    expect(result.current.groups).toHaveLength(3);
    expect(result.current.groups[0].key).toBe('A');
    expect(result.current.groups[0].rows).toHaveLength(2);
    expect(result.current.groups[1].key).toBe('B');
    expect(result.current.groups[1].rows).toHaveLength(2);
    expect(result.current.groups[2].key).toBe('C');
    expect(result.current.groups[2].rows).toHaveLength(1);
  });

  it('all groups default to expanded when collapsed=false', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    result.current.groups.forEach((group) => {
      expect(group.collapsed).toBe(false);
    });
  });

  it('all groups default to collapsed when collapsed=true', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: true }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    result.current.groups.forEach((group) => {
      expect(group.collapsed).toBe(true);
    });
  });

  it('toggleGroup toggles a group from expanded to collapsed', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    // Initially all expanded
    expect(result.current.groups[0].collapsed).toBe(false);

    // Toggle group A
    act(() => {
      result.current.toggleGroup('A');
    });

    expect(result.current.groups[0].collapsed).toBe(true);
    // Other groups remain expanded
    expect(result.current.groups[1].collapsed).toBe(false);
    expect(result.current.groups[2].collapsed).toBe(false);
  });

  it('toggleGroup toggles a group from collapsed back to expanded', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    // Toggle twice: expand -> collapse -> expand
    act(() => {
      result.current.toggleGroup('A');
    });
    expect(result.current.groups[0].collapsed).toBe(true);

    act(() => {
      result.current.toggleGroup('A');
    });
    expect(result.current.groups[0].collapsed).toBe(false);
  });

  it('toggleGroup expands a group that defaults to collapsed', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: true }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    // Initially all collapsed
    expect(result.current.groups[0].collapsed).toBe(true);

    // Toggle group A to expand
    act(() => {
      result.current.toggleGroup('A');
    });

    expect(result.current.groups[0].collapsed).toBe(false);
    // Other groups remain collapsed
    expect(result.current.groups[1].collapsed).toBe(true);
  });

  it('sorts groups in descending order when configured', () => {
    const config = { fields: [{ field: 'category', order: 'desc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    expect(result.current.groups[0].key).toBe('C');
    expect(result.current.groups[1].key).toBe('B');
    expect(result.current.groups[2].key).toBe('A');
  });

  it('builds correct labels for groups', () => {
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    expect(result.current.groups[0].label).toBe('A');
    expect(result.current.groups[1].label).toBe('B');
    expect(result.current.groups[2].label).toBe('C');
  });

  it('shows (empty) label for rows with missing grouping field', () => {
    const data = [
      { category: 'A', amount: 10 },
      { amount: 20 }, // no category
      { category: '', amount: 30 }, // empty category
    ];
    const config = { fields: [{ field: 'category', order: 'asc' as const, collapsed: false }] };
    const { result } = renderHook(() => useGroupedData(config, data));

    const emptyGroup = result.current.groups.find((g) => g.label === '(empty)');
    expect(emptyGroup).toBeDefined();
    expect(emptyGroup!.rows).toHaveLength(2);
  });

  it('supports multi-field grouping', () => {
    const config = {
      fields: [
        { field: 'category', order: 'asc' as const, collapsed: false },
        { field: 'priority', order: 'asc' as const, collapsed: false },
      ],
    };
    const { result } = renderHook(() => useGroupedData(config, sampleData));

    expect(result.current.isGrouped).toBe(true);
    // Each unique combination of category + priority should be a group
    expect(result.current.groups.length).toBeGreaterThanOrEqual(4);
    // Check label format is "A / High"
    const firstGroup = result.current.groups[0];
    expect(firstGroup.label).toContain(' / ');
  });
});
