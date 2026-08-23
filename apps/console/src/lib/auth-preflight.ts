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
 * response is not authenticated, delete the stale token + every stale
 * active-organization id (the bare pre-objectui#5664 key and each
 * `auth-active-organization-id:u:` scope) so AuthProvider's first
 * `getSession()` falls back to cookie auth cleanly.
 *
 * Idempotent, runs once per page load, < 50 ms when the token is valid
 * (single round-trip), no UI flicker (happens before render).
 */

const TOKEN_KEY = 'auth-session-token';
/**
 * Base name of the active-organization key. Since objectui#5664 the live key
 * is per-user (`auth-active-organization-id:u:<userId>`) and the bare name is
 * the retired pre-#5664 spelling, so the purge below matches BOTH by prefix.
 *
 * Spelled out rather than imported from `@object-ui/auth`: this module runs
 * BEFORE React renders, and pulling the auth barrel in here would drag its
 * component closure into the eager entry chunk.
 */
const ACTIVE_ORG_KEY_BASE = 'auth-active-organization-id';

/**
 * Remove the stale active-organization id under every spelling — the bare
 * pre-#5664 key and each `:u:<userId>` scope.
 *
 * Every scope goes, not just the current user's: a dead Bearer means this
 * browser cannot say whose ids these are, and the value is a client-side cache
 * of a SERVER-owned fact (`AuthProvider.refreshOrganizations` re-asks on the
 * next boot), so deleting one that turns out to still be wanted costs a
 * re-fetch and nothing else.
 *
 * `auth-session-user-id` is deliberately NOT removed. It is the pointer that
 * lets the next sign-in notice it belongs to a DIFFERENT user and drop the
 * previous user's state wholesale (objectui#5664); clearing it here would make
 * that transition look like a first-ever sign-in and skip the purge.
 */
function purgeActiveOrgKeys(): void {
  // Snapshot first — removing during a live index walk skips entries.
  for (const key of Object.keys(localStorage)) {
    if (key === ACTIVE_ORG_KEY_BASE || key.startsWith(`${ACTIVE_ORG_KEY_BASE}:u:`)) {
      localStorage.removeItem(key);
    }
  }
}

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
    purgeActiveOrgKeys();
  } catch {
    // Network error: assume token might still be good; don't punish the
    // user by clearing it. Worst case AuthProvider will detect it next.
  }
}
