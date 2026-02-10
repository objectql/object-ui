/**
 * Tests for useRecentItems hook
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentItems } from '../hooks/useRecentItems';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useRecentItems', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('starts with empty items when localStorage is empty', () => {
    const { result } = renderHook(() => useRecentItems());
    expect(result.current.recentItems).toEqual([]);
  });

  it('adds a recent item', () => {
    const { result } = renderHook(() => useRecentItems());

    act(() => {
      result.current.addRecentItem({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    expect(result.current.recentItems).toHaveLength(1);
    expect(result.current.recentItems[0].id).toBe('object:contact');
    expect(result.current.recentItems[0].label).toBe('Contacts');
    expect(result.current.recentItems[0].visitedAt).toBeDefined();
  });

  it('deduplicates items by id', () => {
    const { result } = renderHook(() => useRecentItems());

    act(() => {
      result.current.addRecentItem({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    act(() => {
      result.current.addRecentItem({
        id: 'object:contact',
        label: 'Contacts Updated',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    expect(result.current.recentItems).toHaveLength(1);
    expect(result.current.recentItems[0].label).toBe('Contacts Updated');
  });

  it('limits to max 8 items', () => {
    const { result } = renderHook(() => useRecentItems());

    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.addRecentItem({
          id: `object:item-${i}`,
          label: `Item ${i}`,
          href: `/apps/crm/item-${i}`,
          type: 'object',
        });
      });
    }

    expect(result.current.recentItems.length).toBeLessThanOrEqual(8);
  });

  it('clears all items', () => {
    const { result } = renderHook(() => useRecentItems());

    act(() => {
      result.current.addRecentItem({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    act(() => {
      result.current.clearRecentItems();
    });

    expect(result.current.recentItems).toEqual([]);
  });

  it('persists items to localStorage', () => {
    const { result } = renderHook(() => useRecentItems());

    act(() => {
      result.current.addRecentItem({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'objectui-recent-items',
      expect.any(String),
    );
  });
});
