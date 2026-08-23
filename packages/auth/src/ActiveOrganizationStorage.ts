/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Per-user client state: WHOSE state this browser currently holds
 * ({@link SessionUserScope}), and the active organization id scoped to that
 * user ({@link ActiveOrganizationStorage}).
 *
 * # objectui#5664 — why this file exists
 *
 * `auth-active-organization-id` was a single un-namespaced `localStorage` key,
 * while its siblings in `@object-ui/app-shell` were already user-scoped
 * (`objectui-recent-items:u:<id>`, `objectui-favorites:u:<id>`,
 * `flow-palette-recents:u:<id>`). On a browser handed from one account to
 * another the new session read the PREVIOUS user's organization id: the header
 * workspace chip rendered the previous user's workspace, and — the consequence
 * that is not cosmetic — the polluted org context suppressed
 * `RequireOrganization`'s routing into the guided "Create your workspace"
 * first-run flow. A brand-new user on a shared browser silently never got the
 * new-user flow.
 *
 * The server side was verified clean while the card was written: with the
 * stale id, `get-full-organization` and `set-active` both answer
 * `403 USER_IS_NOT_A_MEMBER` and `sys_environment` lists zero rows. Nothing
 * about row visibility rode on this; the damage was entirely in what the
 * client believed about itself.
 *
 * # The three parts, and which one closes the class
 *
 *  1. The key is namespaced per user (below).
 *  2. `set()` can no longer write the un-namespaced key at all — see
 *     {@link scopedActiveOrgKey}. Namespacing that keeps a bare-key fallback
 *     re-opens the defect the first time a write happens before the user id is
 *     known.
 *  3. {@link SessionUserScope.adopt} drops the previous user's UI state
 *     WHOLESALE when the session user changes. That is the load-bearing part:
 *     (1) and (2) fix one key, while (3) is what keeps the NEXT un-namespaced
 *     key — one nobody has written yet — from re-opening the same class. It is
 *     an allowlist sweep for exactly that reason: a denylist of the keys we
 *     know about today would not cover a key added tomorrow.
 *
 * # Resolving the scope with no `await`
 *
 * The user id is NOT known from React state at the moment this storage is
 * first read. `createAuthenticatedFetch` reads it on every request including
 * the very first `get-session`, and `MetadataProvider` reads it synchronously
 * at mount to scope its seed cache — both before `AuthProvider`'s async
 * session chain has resolved anything. So the scope is resolved from
 * {@link SESSION_USER_STORAGE_KEY}, an ordinary `localStorage` pointer the
 * PREVIOUS page-load wrote: one synchronous read, no await, and correct for
 * every boot of a browser that has held a session before.
 *
 * The window where that pointer is stale — a boot whose cookie session belongs
 * to someone other than the pointer — is bounded by `adopt()` firing as soon
 * as `get-session` answers, and it is the same window the `X-Tenant-ID` edge
 * contract already documents as "the header may be absent or not yet
 * authoritative" (objectui#5279, this package's README). Requests that leave
 * inside it are scoped by the SESSION server-side, not by the header.
 */

/**
 * Pointer to the user whose client state this browser holds. Deliberately NOT
 * user-scoped itself — it is the thing that makes user scoping resolvable, and
 * it is overwritten rather than accumulated, so there is never more than one.
 */
const SESSION_USER_STORAGE_KEY = 'auth-session-user-id';

/** Base name the per-user active-org key is derived from. */
const ACTIVE_ORG_BASE_KEY = 'auth-active-organization-id';

/**
 * The pre-#5664 spelling — the same string, un-suffixed. Every browser that
 * has run an older build still has a value under it, and that value is
 * UNATTRIBUTABLE: nothing recorded whose org id it is. It is therefore deleted
 * rather than migrated. Migrating it is precisely the defect (on a handed-over
 * browser it would hand the previous user's org id to the new one), and
 * keeping it would leave a live bare key for a future reader to find.
 *
 * Dropping it costs a signed-in user nothing durable: `AuthProvider`'s
 * `refreshOrganizations` asks the SERVER for the active organization whenever
 * the list is non-empty and no active org is held, including the ADR-0081
 * single-membership repair. The server is the authority for this value; the
 * client copy is a routing-header cache. One boot re-supplies it.
 */
const LEGACY_ACTIVE_ORG_KEY = ACTIVE_ORG_BASE_KEY;

/**
 * Keys that survive a change of session user, because they describe the DEVICE
 * or the INCOMING session rather than the outgoing user's state.
 *
 * `auth-session-token` is spelled out rather than imported from
 * `createAuthClient.ts` (where it is a module-private constant). The two ends
 * are held together by BEHAVIOUR instead of by a shared symbol — the pin in
 * `__tests__/sessionUserChangePurge-5664.test.tsx` fills it through the real
 * `TokenStorage` and reads it back through `TokenStorage` after a purge, so a
 * spelling that drifts on either side fails there rather than silently signing
 * the incoming user out.
 *
 * `vite-ui-theme` is `@object-ui/app-shell`'s `ThemeProvider` default. An app
 * that passes a custom `storageKey` loses its theme once on a user change and
 * re-picks it on the next toggle — cosmetic and self-healing, which is the
 * right side of an allowlist to err on.
 */
const DEVICE_SCOPED_KEYS: ReadonlySet<string> = new Set([
  'auth-session-token',
  SESSION_USER_STORAGE_KEY,
  'vite-ui-theme',
]);

/**
 * `localStorage` / `sessionStorage`, or `undefined` where they are absent or
 * blocked. Accessing the global itself can throw (partitioned iframes, some
 * privacy modes), so the guard has to be a try/catch and not a `typeof` test
 * alone.
 */
function safeStore(kind: 'local' | 'session'): Storage | undefined {
  try {
    if (kind === 'local') {
      return typeof localStorage !== 'undefined' ? localStorage : undefined;
    }
    return typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;
  } catch {
    return undefined;
  }
}

function readPersisted(key: string): string | null {
  try {
    return safeStore('local')?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writePersisted(key: string, value: string): void {
  try {
    safeStore('local')?.setItem(key, value);
  } catch {
    /* SSR / quota / private browsing — the caller keeps a memory copy */
  }
}

function removePersisted(key: string): void {
  try {
    safeStore('local')?.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Delete every entry in `store` that is not device-scoped.
 *
 * Snapshot the keys first (`Object.keys`) — removing entries during a live
 * index walk shifts the ones behind it and skips half of them. Same idiom as
 * `AuthProvider`'s sign-out purge loop.
 */
function sweepStore(store: Storage | undefined): void {
  if (!store) return;
  try {
    for (const key of Object.keys(store)) {
      if (DEVICE_SCOPED_KEYS.has(key)) continue;
      store.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
}

/**
 * Drop the outgoing user's client state wholesale — part 3 of the fix.
 *
 * Order is load-bearing and mirrors `clear()`'s: the in-memory active org goes
 * FIRST, because `ActiveOrganizationStorage.get()` falls through to
 * `_memoryValue` whenever the persisted read is null, which is exactly the
 * state this function leaves behind (objectui#5703). Sweeping storage first
 * would leave the outgoing user's org id live in memory for the rest of the
 * page-load — the SPA sign-out-then-sign-in path never reloads.
 *
 * Both stores are swept. `sessionStorage` is per-TAB, not per-session, so the
 * previous user's `objectui:metadata:*` seed (their PERMISSION-FILTERED app
 * list) and their `objectui-ctx-*` scope picks survive into whoever signs in
 * next in that tab unless something removes them.
 */
export function purgePreviousUserClientState(): void {
  ActiveOrganizationStorage.clear();
  sweepStore(safeStore('local'));
  sweepStore(safeStore('session'));
}

/**
 * Which user's client state this browser holds, and the transition that drops
 * the previous user's state.
 */
export const SessionUserScope = {
  /**
   * Memory copy of the pointer. Read FIRST by {@link current}: once this
   * page-load has adopted a user, that answer is authoritative for this tab
   * even if another tab has since written a different id, and it is the only
   * copy in a browser whose `localStorage` rejects writes.
   */
  _userId: null as string | null,

  /** The user whose state this browser holds, or `null` if it has never held one. */
  current(): string | null {
    if (this._userId !== null) return this._userId;
    return readPersisted(SESSION_USER_STORAGE_KEY);
  },

  /**
   * Record `userId` as the owner of this browser's client state, dropping the
   * previous owner's state wholesale when it changes.
   *
   * Idempotent: re-adopting the same user purges nothing. Called from
   * `AuthProvider` for real sessions only — the synthetic `preview-user` /
   * `guest` identities never reach it, so a preview mount cannot purge a real
   * user's state.
   */
  adopt(userId: string): void {
    if (!userId) return;
    const previous = this.current();
    if (previous !== null && previous !== userId) {
      purgePreviousUserClientState();
    }
    this._userId = userId;
    writePersisted(SESSION_USER_STORAGE_KEY, userId);
    // Unattributable legacy state, cleaned up on any adopt rather than only on
    // a change — see LEGACY_ACTIVE_ORG_KEY.
    removePersisted(LEGACY_ACTIVE_ORG_KEY);
  },

  /**
   * Forget the in-memory pointer. Test seam only — production has no reason to
   * un-know who is signed in, and sign-out deliberately KEEPS the persisted
   * pointer so that the next sign-in by a DIFFERENT user still sees a previous
   * owner to purge.
   */
  _resetForTests(): void {
    this._userId = null;
  },
};

/**
 * The `localStorage` key holding the active org id for the current user, or
 * `null` when no user is known yet.
 *
 * `null` — not the bare base key — is the whole point. `@object-ui/app-shell`'s
 * `scopedKey(base, userId)` falls back to the un-namespaced key for
 * "no user id yet", and that is correct THERE: its callers persist recents and
 * favourites, where a signed-out bucket leaking is cosmetic. Here the bare key
 * IS the defect, so "no user id yet" means "there is no key to persist under"
 * and the value lives in memory for this page-load only. The convention for
 * the scoped half is copied exactly (`${base}:u:${userId}`) — the symbol
 * cannot travel, because `@object-ui/app-shell` depends on `@object-ui/auth`
 * and not the other way round.
 */
function scopedActiveOrgKey(): string | null {
  const userId = SessionUserScope.current();
  return userId ? `${ACTIVE_ORG_BASE_KEY}:u:${userId}` : null;
}

/**
 * Get/set the active organization id that {@link createAuthenticatedFetch}
 * stamps as `X-Tenant-ID`.
 *
 * `AuthProvider` is the only writer, at four moments: `refreshOrganizations`
 * sets it once the `getSession` -> `listOrganizations` ->
 * `getActiveOrganization` chain resolves (including the ADR-0081
 * single-membership repair), `switchOrganization` sets or clears it,
 * `deleteOrganization` / `leaveOrganization` clear it when the active org is
 * the one going away, and sign-out clears it.
 *
 * Because the first of those is asynchronous, this reads EMPTY for the first
 * stretch of a boot, and every request that leaves in that window carries no
 * tenant header at all. That window is a documented part of the header's
 * contract, not an accident to paper over — see the "unstamped-first-request
 * gap" section of this package's README (objectui#5279).
 */
export const ActiveOrganizationStorage = {
  _memoryValue: null as string | null,

  /**
   * The active org id for the CURRENT user, or `null`.
   *
   * READ ORDER — a non-null `localStorage` read wins; anything else falls
   * through to `_memoryValue`. Returning the `localStorage` read
   * UNCONDITIONALLY (what this did before objectui#5703) left the fallback
   * reachable only when the read THREW, and there is a real browser state
   * where the read does not throw and the fallback is still the only copy:
   * `localStorage` present and readable but REJECTING WRITES — Safari private
   * browsing, and any quota-exhausted origin, where `setItem` throws
   * `QuotaExceededError`. `set()` swallows that failure into `_memoryValue`
   * (correctly — the fallback is right there), and `get()` then never
   * consulted it: the value was stored and could not be read back, so
   * `X-Tenant-ID` went unstamped for the whole session, not just the early
   * requests.
   *
   * WHY FALLING BACK ON `null` DOES NOT RESURRECT A CLEARED ORG. After
   * `clear()` the `localStorage` read is null by construction, so this
   * fallback fires — and it must answer `null`, because sign-out is one of
   * `clear()`'s callers. It does, because `clear()` nulls `_memoryValue` too.
   * That property is what makes this read order safe rather than an
   * incidental detail of `clear()`'s body, so it is pinned by test
   * (`__tests__/activeOrgStorageFallback-5703.test.tsx`) instead of being
   * re-derived by whoever edits `clear()` next.
   *
   * The same reasoning is why a change of session user purges through
   * {@link purgePreviousUserClientState} rather than by removing keys: the
   * outgoing user's id in `_memoryValue` would otherwise outlive their
   * persisted key on the SPA sign-out-then-sign-in path (objectui#5664).
   */
  get(): string | null {
    const key = scopedActiveOrgKey();
    if (key) {
      try {
        const persisted = safeStore('local')?.getItem(key) ?? null;
        if (persisted !== null) return persisted;
      } catch { /* SSR / test */ }
    }
    return this._memoryValue;
  },

  /**
   * With no session user known this writes to memory ONLY. That is not a
   * degraded path to apologise for — it is the fix: a persisted write with no
   * owner is the un-namespaced key this card retired.
   */
  set(orgId: string): void {
    this._memoryValue = orgId;
    const key = scopedActiveOrgKey();
    if (!key) return;
    writePersisted(key, orgId);
  },

  clear(): void {
    // Nulling the fallback is SECURITY-RELEVANT, not bookkeeping: `get()`
    // falls through to `_memoryValue` whenever the `localStorage` read comes
    // back null, which is exactly the state this method leaves behind. Drop
    // this line and sign-out's clear stops sticking — the removed key reads
    // null, the fallback fires, and the cleared org goes back on the wire as
    // `X-Tenant-ID`. Pinned by `__tests__/activeOrgStorageFallback-5703.test.tsx`.
    this._memoryValue = null;
    const key = scopedActiveOrgKey();
    if (key) removePersisted(key);
    // Also drop the pre-#5664 bare key, so a `clear()` on a browser upgrading
    // from an older build leaves nothing behind under the retired spelling.
    removePersisted(LEGACY_ACTIVE_ORG_KEY);
  },
};
