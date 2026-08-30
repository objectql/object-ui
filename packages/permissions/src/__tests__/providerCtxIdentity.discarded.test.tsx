/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6813 — neither permission provider may move the context value's
 * identity while the inputs it is derived from are unchanged.
 *
 * `PermissionProvider` built its value in a `useMemo` over four `useCallback`s
 * and `MePermissionsProvider` in a `useMemo` over six. Neither carries a
 * semantic guarantee: React may discard the cache and recompute even when the
 * dependency list compares equal, and every factory here builds a fresh
 * object. A discard therefore handed `PermCtx.Provider` a NEW context value
 * with every permission it carries unchanged — which moves the key
 * `usePermissions()` caches on (objectui#6724) and re-runs the whole consumer
 * chain: `ListView`'s data-fetch effect (an extra `dataSource.find`),
 * `DetailView`'s gatedSchema, `ObjectForm`/`ModalForm`/`ObjectGrid`/
 * `RelatedList` — 9 dependency arrays across 6 files naming the whole object,
 * measured on `1e14d70ae`.
 *
 * ⚠️ WHAT IS AND IS NOT OBSERVABLE TODAY. This file pins a LATENT hazard, not
 * a reproduction, and must not be read as a bug being fixed. On React 19.2.8
 * (this repo's pinned version) the cache is NOT discarded spontaneously —
 * measured while objectui#6724 landed: 51 re-renders with no provider, 51 with
 * one and 42 under `StrictMode` each returned ONE identity — and there is no
 * `Activity`/Offscreen subtree in this repo, which is the documented case
 * where React does throw memo caches away. So the discard below is FORCED by a
 * proxy, because React will not do it on its own and a pin that does not force
 * one would prove nothing here.
 *
 * The proxy patches `useMemo` AND `useCallback` at the MODULE level: the
 * providers reach them through their own `import { … } from 'react'` bindings,
 * and `vi.spyOn`/assignment/`defineProperty` on the frozen `[object Module]`
 * namespace all fail to patch those — silently leaving any pin built on them
 * unfalsifiable. Same technique and same reason as
 * `usePermissions.discardedIdentity.test.tsx` (objectui#6724) and
 * `plugin-list/src/__tests__/ListView.discardedExpandFieldsMemo.test.tsx`
 * (objectui#6697). It differs from those in one way that matters here: it
 * discards EVERY armed memo and callback rather than ones matched by a marker
 * dependency, because the fix under test removes the dependency arrays
 * altogether — a marker-matched proxy would have nothing left to match and
 * would go green for the trivial reason.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import * as ReactNS from 'react';
import type { ObjectPermissionConfig, RoleDefinition } from '@object-ui/types';
import { PermCtx, type PermissionContextValue } from '../PermissionContext';
import { usePermissions } from '../usePermissions';
import { PermissionProvider } from '../PermissionProvider';
import { MePermissionsProvider, type MePermissionsResponse } from '../MePermissionsProvider';

const memoProxy = vi.hoisted(() => ({ armed: false, epoch: 0 }));

vi.mock('react', async (importOriginal) => {
  // `<any>` matches the sibling pins (objectui#6697 / #6724) and is
  // load-bearing: a precise module type makes the real hooks' deps parameter
  // `DependencyList`, which the patched signatures below cannot satisfy.
  const actual = await importOriginal<any>();
  const realUseMemo = actual.useMemo;
  const realUseCallback = actual.useCallback;
  const patchedUseMemo = (factory: () => unknown, deps?: unknown[]) =>
    memoProxy.armed && Array.isArray(deps)
      ? realUseMemo(factory, [...deps, memoProxy.epoch])
      : realUseMemo(factory, deps);
  const patchedUseCallback = (fn: unknown, deps?: unknown[]) =>
    memoProxy.armed && Array.isArray(deps)
      ? realUseCallback(fn, [...deps, memoProxy.epoch])
      : realUseCallback(fn, deps);
  return {
    ...actual,
    useMemo: patchedUseMemo,
    useCallback: patchedUseCallback,
    default: {
      ...(actual.default ?? actual),
      useMemo: patchedUseMemo,
      useCallback: patchedUseCallback,
    },
  };
});

/** Put EVERY memo and callback in the tree under this file's control. */
function armDiscardProxy(): () => void {
  memoProxy.armed = true;
  return () => {
    memoProxy.armed = false;
  };
}
/** Throw away every armed cache — one discard event, on demand. */
function discardNow(): void {
  memoProxy.epoch += 1;
}

afterEach(() => {
  cleanup();
  memoProxy.armed = false;
});

/** Records the ctx the provider published, what a consumer saw, and effect runs. */
function makeProbe() {
  const ctxSeen: (PermissionContextValue | null)[] = [];
  const permsSeen: ReturnType<typeof usePermissions>[] = [];
  const effectRuns: unknown[] = [];
  const Probe: React.FC = () => {
    // The provider's own output, and the consumer-visible object one link
    // downstream. objectui#6724 made the second stable while the FIRST is
    // unchanged, so both are asserted here: that is the end-to-end claim.
    ctxSeen.push(ReactNS.useContext(PermCtx));
    const perms = usePermissions();
    permsSeen.push(perms);
    // Exactly the consumer shape this card is about: `ListView`'s data-fetch
    // effect names the whole object in its dependency array.
    ReactNS.useEffect(() => {
      effectRuns.push(perms);
    }, [perms]);
    return null;
  };
  return { ctxSeen, permsSeen, effectRuns, Probe };
}

const ROLES: RoleDefinition[] = [{ name: 'restricted', label: 'Restricted' } as RoleDefinition];
const PERMISSIONS: ObjectPermissionConfig[] = [
  {
    object: 'accounts',
    roles: {
      restricted: {
        fieldPermissions: [{ field: 'secret', read: false, write: false }],
        rowPermissions: [{ filter: 'owner_id = me' }],
      },
    },
  } as unknown as ObjectPermissionConfig,
];
const USER_ROLES = ['restricted'];

const ME: MePermissionsResponse = {
  authenticated: true,
  userId: 'u-1',
  tenantId: 't-1',
  roles: ['restricted'],
  permissionSets: ['ps-1'],
  systemPermissions: ['manage_app'],
  objects: { accounts: { allowRead: true, allowEdit: false, apiOperations: ['find'] } },
  fields: { 'accounts.secret': { readable: false, editable: false } },
};

describe('the discard proxy really reaches the binding the providers use (objectui#6813)', () => {
  it('provesTheProxyDiscriminates: an armed memo AND an armed callback are both discarded', () => {
    const memos: unknown[] = [];
    const callbacks: unknown[] = [];
    const Probe: React.FC = () => {
      memos.push(ReactNS.useMemo(() => ({}), []));
      callbacks.push(ReactNS.useCallback(() => {}, []));
      return null;
    };

    const restore = armDiscardProxy();
    try {
      const { rerender } = render(<Probe />);
      // Armed but not fired: normal caching still holds, so a green below
      // cannot be green because the proxy breaks caching outright.
      rerender(<Probe />);
      expect(memos[1]).toBe(memos[0]);
      expect(callbacks[1]).toBe(callbacks[0]);

      discardNow();
      rerender(<Probe />);
    } finally {
      restore();
    }
    expect(memos[2]).not.toBe(memos[1]);
    expect(callbacks[2]).not.toBe(callbacks[1]);
  });
});

describe('PermissionProvider — ctx identity survives a discarded cache (objectui#6813)', () => {
  it('keeps ONE ctx identity across a discard while the props are unchanged', () => {
    const { ctxSeen, permsSeen, effectRuns, Probe } = makeProbe();
    const tree = () => (
      <PermissionProvider roles={ROLES} permissions={PERMISSIONS} userRoles={USER_ROLES}>
        <Probe />
      </PermissionProvider>
    );

    const restore = armDiscardProxy();
    try {
      const { rerender } = render(tree());
      rerender(tree());
      expect(new Set(ctxSeen).size).toBe(1);

      // Two discards, each followed by a re-render with the SAME props.
      // Nothing an author or a caller controls has changed.
      discardNow();
      rerender(tree());
      discardNow();
      rerender(tree());
    } finally {
      restore();
    }

    expect(new Set(ctxSeen).size).toBe(1);
    expect(new Set(permsSeen).size).toBe(1);
    // The observable the card names, modelled at its source: the consuming
    // effect must not re-run, so there is no redundant `dataSource.find`.
    expect(effectRuns).toHaveLength(1);
  });

  it('keeps the member identities three consumers name in dependency arrays', () => {
    const { ctxSeen, Probe } = makeProbe();
    const tree = () => (
      <PermissionProvider roles={ROLES} permissions={PERMISSIONS} userRoles={USER_ROLES} user={undefined}>
        <Probe />
      </PermissionProvider>
    );

    const restore = armDiscardProxy();
    try {
      const { rerender } = render(tree());
      discardNow();
      rerender(tree());
    } finally {
      restore();
    }

    const first = ctxSeen[0]!;
    const last = ctxSeen[ctxSeen.length - 1]!;
    // `RecordDetailView`, `ObjectDataPage` and `ObjectView` each name
    // `getObjectApiOperations` in a `useMemo` dependency array.
    expect(last.getObjectApiOperations).toBe(first.getObjectApiOperations);
    // `useFieldPermissions` names both of these in its own dependency arrays.
    expect(last.checkField).toBe(first.checkField);
    expect(last.getFieldPermissions).toBe(first.getFieldPermissions);
    expect(last.check).toBe(first.check);
    expect(last.getRowFilter).toBe(first.getRowFilter);
    expect(last.hasCapabilities).toBe(first.hasCapabilities);
  });

  it('still publishes a NEW ctx when the permissions genuinely change, carrying the new answers', () => {
    const { ctxSeen, effectRuns, Probe } = makeProbe();
    const OPEN: ObjectPermissionConfig[] = [
      { object: 'accounts', roles: { restricted: { fieldPermissions: [] } } } as unknown as ObjectPermissionConfig,
    ];
    const tree = (permissions: ObjectPermissionConfig[]) => (
      <PermissionProvider roles={ROLES} permissions={permissions} userRoles={USER_ROLES}>
        <Probe />
      </PermissionProvider>
    );

    const { rerender } = render(tree(PERMISSIONS));
    rerender(tree(OPEN));

    const first = ctxSeen[0]!;
    const last = ctxSeen[ctxSeen.length - 1]!;
    expect(last).not.toBe(first);
    expect(effectRuns).toHaveLength(2);
    // …and the new identity answers with the NEW permissions, not a stale
    // snapshot: `secret` was denied under PERMISSIONS and is open under OPEN.
    expect(first.checkField('accounts', 'secret', 'read')).toBe(false);
    expect(last.checkField('accounts', 'secret', 'read')).toBe(true);
    expect(first.getRowFilter('accounts')).toBe('owner_id = me');
    expect(last.getRowFilter('accounts')).toBeUndefined();
  });

  it('answers exactly what it answered before the discard', () => {
    const { ctxSeen, Probe } = makeProbe();
    const tree = () => (
      <PermissionProvider roles={ROLES} permissions={PERMISSIONS} userRoles={USER_ROLES}>
        <Probe />
      </PermissionProvider>
    );

    const restore = armDiscardProxy();
    try {
      const { rerender } = render(tree());
      discardNow();
      rerender(tree());
    } finally {
      restore();
    }

    const readAll = (c: PermissionContextValue) => ({
      checkFieldOpen: c.checkField('accounts', 'name', 'read'),
      checkFieldDenied: c.checkField('accounts', 'secret', 'read'),
      fieldPerms: c.getFieldPermissions('accounts'),
      rowFilter: c.getRowFilter('accounts'),
      apiOps: c.getObjectApiOperations('accounts'),
      roles: c.roles,
      userId: c.userId,
      systemPermissions: c.systemPermissions,
      capabilities: c.hasCapabilities(['anything']),
      isLoaded: c.isLoaded,
    });
    const expected = {
      checkFieldOpen: true,
      checkFieldDenied: false,
      fieldPerms: [{ field: 'secret', read: false, write: false }],
      rowFilter: 'owner_id = me',
      // [#3391] role-based provider models no effective API operation set.
      apiOps: undefined,
      roles: USER_ROLES,
      // [objectui#5683] never learns who the user IS.
      userId: null,
      // [objectui#4656] unreported, NOT a reported-empty grant — and
      // `hasCapabilities` stays fail-open on it.
      systemPermissions: undefined,
      capabilities: true,
      isLoaded: true,
    };
    expect(readAll(ctxSeen[0]!)).toEqual(expected);
    expect(readAll(ctxSeen[ctxSeen.length - 1]!)).toEqual(expected);
  });

  it('two providers given the same inputs cannot evict each other', () => {
    // This is what makes the cache immune rather than merely lucky: a single
    // slot comparing a stored dependency list would be SHARED by both trees
    // below, so each render would evict the other's entry and churn the very
    // identity this card is about. Keying on the input tuple has no such slot.
    const a = makeProbe();
    const b = makeProbe();
    const tree = () => (
      <>
        <PermissionProvider roles={ROLES} permissions={PERMISSIONS} userRoles={USER_ROLES}>
          <a.Probe />
        </PermissionProvider>
        <PermissionProvider roles={ROLES} permissions={PERMISSIONS} userRoles={USER_ROLES}>
          <b.Probe />
        </PermissionProvider>
      </>
    );

    const restore = armDiscardProxy();
    try {
      const { rerender } = render(tree());
      rerender(tree());
      discardNow();
      rerender(tree());
    } finally {
      restore();
    }

    expect(new Set(a.ctxSeen).size).toBe(1);
    expect(new Set(b.ctxSeen).size).toBe(1);
    expect(b.ctxSeen[0]).toBe(a.ctxSeen[0]);
    expect(a.effectRuns).toHaveLength(1);
    expect(b.effectRuns).toHaveLength(1);
  });
});

describe('MePermissionsProvider — ctx identity survives a discarded cache (objectui#6813)', () => {
  it('keeps ONE ctx identity across a discard while the fetched data is unchanged', () => {
    const { ctxSeen, permsSeen, effectRuns, Probe } = makeProbe();
    const tree = () => (
      <MePermissionsProvider initialPermissions={ME}>
        <Probe />
      </MePermissionsProvider>
    );

    const restore = armDiscardProxy();
    try {
      const { rerender } = render(tree());
      rerender(tree());
      expect(new Set(ctxSeen).size).toBe(1);

      discardNow();
      rerender(tree());
      discardNow();
      rerender(tree());
    } finally {
      restore();
    }

    expect(new Set(ctxSeen).size).toBe(1);
    expect(new Set(permsSeen).size).toBe(1);
    expect(effectRuns).toHaveLength(1);
  });

  it('keeps the member identities and the answers across a discard', () => {
    const { ctxSeen, Probe } = makeProbe();
    const tree = () => (
      <MePermissionsProvider initialPermissions={ME}>
        <Probe />
      </MePermissionsProvider>
    );

    const restore = armDiscardProxy();
    try {
      const { rerender } = render(tree());
      discardNow();
      rerender(tree());
    } finally {
      restore();
    }

    const first = ctxSeen[0]!;
    const last = ctxSeen[ctxSeen.length - 1]!;
    expect(last.getObjectApiOperations).toBe(first.getObjectApiOperations);
    expect(last.checkField).toBe(first.checkField);
    expect(last.getFieldPermissions).toBe(first.getFieldPermissions);
    expect(last.check).toBe(first.check);
    expect(last.getRowFilter).toBe(first.getRowFilter);

    const readAll = (c: PermissionContextValue) => ({
      checkAllowed: c.check('accounts', 'read').allowed,
      checkDenied: c.check('accounts', 'update').allowed,
      checkFieldDenied: c.checkField('accounts', 'secret', 'read'),
      apiOps: c.getObjectApiOperations('accounts'),
      rowFilter: c.getRowFilter('accounts'),
      roles: c.roles,
      userId: c.userId,
      systemPermissions: c.systemPermissions,
      capHeld: c.hasCapabilities(['manage_app']),
      capMissing: c.hasCapabilities(['manage_billing']),
      isLoaded: c.isLoaded,
    });
    const expected = {
      checkAllowed: true,
      checkDenied: false,
      checkFieldDenied: false,
      apiOps: ['find'],
      rowFilter: undefined,
      roles: ['restricted'],
      userId: 'u-1',
      systemPermissions: ['manage_app'],
      capHeld: true,
      capMissing: false,
      isLoaded: true,
    };
    expect(readAll(first)).toEqual(expected);
    expect(readAll(last)).toEqual(expected);
  });

  it('still publishes a NEW ctx when the fetched permissions genuinely change', async () => {
    // Driven through the FETCH, which is the only way this provider's data
    // actually changes: `initialPermissions` seeds `useState` and is ignored on
    // every later render, so re-rendering with a different one would assert
    // nothing (it measured exactly that until this comment was written).
    const { ctxSeen, Probe } = makeProbe();
    const OPENED: MePermissionsResponse = {
      ...ME,
      objects: { accounts: { allowRead: true, allowEdit: true } },
      fields: {},
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      new Response(JSON.stringify(String(input).includes('/v2') ? OPENED : ME), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const tree = (endpoint: string) => (
      <MePermissionsProvider endpoint={endpoint} fetcher={fetcher}>
        <Probe />
      </MePermissionsProvider>
    );

    const { rerender } = render(tree('/v1/me/permissions'));
    await waitFor(() => expect(ctxSeen.length).toBeGreaterThan(0));
    const first = ctxSeen[ctxSeen.length - 1]!;
    expect(first.checkField('accounts', 'secret', 'write')).toBe(false);
    expect(first.getObjectApiOperations('accounts')).toEqual(['find']);

    rerender(tree('/v2/me/permissions'));
    await waitFor(() => expect(ctxSeen[ctxSeen.length - 1]).not.toBe(first));

    const last = ctxSeen[ctxSeen.length - 1]!;
    // A genuine permission change must reach every consumer — the cache keys on
    // the fetched payload's identity, so a DIFFERENT payload cannot collide
    // onto the entry the previous one made.
    expect(last.checkField('accounts', 'secret', 'write')).toBe(true);
    expect(last.getObjectApiOperations('accounts')).toBeUndefined();
    expect(last.check('accounts', 'update').allowed).toBe(true);
  });
});
