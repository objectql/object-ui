/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockUser = { current: { id: 'user-1', name: 'Alice', email: 'a@x' } as any | null };
vi.mock('@object-ui/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuth: () => ({ user: mockUser.current, isAuthenticated: !!mockUser.current, isLoading: false }),
}));

import {
  RecentItemsProvider,
  useRecentItems,
  type RecentItem,
} from '../RecentItemsProvider';
import {
  UserStateAdaptersProvider,
  useAttachUserStateAdapters,
  type UserDataAdapter,
} from '../UserStateAdapters';

function makeAdapter(initial: RecentItem[] = []) {
  const loadMock = vi.fn().mockResolvedValue(initial);
  const saveMock = vi.fn().mockResolvedValue(undefined);
  return { load: loadMock, save: saveMock, loadMock, saveMock } as UserDataAdapter<RecentItem> & {
    loadMock: ReturnType<typeof vi.fn>;
    saveMock: ReturnType<typeof vi.fn>;
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <UserStateAdaptersProvider>
      <RecentItemsProvider>{children}</RecentItemsProvider>
    </UserStateAdaptersProvider>
  );
}

function useHarness() {
  const attach = useAttachUserStateAdapters();
  const recent = useRecentItems();
  return { attach, recent };
}

describe('RecentItemsProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser.current = { id: 'user-1', name: 'Alice', email: 'a@x' } as any;
  });

  it('hydrates synchronously from user-scoped localStorage on mount', () => {
    const seeded: RecentItem[] = [
      { id: 'object:c', label: 'C', href: '/c', type: 'object', visitedAt: '2024-01-01' },
    ];
    localStorage.setItem('objectui-recent-items:u:user-1', JSON.stringify(seeded));

    const { result } = renderHook(() => useRecentItems(), { wrapper });
    expect(result.current.recentItems).toEqual(seeded);
  });

  it('addRecentItem prepends and updates timestamp on revisit', () => {
    const { result } = renderHook(() => useRecentItems(), { wrapper });

    act(() => result.current.addRecentItem({ id: 'a', label: 'A', href: '/a', type: 'object' }));
    act(() => result.current.addRecentItem({ id: 'b', label: 'B', href: '/b', type: 'object' }));
    act(() => result.current.addRecentItem({ id: 'a', label: 'A', href: '/a', type: 'object' }));

    // 'a' moves back to the front; no duplicate.
    expect(result.current.recentItems.map(r => r.id)).toEqual(['a', 'b']);
  });

  it('caps recent items at 8', () => {
    const { result } = renderHook(() => useRecentItems(), { wrapper });

    act(() => {
      for (let i = 0; i < 12; i++) {
        result.current.addRecentItem({
          id: `r-${i}`,
          label: `R ${i}`,
          href: `/r/${i}`,
          type: 'object',
        });
      }
    });

    expect(result.current.recentItems).toHaveLength(8);
    // Most recent first.
    expect(result.current.recentItems[0].id).toBe('r-11');
  });

  it('persists to user-scoped localStorage only', () => {
    const { result } = renderHook(() => useRecentItems(), { wrapper });

    act(() =>
      result.current.addRecentItem({ id: 'x', label: 'X', href: '/x', type: 'page' }),
    );

    expect(localStorage.getItem('objectui-recent-items')).toBeNull();
    const stored = JSON.parse(localStorage.getItem('objectui-recent-items:u:user-1') || '[]');
    expect(stored[0]).toMatchObject({ id: 'x', type: 'page' });
  });

  it('hydrates from adapter and overrides localStorage state', async () => {
    localStorage.setItem(
      'objectui-recent-items:u:user-1',
      JSON.stringify([{ id: 'local', label: 'L', href: '/l', type: 'object', visitedAt: 't' }]),
    );
    const remote: RecentItem[] = [
      { id: 'remote', label: 'R', href: '/r', type: 'dashboard', visitedAt: 't' },
    ];
    const adapter = makeAdapter(remote);

    const { result } = renderHook(() => useHarness(), { wrapper });
    expect(result.current.recent.recentItems.map(r => r.id)).toEqual(['local']);

    act(() => result.current.attach('recent', adapter));

    await waitFor(() => {
      expect(result.current.recent.recentItems.map(r => r.id)).toEqual(['remote']);
    });
    expect(JSON.parse(localStorage.getItem('objectui-recent-items:u:user-1') || '[]')).toEqual(remote);
  });

  it('debounces adapter.save() across a burst of additions', async () => {
    const adapter = makeAdapter([]);
    const { result } = renderHook(() => useHarness(), { wrapper });

    act(() => result.current.attach('recent', adapter));
    await waitFor(() => expect(adapter.loadMock).toHaveBeenCalled());
    adapter.saveMock.mockClear();

    act(() => {
      result.current.recent.addRecentItem({ id: '1', label: '1', href: '/1', type: 'object' });
      result.current.recent.addRecentItem({ id: '2', label: '2', href: '/2', type: 'object' });
      result.current.recent.addRecentItem({ id: '3', label: '3', href: '/3', type: 'object' });
    });

    expect(adapter.saveMock).not.toHaveBeenCalled();
    await waitFor(() => expect(adapter.saveMock).toHaveBeenCalledTimes(1), { timeout: 1500 });

    const persisted = adapter.saveMock.mock.calls[0][0] as RecentItem[];
    expect(persisted.map(p => p.id).sort()).toEqual(['1', '2', '3']);
  });

  it('clearRecentItems empties the list and persists []', () => {
    const { result } = renderHook(() => useRecentItems(), { wrapper });

    act(() => result.current.addRecentItem({ id: 'a', label: 'A', href: '/a', type: 'object' }));
    act(() => result.current.clearRecentItems());

    expect(result.current.recentItems).toEqual([]);
    expect(localStorage.getItem('objectui-recent-items:u:user-1')).toBe('[]');
  });

  it('returns a no-op when used outside a provider', () => {
    const { result } = renderHook(() => useRecentItems());
    expect(result.current.recentItems).toEqual([]);
    expect(() =>
      result.current.addRecentItem({ id: 'x', label: 'X', href: '/x', type: 'object' }),
    ).not.toThrow();
  });
});
