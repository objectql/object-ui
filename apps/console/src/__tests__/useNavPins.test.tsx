import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavPins } from '../hooks/useNavPins';
import type { NavigationItem } from '@object-ui/types';

describe('useNavPins', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty pins', () => {
    const { result } = renderHook(() => useNavPins());
    expect(result.current.pinnedIds).toEqual([]);
  });

  it('pins a navigation item', () => {
    const { result } = renderHook(() => useNavPins());

    act(() => {
      result.current.togglePin('nav-accounts', true);
    });

    expect(result.current.pinnedIds).toContain('nav-accounts');
    expect(result.current.isPinned('nav-accounts')).toBe(true);
  });

  it('unpins a navigation item', () => {
    const { result } = renderHook(() => useNavPins());

    act(() => {
      result.current.togglePin('nav-accounts', true);
    });
    expect(result.current.isPinned('nav-accounts')).toBe(true);

    act(() => {
      result.current.togglePin('nav-accounts', false);
    });
    expect(result.current.isPinned('nav-accounts')).toBe(false);
    expect(result.current.pinnedIds).not.toContain('nav-accounts');
  });

  it('persists pins to localStorage', () => {
    const { result } = renderHook(() => useNavPins());

    act(() => {
      result.current.togglePin('nav-contacts', true);
    });

    const stored = JSON.parse(localStorage.getItem('objectui-nav-pins') || '[]');
    expect(stored).toContain('nav-contacts');
  });

  it('loads pins from localStorage on mount', () => {
    localStorage.setItem('objectui-nav-pins', JSON.stringify(['nav-accounts', 'nav-contacts']));

    const { result } = renderHook(() => useNavPins());
    expect(result.current.pinnedIds).toEqual(['nav-accounts', 'nav-contacts']);
    expect(result.current.isPinned('nav-accounts')).toBe(true);
    expect(result.current.isPinned('nav-contacts')).toBe(true);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('objectui-nav-pins', 'not-valid-json');

    const { result } = renderHook(() => useNavPins());
    expect(result.current.pinnedIds).toEqual([]);
  });

  it('handles non-array localStorage gracefully', () => {
    localStorage.setItem('objectui-nav-pins', JSON.stringify({ foo: 'bar' }));

    const { result } = renderHook(() => useNavPins());
    expect(result.current.pinnedIds).toEqual([]);
  });

  it('clears all pins', () => {
    const { result } = renderHook(() => useNavPins());

    act(() => {
      result.current.togglePin('nav-accounts', true);
      result.current.togglePin('nav-contacts', true);
    });
    expect(result.current.pinnedIds.length).toBe(2);

    act(() => {
      result.current.clearPins();
    });
    expect(result.current.pinnedIds).toEqual([]);
    expect(JSON.parse(localStorage.getItem('objectui-nav-pins') || '[]')).toEqual([]);
  });

  it('prevents duplicate pins', () => {
    const { result } = renderHook(() => useNavPins());

    act(() => {
      result.current.togglePin('nav-accounts', true);
    });
    act(() => {
      result.current.togglePin('nav-accounts', true);
    });

    // Should only appear once
    const count = result.current.pinnedIds.filter(id => id === 'nav-accounts').length;
    expect(count).toBe(1);
  });

  it('applies pin state to navigation items', () => {
    const { result } = renderHook(() => useNavPins());

    act(() => {
      result.current.togglePin('nav-accounts', true);
    });

    const items: NavigationItem[] = [
      { id: 'nav-accounts', label: 'Accounts', type: 'object', objectName: 'account' },
      { id: 'nav-contacts', label: 'Contacts', type: 'object', objectName: 'contact' },
    ];

    const pinned = result.current.applyPins(items);
    expect(pinned[0].pinned).toBe(true);
    expect(pinned[1].pinned).toBeFalsy();
  });

  it('applies pin state to nested navigation items', () => {
    const { result } = renderHook(() => useNavPins());

    act(() => {
      result.current.togglePin('nav-report-sales', true);
    });

    const items: NavigationItem[] = [
      {
        id: 'nav-group-reports',
        label: 'Reports',
        type: 'group',
        children: [
          { id: 'nav-report-sales', label: 'Sales Report', type: 'report', reportName: 'sales' },
          { id: 'nav-report-inv', label: 'Inventory Report', type: 'report', reportName: 'inventory' },
        ],
      },
    ];

    const pinned = result.current.applyPins(items);
    expect(pinned[0].children![0].pinned).toBe(true);
    expect(pinned[0].children![1].pinned).toBeFalsy();
  });
});
