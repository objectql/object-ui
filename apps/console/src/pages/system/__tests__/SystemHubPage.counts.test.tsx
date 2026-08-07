// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * System Hub — the card counts must query object names the framework actually
 * registers (objectui#3670).
 *
 * The hub fetches one full list per card and renders `data.length` as the
 * count. Two of the five names it asked for did not exist in the framework at
 * all, and the failure mode was silent rather than loud: the backend answers a
 * missing object with `404 OBJECT_NOT_FOUND`, and `ObjectStackAdapter.find()`
 * deliberately absorbs that into `{ data: [], total: 0 }` (it caches the name
 * in `missingResources` so later calls short-circuit). So the card rendered a
 * confident `0` that no administrator could tell apart from "there really are
 * none" — on a single-org deployment where `sys_organization` always has at
 * least one row.
 *
 * This file therefore asserts two different things, and the difference is the
 * point:
 *   - Organizations is FIXED — the count now travels through `sys_organization`
 *     and shows the real number.
 *   - Permissions is only PINNED — the query still says `sys_permission`, an
 *     object the framework does not have, so that card still reads 0. Which
 *     object it should read is a maintainer decision open on objectui#3655
 *     (A `sys_permission_set` / B `sys_capability` / C retire the card). The
 *     MEASUREMENT cases below hold that gap visible instead of letting it read
 *     like an oversight.
 *
 * jsdom integration test — no backend. The adapter is stubbed at its real
 * contract boundary (see the `find` stub: unknown object RESOLVES empty, it
 * does not reject), so the tests exercise the same silence the bug hid behind.
 * `SystemHubPage` itself is the real component, as in the sibling
 * `SystemHubPage.metadataCards.test.tsx` — a transcribed copy of the card list
 * is precisely how a wrong name survives.
 *
 * ── objectui#3679 ──────────────────────────────────────────────────────────
 * A second describe block was added below for the other half of the same
 * pixel. The names above decide WHICH object is counted; the error handling
 * decides whether a count that never arrived is allowed to be spelled `0`. It
 * no longer is: a non-404 rejection (500 / 401 / 403 / offline — the only
 * class the adapter does not absorb) leaves that card's count `null`, and the
 * badge's existing `count !== null` branch drops the badge. The MEASUREMENT
 * case that pinned the old collapse-into-0 was rewritten there, as its own
 * comment asked for; the other two MEASUREMENTs still pin objectui#3655's gap
 * and are untouched.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Hoisted so the vi.mock factories below can close over them, and so the
// adapter is a STABLE singleton — a fresh object per render re-runs the page's
// fetch effect (`fetchCounts` is memoized on `dataSource`).
const { state, ADAPTER, FRAMEWORK_OBJECT_NAMES } = vi.hoisted(() => {
  /**
   * Object names the framework registers, each verified in the `objectstack`
   * checkout at the baseline of this change:
   *
   *   sys_user            packages/platform-objects/src/identity/sys-user.object.ts
   *   sys_organization    packages/platform-objects/src/identity/sys-organization.object.ts
   *   sys_position        packages/plugins/plugin-security/src/objects/sys-position.object.ts
   *   sys_capability      packages/plugins/plugin-security/src/objects/sys-capability.object.ts
   *   sys_permission_set  packages/plugins/plugin-security/src/objects/sys-permission-set.object.ts
   *   sys_audit_log       packages/plugins/plugin-audit/src/objects/sys-audit-log.object.ts
   *
   * `sys_org` and `sys_permission` are absent on purpose: a repo-wide grep for
   * either as an object name returns zero hits in the framework, which is
   * exactly what makes them unqueryable.
   */
  const FRAMEWORK_OBJECT_NAMES = [
    'sys_user',
    'sys_organization',
    'sys_position',
    'sys_capability',
    'sys_permission_set',
    'sys_audit_log',
  ];

  const state = {
    /** Every object name the page asked for, in call order. */
    calls: [] as string[],
    /** Registered object -> its rows. A name absent here is unregistered. */
    registry: {} as Record<string, unknown[]>,
    /** Object -> a NON-404 failure the real adapter would rethrow. */
    failures: {} as Record<string, Error>,
  };

  const ADAPTER = {
    /**
     * Mirrors `ObjectStackAdapter.find()` at its contract boundary:
     *   - registered name        -> `{ data: rows, total }`
     *   - UNregistered name      -> `{ data: [], total: 0 }`. The 404 is
     *     absorbed inside the adapter; callers never see a rejection, so the
     *     page's own `.catch` is not what hides a wrong object name.
     *   - non-404 failure (500 / 401 / network) -> REJECTS. That is the class
     *     the page's `.catch` actually swallows.
     */
    find: async (objectName: string) => {
      state.calls.push(objectName);
      const failure = state.failures[objectName];
      if (failure) throw failure;
      const rows = Object.prototype.hasOwnProperty.call(state.registry, objectName)
        ? state.registry[objectName]
        : [];
      return { data: rows, total: rows.length };
    },
  };

  return { state, ADAPTER, FRAMEWORK_OBJECT_NAMES };
});

vi.mock('@object-ui/app-shell', () => ({ useAdapter: () => ADAPTER }));
vi.mock('@object-ui/auth', () => ({ useIsWorkspaceAdmin: () => true }));

// Imported AFTER the mocks so the page picks them up.
import { SystemHubPage } from '../SystemHubPage';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));

beforeEach(() => {
  state.calls.length = 0;
  state.failures = {};
  // A deployment where every framework object holds a distinct, non-zero row
  // count — so any `0` on screen is a defect, never an accident of fixtures.
  state.registry = {
    sys_user: rows(3),
    sys_organization: rows(2),
    sys_position: rows(4),
    sys_capability: rows(7),
    sys_permission_set: rows(5),
    sys_audit_log: rows(6),
  };
});
afterEach(cleanup);

/** Mounts the hub under a route that supplies `:appName` (basePath `/apps/setup`). */
function renderHub() {
  render(
    <MemoryRouter initialEntries={['/apps/setup/system']}>
      <Routes>
        <Route path="/apps/:appName/system" element={<SystemHubPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * Awaits one card's count badge. All five counts land in a single `setCounts`,
 * so awaiting any one of them settles the whole wall.
 */
async function badge(cardTestId: string, text: string) {
  const card = await screen.findByTestId(cardTestId);
  return within(card).findByText(text);
}

/**
 * A card's count badge, or `null` when the card shows none — which is how this
 * page says "unknown" (the badge renders only on `count !== null`).
 *
 * Anchored `^…$` on purpose: the card's title and description carry the same
 * label word ("Manage system users and accounts"), so an unanchored match
 * would find text on a card that has no badge at all.
 */
function countBadge(cardTestId: string, label: string) {
  return within(screen.getByTestId(cardTestId)).queryByText(
    new RegExp(`^\\d+\\s+${label}$`),
  );
}

/**
 * Settles the fetch when NO badge is expected to appear, so awaiting one is not
 * an option. `fetchCounts` clears `loading` in its `finally`, so the spinner
 * going away is the single anchor that holds whether the calls resolved,
 * rejected, or threw synchronously.
 */
async function settleWithoutBadges() {
  await waitFor(() =>
    expect(screen.queryByText('Loading statistics...')).not.toBeInTheDocument(),
  );
}

/** Every card that carries a count, as [testid, countLabel]. */
const COUNTED_CARDS: ReadonlyArray<readonly [string, string]> = [
  ['hub-card-users', 'users'],
  ['hub-card-organizations', 'organizations'],
  ['hub-card-positions', 'positions'],
  ['hub-card-permissions', 'permissions'],
  ['hub-card-audit-log', 'entries'],
];

/**
 * The object names the page asks for, in call order — including
 * `sys_permission`, which the framework does not register (objectui#3655) and
 * so is absent from the fixture registry above.
 */
const QUERIED_OBJECT_NAMES = [
  'sys_user',
  'sys_organization',
  'sys_position',
  'sys_permission',
  'sys_audit_log',
];

describe('System Hub card counts — object names (objectui#3670)', () => {
  it('counts Organizations through sys_organization, the name the framework registers', async () => {
    renderHub();

    // Before the fix this read `0 organizations`: `sys_org` is not a framework
    // object, so the query 404'd and the adapter turned that into an empty page.
    expect(await badge('hub-card-organizations', '2 organizations')).toBeInTheDocument();
    expect(state.calls).toContain('sys_organization');
    expect(state.calls).not.toContain('sys_org');
  });

  it('leaves the three already-correct names alone', async () => {
    renderHub();

    expect(await badge('hub-card-users', '3 users')).toBeInTheDocument();
    expect(within(screen.getByTestId('hub-card-positions')).getByText('4 positions')).toBeInTheDocument();
    expect(within(screen.getByTestId('hub-card-audit-log')).getByText('6 entries')).toBeInTheDocument();
  });

  it('asks for exactly five names, and only one of them is missing from the framework', async () => {
    renderHub();
    // Settle on a card this audit does not judge, so a wrong name shows up as a
    // diff on the call list below rather than as a missing badge elsewhere.
    await badge('hub-card-users', '3 users');

    expect(state.calls).toEqual([
      'sys_user',
      'sys_organization',
      'sys_position',
      'sys_permission',
      'sys_audit_log',
    ]);
    // The whole audit in one assertion: after this change the only name the
    // framework does not register is the one parked on objectui#3655.
    expect(state.calls.filter((name) => !FRAMEWORK_OBJECT_NAMES.includes(name))).toEqual([
      'sys_permission',
    ]);
  });

  // ── MEASUREMENT ────────────────────────────────────────────────────────────
  // The two cases below pin the CURRENT behaviour, not the desired one. They
  // exist so the remaining gap is visible in the suite instead of being read as
  // a missed line, and so whoever resolves objectui#3655 has a failing anchor
  // to rewrite rather than a silent pass.
  //
  // There were three. The third — "a non-404 failure is collapsed into 0 as
  // well, with no error affordance" — named objectui#3679 as the work that
  // would rewrite it, and that work is done: it now lives in the next describe
  // block with its expectation inverted. These two stay measurements because
  // objectui#3655 is still open.

  it('MEASUREMENT: Permissions still reads 0 while both candidate objects hold rows', async () => {
    renderHub();

    // `sys_capability` (7 rows) and `sys_permission_set` (5 rows) both exist in
    // this fixture, and the card shows neither — it asks for `sys_permission`,
    // which the framework does not have. Aiming it at either candidate here
    // would decide objectui#3655's A/B/C on the maintainer's behalf, so the
    // query is deliberately untouched. When that decision lands, THIS is the
    // case to rewrite (expected: `7 permissions` for B, `5 permissions` for A,
    // or the card gone entirely for C).
    expect(await badge('hub-card-permissions', '0 permissions')).toBeInTheDocument();
    expect(state.calls).toContain('sys_permission');
    expect(state.calls).not.toContain('sys_capability');
    expect(state.calls).not.toContain('sys_permission_set');
  });

  it('MEASUREMENT: an unregistered object and a genuinely empty one render the identical badge', async () => {
    // `sys_audit_log` exists but has no rows; `sys_permission` does not exist
    // at all. Two different facts, one indistinguishable pixel — this is why
    // the wrong name survived so long, and it is unchanged by this PR (fixing
    // it means changing the error handling, a separate class of work).
    state.registry.sys_audit_log = [];
    renderHub();

    expect(await badge('hub-card-audit-log', '0 entries')).toBeInTheDocument();
    expect(within(screen.getByTestId('hub-card-permissions')).getByText('0 permissions')).toBeInTheDocument();
  });

});

describe('System Hub card counts — a lookup that failed is not a `0` (objectui#3679)', () => {
  it('a 500 on one object blanks that card instead of collapsing it into 0', async () => {
    // This is the rewrite of PR #3680's third MEASUREMENT ("a non-404 failure
    // is collapsed into 0 as well, with no error affordance") — same fixture,
    // inverted expectation. The 404 never reaches the page's `.catch`; the
    // adapter ate it upstream. What that `.catch` really covers is this.
    state.failures.sys_user = Object.assign(new Error('Internal Server Error'), {
      status: 500,
    });
    renderHub();

    // Organizations answered, so the whole wall has settled once its badge is
    // up — all five counts land in one `setCounts`.
    expect(await badge('hub-card-organizations', '2 organizations')).toBeInTheDocument();
    expect(countBadge('hub-card-users', 'users')).toBeNull();
    // Spelled out, because `0 users` is the exact string this issue is about.
    expect(screen.queryByText('0 users')).not.toBeInTheDocument();
  });

  it('blanks only the card that failed and leaves its neighbours their real counts', async () => {
    // The issue's most reachable scenario, and the one an administrator is
    // most likely to act on: someone who may open the hub but has no read
    // permission on `sys_audit_log`. The backend answers 403, the adapter
    // rethrows (it absorbs 404s only), and this card used to read "0 entries"
    // — an audit log that looks empty to the person auditing it.
    state.failures.sys_audit_log = Object.assign(new Error('Forbidden'), {
      status: 403,
    });
    renderHub();

    await badge('hub-card-users', '3 users');
    expect(countBadge('hub-card-audit-log', 'entries')).toBeNull();
    // Single-card isolation — the reason the `.catch` stayed on each call
    // instead of moving out around the `Promise.all`. The other four answered,
    // so they still show their numbers.
    expect(countBadge('hub-card-users', 'users')).toHaveTextContent('3 users');
    expect(countBadge('hub-card-organizations', 'organizations')).toHaveTextContent(
      '2 organizations',
    );
    expect(countBadge('hub-card-positions', 'positions')).toHaveTextContent('4 positions');
    expect(countBadge('hub-card-permissions', 'permissions')).toHaveTextContent(
      '0 permissions',
    );
  });

  it('keeps `0` for the two things that really are zero, and blanks only the failure', async () => {
    // All three rows of the issue's behaviour matrix in one render. Only the
    // third moves; the first two are the adapter's contract and stay as they
    // are (whether Permissions should be riding on row two at all is
    // objectui#3655, not this change):
    //   sys_audit_log   registered, genuinely empty  -> `0 entries`
    //   sys_permission  unregistered, adapter resolves empty -> `0 permissions`
    //   sys_position    403, adapter rethrows        -> no badge
    state.registry.sys_audit_log = [];
    state.failures.sys_position = Object.assign(new Error('Forbidden'), { status: 403 });
    renderHub();

    await badge('hub-card-users', '3 users');
    expect(countBadge('hub-card-audit-log', 'entries')).toHaveTextContent('0 entries');
    expect(countBadge('hub-card-permissions', 'permissions')).toHaveTextContent(
      '0 permissions',
    );
    expect(countBadge('hub-card-positions', 'positions')).toBeNull();
  });

  it('shows no counts at all when every lookup fails, and still renders the hub', async () => {
    // Offline, or the backend down. Every counted card loses its badge rather
    // than reporting a system with nothing in it; the cards that never carried
    // a count are unaffected and every link still works.
    for (const objectName of QUERIED_OBJECT_NAMES) {
      state.failures[objectName] = Object.assign(new Error('Failed to fetch'), {
        status: 0,
      });
    }
    renderHub();

    await settleWithoutBadges();
    for (const [testId, label] of COUNTED_CARDS) {
      expect(countBadge(testId, label)).toBeNull();
    }
    expect(screen.getByTestId('hub-card-settings')).toBeInTheDocument();
  });

  // No case is written for `fetchCounts`'s OUTER `catch`. It is reachable only
  // by a synchronous throw from `dataSource.find` (the per-call `.catch`es keep
  // `Promise.all` from ever rejecting), and on that path the counts are still
  // at their initial `null` — so an assertion that "no card shows a number"
  // would pass whatever the outer catch did, including nothing. It would be
  // green for an empty reason rather than because the page is right, so the
  // fix stayed where the outcome is actually written, and so did the tests.
});
