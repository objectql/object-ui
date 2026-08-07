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
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
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
  // The three cases below pin the CURRENT behaviour, not the desired one. They
  // exist so the remaining gap is visible in the suite instead of being read as
  // a missed line, and so whoever resolves objectui#3655 has a failing anchor
  // to rewrite rather than a silent pass.

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

  it('MEASUREMENT: a non-404 failure is collapsed into 0 as well, with no error affordance', async () => {
    // The 404 never reaches the page's `.catch` — the adapter ate it upstream.
    // What that `.catch` really covers is this: a 500 (or 401 / 403 / offline)
    // on ONE object, rendered as a confident `0` on that card while its
    // neighbours show real numbers. Recorded here only; changing the error
    // handling is a separate class of work, filed as objectui#3679.
    state.failures.sys_user = Object.assign(new Error('Internal Server Error'), {
      status: 500,
    });
    renderHub();

    expect(await badge('hub-card-users', '0 users')).toBeInTheDocument();
    // The per-call `.catch` also keeps `Promise.all` from rejecting, so the
    // other four cards still resolve — including the one this PR fixed.
    expect(within(screen.getByTestId('hub-card-organizations')).getByText('2 organizations')).toBeInTheDocument();
  });
});
