/**
 * Mock Auth Handlers for MSW
 *
 * Provides in-memory mock implementations of the better-auth standard
 * endpoints used by @object-ui/auth's createAuthClient. These handlers
 * enable sign-up, sign-in, session, and sign-out flows in the MSW
 * (browser / test) environment where no real AuthPlugin is available.
 *
 * NOTE: This is a mock/testing module only. Passwords are stored in
 * plain text — never use this pattern in production code.
 *
 * Endpoints:
 *   POST /sign-up/email  — register a new user
 *   POST /sign-in/email  — authenticate with email + password
 *   GET  /get-session     — retrieve the current session
 *   POST /sign-out        — clear the session
 *   POST /forgot-password — no-op acknowledgement
 *   POST /reset-password  — no-op acknowledgement
 *   POST /update-user     — update the current user's profile
 */

import { http, HttpResponse } from 'msw';
import type { HttpHandler } from 'msw';

interface MockUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  role: string;
}

interface MockSession {
  token: string;
  expiresAt: string;
}

/** Simple in-memory store for mock users and sessions. */
const users = new Map<string, MockUser & { password: string }>();
let currentSession: { user: MockUser; session: MockSession } | null = null;
let nextId = 1;

/** Reset all in-memory auth state. Call in test `beforeEach` for isolation. */
export function resetAuthState(): void {
  users.clear();
  currentSession = null;
  nextId = 1;
}

function generateToken(): string {
  return `mock-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generateExpiry(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

/** Return a user object without the password field. */
function toSafeUser(user: MockUser & { password: string }): MockUser {
  const { password: _, ...safe } = user;
  return safe;
}

/**
 * Create MSW request handlers that mock the better-auth REST endpoints.
 *
 * @param baseUrl — The API prefix (e.g. "/api/v1/auth").
 */
export function createAuthHandlers(baseUrl: string): HttpHandler[] {
  // Prefix with wildcard so handlers match full URLs in both browser
  // (MSW worker, relative paths) and node (MSW server, absolute URLs).
  const p = `*${baseUrl}`;

  return [
    // ── Sign Up ──────────────────────────────────────────────────────────
    http.post(`${p}/sign-up/email`, async ({ request }) => {
      const body = (await request.json()) as {
        name?: string;
        email?: string;
        password?: string;
      };

      if (!body.email || !body.password) {
        return HttpResponse.json(
          { message: 'Email and password are required' },
          { status: 400 },
        );
      }

      if (users.has(body.email)) {
        return HttpResponse.json(
          { message: 'User already exists' },
          { status: 409 },
        );
      }

      const id = String(nextId++);
      const user: MockUser & { password: string } = {
        id,
        name: body.name || body.email.split('@')[0],
        email: body.email,
        emailVerified: false,
        role: 'user',
        password: body.password,
      };
      users.set(body.email, user);

      const session: MockSession = {
        token: generateToken(),
        expiresAt: generateExpiry(),
      };
      const safeUser = toSafeUser(user);
      currentSession = { user: safeUser, session };

      return HttpResponse.json({ user: safeUser, session });
    }),

    // ── Sign In ──────────────────────────────────────────────────────────
    http.post(`${p}/sign-in/email`, async ({ request }) => {
      const body = (await request.json()) as {
        email?: string;
        password?: string;
      };

      if (!body.email || !body.password) {
        return HttpResponse.json(
          { message: 'Email and password are required' },
          { status: 400 },
        );
      }

      const stored = users.get(body.email);
      if (!stored || stored.password !== body.password) {
        return HttpResponse.json(
          { message: 'Invalid email or password' },
          { status: 401 },
        );
      }

      const session: MockSession = {
        token: generateToken(),
        expiresAt: generateExpiry(),
      };
      const safeUser = toSafeUser(stored);
      currentSession = { user: safeUser, session };

      return HttpResponse.json({ user: safeUser, session });
    }),

    // ── Get Session ──────────────────────────────────────────────────────
    http.get(`${p}/get-session`, () => {
      if (!currentSession) {
        return HttpResponse.json(null, { status: 401 });
      }
      return HttpResponse.json(currentSession);
    }),

    // ── Sign Out ─────────────────────────────────────────────────────────
    http.post(`${p}/sign-out`, () => {
      currentSession = null;
      return HttpResponse.json({ success: true });
    }),

    // ── Forgot Password (mock acknowledgement) ──────────────────────────
    http.post(`${p}/forgot-password`, () => {
      return HttpResponse.json({ success: true });
    }),

    // ── Reset Password (mock acknowledgement) ────────────────────────────
    http.post(`${p}/reset-password`, () => {
      return HttpResponse.json({ success: true });
    }),

    // ── Update User ──────────────────────────────────────────────────────
    http.post(`${p}/update-user`, async ({ request }) => {
      if (!currentSession) {
        return HttpResponse.json(
          { message: 'Not authenticated' },
          { status: 401 },
        );
      }

      const body = (await request.json()) as Partial<MockUser>;
      const updated: MockUser = { ...currentSession.user, ...body };
      currentSession = { ...currentSession, user: updated };

      // Sync the stored record if we have one
      const stored = users.get(updated.email);
      if (stored) {
        Object.assign(stored, body);
      }

      return HttpResponse.json({ user: updated });
    }),
  ];
}
