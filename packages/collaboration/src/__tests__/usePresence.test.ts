/**
 * Tests for usePresence hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePresence } from '../usePresence';

describe('usePresence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const defaultConfig = {
    user: { id: 'user-1', name: 'Alice' },
  };

  it('returns initial presence state with current user', () => {
    const sendPresence = vi.fn();
    const { result } = renderHook(() => usePresence(sendPresence, defaultConfig));

    expect(result.current.users).toEqual([]);
    expect(result.current.currentUser).toBeDefined();
    expect(result.current.currentUser.userId).toBe('user-1');
    expect(result.current.currentUser.userName).toBe('Alice');
  });

  it('currentUser has correct initial values', () => {
    const sendPresence = vi.fn();
    const { result } = renderHook(() => usePresence(sendPresence, defaultConfig));

    expect(result.current.currentUser.userId).toBe('user-1');
    expect(result.current.currentUser.userName).toBe('Alice');
    expect(result.current.currentUser.status).toBe('active');
    expect(result.current.currentUser.color).toBeTypeOf('string');
    expect(result.current.currentUser.lastActivity).toBeTypeOf('string');
  });

  it('userCount starts at 1 (current user only)', () => {
    const sendPresence = vi.fn();
    const { result } = renderHook(() => usePresence(sendPresence, defaultConfig));

    expect(result.current.userCount).toBe(1);
  });
});
