/**
 * Tests for createAuthClient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthClient } from '../createAuthClient';
import type { AuthClient } from '../types';

describe('createAuthClient', () => {
  let client: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = createAuthClient({ baseURL: '/api/auth', fetchFn: mockFetch });
  });

  it('creates a client with all expected methods', () => {
    expect(client).toHaveProperty('signIn');
    expect(client).toHaveProperty('signUp');
    expect(client).toHaveProperty('signOut');
    expect(client).toHaveProperty('getSession');
    expect(client).toHaveProperty('forgotPassword');
    expect(client).toHaveProperty('resetPassword');
    expect(client).toHaveProperty('updateUser');
  });

  it('signIn sends POST to /sign-in/email', async () => {
    const mockResponse = {
      user: { id: '1', name: 'Test', email: 'test@test.com' },
      session: { token: 'tok123' },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.signIn({ email: 'test@test.com', password: 'pass123' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/sign-in/email',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'test@test.com', password: 'pass123' }),
      }),
    );
    expect(result.user.email).toBe('test@test.com');
    expect(result.session.token).toBe('tok123');
  });

  it('signUp sends POST to /sign-up/email', async () => {
    const mockResponse = {
      user: { id: '2', name: 'New User', email: 'new@test.com' },
      session: { token: 'tok456' },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.signUp({ name: 'New User', email: 'new@test.com', password: 'pass123' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/sign-up/email',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.user.name).toBe('New User');
  });

  it('signOut sends POST to /sign-out', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await client.signOut();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/sign-out',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('getSession sends GET to /get-session', async () => {
    const mockSession = {
      user: { id: '1', name: 'Test', email: 'test@test.com' },
      session: { token: 'tok789' },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSession),
    });

    const result = await client.getSession();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/get-session',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result?.user.id).toBe('1');
  });

  it('getSession returns null on failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await client.getSession();
    expect(result).toBeNull();
  });

  it('forgotPassword sends POST to /forgot-password', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await client.forgotPassword('test@test.com');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com' }),
      }),
    );
  });

  it('resetPassword sends POST to /reset-password', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await client.resetPassword('token123', 'newpass');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/reset-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'token123', newPassword: 'newpass' }),
      }),
    );
  });

  it('throws error with server message on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Invalid credentials' }),
    });

    await expect(client.signIn({ email: 'x', password: 'y' })).rejects.toThrow('Invalid credentials');
  });

  it('throws generic error when response has no message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    });

    await expect(client.signIn({ email: 'x', password: 'y' })).rejects.toThrow(
      'Auth request failed with status 500',
    );
  });

  it('updateUser sends POST to /update-user and returns user', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { id: '1', name: 'Updated', email: 'test@test.com' } }),
    });

    const result = await client.updateUser({ name: 'Updated' });

    expect(result.name).toBe('Updated');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/update-user',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
