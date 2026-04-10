/**
 * Tests for useFavorites hook (via FavoritesProvider context)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useFavorites } from '../hooks/useFavorites';
import { FavoritesProvider } from '../context/FavoritesProvider';

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

/** Wrapper that provides the FavoritesProvider for renderHook */
function wrapper({ children }: { children: ReactNode }) {
  return <FavoritesProvider>{children}</FavoritesProvider>;
}

describe('useFavorites', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('starts with empty favorites when localStorage is empty', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    expect(result.current.favorites).toEqual([]);
  });

  it('adds a favorite item', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    act(() => {
      result.current.addFavorite({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.favorites[0].id).toBe('object:contact');
    expect(result.current.favorites[0].label).toBe('Contacts');
    expect(result.current.favorites[0].favoritedAt).toBeDefined();
  });

  it('does not add duplicate favorites', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    act(() => {
      result.current.addFavorite({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    act(() => {
      result.current.addFavorite({
        id: 'object:contact',
        label: 'Contacts Again',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.favorites[0].label).toBe('Contacts');
  });

  it('removes a favorite', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    act(() => {
      result.current.addFavorite({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    act(() => {
      result.current.removeFavorite('object:contact');
    });

    expect(result.current.favorites).toEqual([]);
  });

  it('toggles a favorite on and off', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    const item = {
      id: 'dashboard:sales',
      label: 'Sales Dashboard',
      href: '/apps/crm/dashboard/sales',
      type: 'dashboard' as const,
    };

    // Toggle on
    act(() => {
      result.current.toggleFavorite(item);
    });
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.isFavorite('dashboard:sales')).toBe(true);

    // Toggle off
    act(() => {
      result.current.toggleFavorite(item);
    });
    expect(result.current.favorites).toHaveLength(0);
    expect(result.current.isFavorite('dashboard:sales')).toBe(false);
  });

  it('checks if an item is a favorite', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    expect(result.current.isFavorite('object:contact')).toBe(false);

    act(() => {
      result.current.addFavorite({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    expect(result.current.isFavorite('object:contact')).toBe(true);
    expect(result.current.isFavorite('object:other')).toBe(false);
  });

  it('limits to max 20 favorites', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    for (let i = 0; i < 25; i++) {
      act(() => {
        result.current.addFavorite({
          id: `object:item-${i}`,
          label: `Item ${i}`,
          href: `/apps/crm/item-${i}`,
          type: 'object',
        });
      });
    }

    expect(result.current.favorites.length).toBeLessThanOrEqual(20);
  });

  it('clears all favorites', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    act(() => {
      result.current.addFavorite({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    act(() => {
      result.current.clearFavorites();
    });

    expect(result.current.favorites).toEqual([]);
  });

  it('persists favorites to localStorage', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    act(() => {
      result.current.addFavorite({
        id: 'object:contact',
        label: 'Contacts',
        href: '/apps/crm/contact',
        type: 'object',
      });
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'objectui-favorites',
      expect.any(String),
    );
  });

  it('two hooks sharing the same provider see each other\'s mutations (cross-component reactivity)', () => {
    // Both hooks are called within the same render, sharing the same provider.
    // This simulates the real scenario where AppCard (consumer A) toggles a favorite
    // and HomePage (consumer B) should immediately see the updated state.
    const { result } = renderHook(
      () => ({ hookA: useFavorites(), hookB: useFavorites() }),
      { wrapper },
    );

    // Hook A adds a favorite
    act(() => {
      result.current.hookA.addFavorite({
        id: 'app:crm',
        label: 'CRM',
        href: '/apps/crm',
        type: 'object',
      });
    });

    // Hook B (simulating HomePage reading favorites) must see the update
    expect(result.current.hookB.favorites).toHaveLength(1);
    expect(result.current.hookB.isFavorite('app:crm')).toBe(true);

    // Hook B removes the favorite
    act(() => {
      result.current.hookB.removeFavorite('app:crm');
    });

    // Hook A must see the removal
    expect(result.current.hookA.favorites).toHaveLength(0);
    expect(result.current.hookA.isFavorite('app:crm')).toBe(false);
  });

  it('throws when used outside FavoritesProvider', () => {
    // Suppress the expected React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useFavorites())).toThrow(
      'useFavorites must be used within a FavoritesProvider',
    );
    spy.mockRestore();
  });
});
