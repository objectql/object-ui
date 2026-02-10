/**
 * Tests for createAuthenticatedFetch
 */

import { describe, it, expect, vi } from 'vitest';
import { createAuthenticatedFetch } from '../createAuthenticatedFetch';
import type { AuthClient } from '../types';

describe('createAuthenticatedFetch', () => {
  it('injects Authorization header when session exists', async () => {
    const mockClient: AuthClient = {
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        user: { id: '1', name: 'Test', email: 'test@test.com' },
        session: { token: 'bearer-token-123' },
      }),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
      updateUser: vi.fn(),
    };

    const authenticatedFetch = createAuthenticatedFetch(mockClient);

    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = mockFetch;

    try {
      await authenticatedFetch('https://api.example.com/data');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );

      const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
      expect(calledHeaders.get('Authorization')).toBe('Bearer bearer-token-123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not inject Authorization header when no session', async () => {
    const mockClient: AuthClient = {
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue(null),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
      updateUser: vi.fn(),
    };

    const authenticatedFetch = createAuthenticatedFetch(mockClient);

    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = mockFetch;

    try {
      await authenticatedFetch('https://api.example.com/data');

      const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
      expect(calledHeaders.get('Authorization')).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('preserves existing request headers', async () => {
    const mockClient: AuthClient = {
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        user: { id: '1', name: 'Test', email: 'test@test.com' },
        session: { token: 'tok' },
      }),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
      updateUser: vi.fn(),
    };

    const authenticatedFetch = createAuthenticatedFetch(mockClient);

    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = mockFetch;

    try {
      await authenticatedFetch('https://api.example.com/data', {
        headers: { 'X-Custom': 'value' },
      });

      const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
      expect(calledHeaders.get('X-Custom')).toBe('value');
      expect(calledHeaders.get('Authorization')).toBe('Bearer tok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
