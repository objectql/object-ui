/**
 * Tests for mock auth MSW handlers.
 *
 * These tests verify the in-memory better-auth mock endpoints
 * that enable sign-up / sign-in / session / sign-out flows in the
 * MSW (browser & test) environment.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { createAuthHandlers, resetAuthState } from '../mocks/authHandlers';

const BASE_URL = 'http://localhost/api/v1/auth';
const handlers = createAuthHandlers('/api/v1/auth');
const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
beforeEach(() => resetAuthState());

describe('Mock Auth Handlers', () => {
  it('should register a new user via sign-up', async () => {
    const res = await fetch(`${BASE_URL}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123',
      }),
    });

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.name).toBe('Alice');
    expect(body.user.email).toBe('alice@example.com');
    expect(body.session).toBeDefined();
    expect(body.session.token).toBeTruthy();
    // Password must never be exposed
    expect(body.user.password).toBeUndefined();
  });

  it('should reject duplicate sign-up', async () => {
    // Register a user first
    await fetch(`${BASE_URL}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', password: 'secret123' }),
    });

    const res = await fetch(`${BASE_URL}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123',
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/already exists/i);
  });

  it('should reject sign-up without email', async () => {
    const res = await fetch(`${BASE_URL}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret123' }),
    });

    expect(res.status).toBe(400);
  });

  it('should sign in with correct credentials', async () => {
    // Register user first
    await fetch(`${BASE_URL}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', password: 'secret123' }),
    });

    const res = await fetch(`${BASE_URL}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'secret123',
      }),
    });

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.user.email).toBe('alice@example.com');
    expect(body.session.token).toBeTruthy();
  });

  it('should reject sign-in with wrong password', async () => {
    const res = await fetch(`${BASE_URL}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'wrong',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('should return current session after sign-in', async () => {
    // Register and sign in
    await fetch(`${BASE_URL}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', password: 'secret123' }),
    });
    await fetch(`${BASE_URL}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'secret123',
      }),
    });

    const res = await fetch(`${BASE_URL}/get-session`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.user.email).toBe('alice@example.com');
    expect(body.session.token).toBeTruthy();
  });

  it('should clear session on sign-out', async () => {
    const res = await fetch(`${BASE_URL}/sign-out`, { method: 'POST' });
    expect(res.ok).toBe(true);

    const sessionRes = await fetch(`${BASE_URL}/get-session`);
    expect(sessionRes.status).toBe(401);
  });

  it('should handle forget-password', async () => {
    const res = await fetch(`${BASE_URL}/forget-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    expect(res.ok).toBe(true);
  });

  it('should handle reset-password', async () => {
    const res = await fetch(`${BASE_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok', newPassword: 'newpass' }),
    });
    expect(res.ok).toBe(true);
  });

  it('should update user when authenticated', async () => {
    // Register and sign in first
    await fetch(`${BASE_URL}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', password: 'secret123' }),
    });
    await fetch(`${BASE_URL}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'secret123',
      }),
    });

    const res = await fetch(`${BASE_URL}/update-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Updated' }),
    });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.user.name).toBe('Alice Updated');
  });

  it('should reject update-user when not authenticated', async () => {
    const res = await fetch(`${BASE_URL}/update-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope' }),
    });
    expect(res.status).toBe(401);
  });
});
