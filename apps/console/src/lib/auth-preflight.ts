// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Auth preflight — validate any stale Bearer token sitting in localStorage
 * BEFORE `<AuthProvider>` mounts.
 *
 * # Why this exists
 *
 * `@object-ui/auth`'s `createAuthClient` wraps fetch in `createBearerFetch`,
 * which injects `Authorization: Bearer <token>` from
 * `localStorage['auth-session-token']` on every `/api/*` request.
 *
 * Cookie-based sign-in (better-auth sets a session cookie) does NOT touch
 * this localStorage key. So a stale Bearer can linger: a user signs out,
 * signs back in as a different user (new cookie), but localStorage still
 * holds the old token from a previous visit. The Console's AuthProvider
 * then sends that **stale Bearer** to `get-session`; the server prefers
 * Bearer over cookie and returns null, so AuthProvider wrongly treats the
 * user as unauthenticated and bounces them to the login page even though
 * the cookie session is valid.
 *
 * # What this does
 *
 * Run BEFORE React renders. If `auth-session-token` is present, probe
 * `/api/v1/auth/get-session` with that Bearer (and no cookie). If the
 * response is not authenticated, delete the stale token + the stale
 * `auth-active-organization-id` so AuthProvider's first `getSession()`
 * falls back to cookie auth cleanly.
 *
 * Idempotent, runs once per page load, < 50 ms when the token is valid
 * (single round-trip), no UI flicker (happens before render).
 */

const TOKEN_KEY = 'auth-session-token';
const ACTIVE_ORG_KEY = 'auth-active-organization-id';

export async function preflightAuth(authBaseUrl: string): Promise<void> {
  if (typeof window === 'undefined') return;
  // No initializer: every path out of the try/catch below either assigns
  // `token` or returns, so a `= null` seed would be dead (no-useless-assignment).
  let token: string | null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    // Storage blocked (Safari private mode / partitioned iframe) — nothing to
    // validate, and nothing we could purge either.
    return;
  }
  if (!token) return;

  try {
    const res = await fetch(`${authBaseUrl}/get-session`, {
      method: 'GET',
      // Send ONLY the Bearer (no cookie) — we want to know if the token
      // alone is valid. If we sent the cookie too the server might accept
      // the cookie and we wouldn't detect a stale token.
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const body = await res.json().catch(() => null);
      const user = body?.user ?? body?.data?.user ?? null;
      if (user) return; // token valid — leave localStorage alone
    }

    // 401, 4xx, or 200-with-null — token is stale. Purge.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTIVE_ORG_KEY);
  } catch {
    // Network error: assume token might still be good; don't punish the
    // user by clearing it. Worst case AuthProvider will detect it next.
  }
}
