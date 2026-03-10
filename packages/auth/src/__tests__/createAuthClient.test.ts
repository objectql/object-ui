/**
 * Tests for createAuthClient (backed by official better-auth client)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthClient } from '../createAuthClient';
import type { AuthClient } from '../types';

/**
 * Helper: creates a mock fetch that routes requests based on URL
 * and records every call for inspection.
 */
function createMockFetch(handlers: Record<string, { status?: number; body: unknown }>) {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const mockFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | null });
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(handler.body), {
          status: handler.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ message: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return { mockFn, calls };
}

describe('createAuthClient', () => {
  it('creates a client with all expected methods', () => {
    const { mockFn } = createMockFetch({});
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });
    expect(client).toHaveProperty('signIn');
    expect(client).toHaveProperty('signUp');
    expect(client).toHaveProperty('signOut');
    expect(client).toHaveProperty('getSession');
    expect(client).toHaveProperty('forgotPassword');
    expect(client).toHaveProperty('resetPassword');
    expect(client).toHaveProperty('updateUser');
  });

  it('signIn sends POST to /sign-in/email', async () => {
    const { mockFn, calls } = createMockFetch({
      '/sign-in/email': {
        body: {
          user: { id: '1', name: 'Test', email: 'test@test.com' },
          session: { token: 'tok123', id: 's1', userId: '1', expiresAt: '2025-01-01' },
        },
      },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    const result = await client.signIn({ email: 'test@test.com', password: 'pass123' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/auth/sign-in/email');
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body!)).toMatchObject({ email: 'test@test.com', password: 'pass123' });
    expect(result.user.email).toBe('test@test.com');
    expect(result.session.token).toBe('tok123');
  });

  it('signUp sends POST to /sign-up/email', async () => {
    const { mockFn, calls } = createMockFetch({
      '/sign-up/email': {
        body: {
          user: { id: '2', name: 'New User', email: 'new@test.com' },
          session: { token: 'tok456', id: 's2', userId: '2', expiresAt: '2025-01-01' },
        },
      },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    const result = await client.signUp({ name: 'New User', email: 'new@test.com', password: 'pass123' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/auth/sign-up/email');
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body!)).toMatchObject({ email: 'new@test.com', name: 'New User' });
    expect(result.user.name).toBe('New User');
  });

  it('signOut sends POST to /sign-out', async () => {
    const { mockFn, calls } = createMockFetch({
      '/sign-out': { body: { success: true } },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    await client.signOut();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/auth/sign-out');
    expect(calls[0].method).toBe('POST');
  });

  it('getSession sends GET to /get-session', async () => {
    const { mockFn, calls } = createMockFetch({
      '/get-session': {
        body: {
          user: { id: '1', name: 'Test', email: 'test@test.com' },
          session: { token: 'tok789', id: 's1', userId: '1', expiresAt: '2025-01-01' },
        },
      },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    const result = await client.getSession();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/auth/get-session');
    expect(calls[0].method).toBe('GET');
    expect(result?.user.id).toBe('1');
  });

  it('getSession returns null on failure', async () => {
    const { mockFn } = createMockFetch({
      '/get-session': { status: 401, body: { message: 'Unauthorized' } },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    const result = await client.getSession();
    expect(result).toBeNull();
  });

  it('forgotPassword sends POST to /forget-password', async () => {
    const { mockFn, calls } = createMockFetch({
      '/forget-password': { body: { status: true } },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    await client.forgotPassword('test@test.com');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/auth/forget-password');
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body!)).toMatchObject({ email: 'test@test.com' });
  });

  it('resetPassword sends POST to /reset-password', async () => {
    const { mockFn, calls } = createMockFetch({
      '/reset-password': { body: { status: true } },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    await client.resetPassword('token123', 'newpass');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/auth/reset-password');
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body!)).toMatchObject({ token: 'token123', newPassword: 'newpass' });
  });

  it('throws error with server message on non-OK response', async () => {
    const { mockFn } = createMockFetch({
      '/sign-in/email': {
        status: 401,
        body: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
      },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    await expect(client.signIn({ email: 'x', password: 'y' })).rejects.toThrow('Invalid credentials');
  });

  it('throws error on non-OK response without message', async () => {
    const { mockFn } = createMockFetch({
      '/sign-in/email': { status: 500, body: {} },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    await expect(client.signIn({ email: 'x', password: 'y' })).rejects.toThrow();
  });

  it('updateUser sends POST to /update-user and returns user', async () => {
    const { mockFn, calls } = createMockFetch({
      '/update-user': {
        body: { user: { id: '1', name: 'Updated', email: 'test@test.com' } },
      },
    });
    const client = createAuthClient({ baseURL: 'http://localhost/api/auth', fetchFn: mockFn });

    const result = await client.updateUser({ name: 'Updated' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/auth/update-user');
    expect(calls[0].method).toBe('POST');
    expect(result.name).toBe('Updated');
  });
});
