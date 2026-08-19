// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useApiDiscovery — service-gated endpoint groups (#4240, #5286).
 *
 * ## The defect #4240 pinned, and how #9683 reshaped it
 *
 * `SERVICE_ENDPOINT_CATALOG` keys are looked up in `/discovery`'s `services`
 * map, which the framework keys by `CoreServiceName`. #4240 fixed a mis-key
 * (the storage group was keyed `storage` when the slot was `file-storage`)
 * by moving the catalog to `file-storage` — the then-canonical spelling. A
 * miss here is indistinguishable from "no such service" — the deliberate
 * fail-closed branch (ADR-0076 D12) then hides the group everywhere, on
 * every deployment, silently.
 *
 * The framework's #9683 ruling (2026-08-18) inverted the slot's own
 * canonical spelling: `storage` is now canonical, and `file-storage` is a
 * deprecated alias both discovery producers mirror byte-equal for the
 * alias's v17 lifetime. #5286 is the consumer-side follow-up pinned here:
 * the lookup now reads `services.storage` first and falls back to
 * `services['file-storage']`, so this page keeps rendering the group
 * against BOTH an upgraded backend and one that predates the #9683 mirror
 * row — never regressing to the #4240 failure on either spelling.
 *
 * ## What is asserted, and why the gate is left real
 *
 * `isServiceUsable` (`@object-ui/react`) is NOT stubbed here — it is the
 * contract under test on the "hidden" cases, and a transcription of it would
 * be free to agree with itself. Only `fetch` is stubbed. No adapter provider
 * is mounted, so `useAdapter()` returns `null` by design and the metadata /
 * data / schema endpoint families stay empty — that isolates these assertions
 * to the service-gated path without mocking any module.
 *
 * The last block is the tripwire the fix would have needed to be caught: it
 * derives the expected key vocabulary from the spec itself rather than
 * restating it, so a rename on EITHER side goes red instead of going quiet.
 * It still pins `SERVICE_ENDPOINT_CATALOG` to `file-storage`, not `storage`:
 * the locally pinned `@objectstack/spec` dependency has not published
 * `storage` as a `CoreServiceName` member yet (verified 2026-08-19 —
 * `CoreServiceName.options` from the installed package lists `file-storage`
 * only), so asserting `storage` membership here would fail against real,
 * currently-installed types, not against the fix. See
 * `DEPRECATED_SERVICE_SLOT_ALIASES`'s doc comment in the source file for the
 * re-key-when-the-dependency-catches-up plan; the last `it` in that block
 * pins the alias table directly instead, since it needs no spec version to
 * be true.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { CoreServiceName } from '@objectstack/spec/system';

import {
  useApiDiscovery,
  SERVICE_ENDPOINT_CATALOG,
  DEPRECATED_SERVICE_SLOT_ALIASES,
  type EndpointGroup,
} from './useApiDiscovery';

interface ServiceEntry {
  enabled?: boolean;
  status?: string;
  handlerReady?: boolean;
  route?: string;
}

/** A storage slot that is registered, honest and serving. */
const USABLE_STORAGE: ServiceEntry = {
  enabled: true,
  status: 'available',
  handlerReady: true,
  route: '/api/v1/storage',
};

function stubDiscovery(services: Record<string, ServiceEntry>, routes: Record<string, string> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      if (String(url).endsWith('/api/v1/discovery')) {
        return { ok: true, json: async () => ({ data: { routes, services } }) } as unknown as Response;
      }
      return { ok: false, json: async () => ({}) } as unknown as Response;
    }),
  );
}

async function groupsFor(
  services: Record<string, ServiceEntry>,
  routes: Record<string, string> = {},
): Promise<EndpointGroup[]> {
  stubDiscovery(services, routes);
  const { result } = renderHook(() => useApiDiscovery());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current.groups;
}

const storageGroup = (groups: EndpointGroup[]) => groups.find(g => g.key === 'Storage');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useApiDiscovery — the storage group (#4240, #5286)', () => {
  it('renders the Storage group from the canonical `storage` slot (framework #9683)', async () => {
    const groups = await groupsFor({ storage: USABLE_STORAGE });

    const storage = storageGroup(groups);
    expect(storage, 'Storage group must render when /discovery reports the canonical `storage` slot usable').toBeDefined();
    expect(storage!.endpoints.map(e => `${e.method} ${e.path}`)).toEqual([
      'POST /api/v1/storage/upload',
      'GET /api/v1/storage/:fileId',
      'DELETE /api/v1/storage/:fileId',
    ]);
  });

  // The v17 alias still resolves — a hard swap to `storage`-only would pass
  // the case above but fail this one, and would break this console against
  // any backend that has not deployed the #9683 mirror row yet.
  it('still renders the Storage group from the deprecated `file-storage` slot while the v17 alias lives', async () => {
    const groups = await groupsFor({ 'file-storage': USABLE_STORAGE });

    const storage = storageGroup(groups);
    expect(storage, 'Storage group must keep rendering against a backend that has not deployed the #9683 mirror row yet').toBeDefined();
    expect(storage!.endpoints.map(e => `${e.method} ${e.path}`)).toEqual([
      'POST /api/v1/storage/upload',
      'GET /api/v1/storage/:fileId',
      'DELETE /api/v1/storage/:fileId',
    ]);
  });

  // In production the two rows are byte-equal (the framework mirrors one
  // into the other), so this scenario cannot occur against a real backend —
  // it exists only to pin READ ORDER: canonical-first, not an OR/merge of
  // the two. A `file-storage`-first (or merged) lookup would read the
  // disabled row here and fail-close.
  it('reads the canonical `storage` slot before the deprecated one when both are present', async () => {
    const groups = await groupsFor({
      storage: USABLE_STORAGE,
      'file-storage': { enabled: false },
    });
    expect(storageGroup(groups), 'canonical `storage` must be read first, not merged with `file-storage`').toBeDefined();
  });

  it('honours the route /discovery advertises for the slot, not just the default', async () => {
    const groups = await groupsFor({
      'file-storage': { ...USABLE_STORAGE, route: '/api/v2/files' },
    });

    expect(storageGroup(groups)!.endpoints.map(e => e.path)).toEqual([
      '/api/v2/files/upload',
      '/api/v2/files/:fileId',
      '/api/v2/files/:fileId',
    ]);
  });
});

// Fail-closed control (ADR-0076 D12). Green both before and after the #4240
// fix: the posture was never the bug, the key was. These cases are what stops
// a future "just render it anyway" from passing as a fix for #4240.
describe('useApiDiscovery — fail-closed posture is preserved (ADR-0076 D12)', () => {
  it('hides the Storage group when the slot is absent from /discovery', async () => {
    expect(storageGroup(await groupsFor({ ai: { enabled: true } }))).toBeUndefined();
  });

  // Annotated rather than inferred: `it.each` widens heterogeneous tuples to a
  // union that includes `string`, which would make `entry` unassignable below.
  const notUsable: Array<[string, ServiceEntry]> = [
    ['enabled:false (not registered)', { enabled: false }],
    ['status unavailable', { enabled: true, status: 'unavailable' }],
    ['status stub (a dev fake is not the real service)', { enabled: true, status: 'stub', handlerReady: true }],
    ['handlerReady:false (route advertised, no real handler)', { enabled: true, handlerReady: false }],
  ];

  it.each(notUsable)('hides the Storage group when the slot is present but not usable — %s', async (_label, entry) => {
    expect(storageGroup(await groupsFor({ 'file-storage': entry }))).toBeUndefined();
  });

  it('still renders the group when the slot is degraded — a serving fallback must stay visible', async () => {
    const groups = await groupsFor({
      'file-storage': { enabled: true, status: 'degraded', handlerReady: true, route: '/api/v1/storage' },
    });
    expect(storageGroup(groups)?.endpoints).toHaveLength(3);
  });
});

/**
 * The tripwire (#4240 dispatch rider).
 *
 * The mis-key survived because nothing tied the catalog's keys to the
 * vocabulary they are spelled in. This block derives that vocabulary from
 * `@objectstack/spec` — the same package the framework declares it in — so a
 * rename on either side fails here rather than silently emptying a group.
 */
describe('SERVICE_ENDPOINT_CATALOG keys are canonical service-slot names', () => {
  const SLOTS = new Set<string>(CoreServiceName.options);

  it('the spec exports a usable slot vocabulary (guards the derivation itself)', () => {
    expect(SLOTS.size).toBeGreaterThan(5);
    expect(SLOTS.has('file-storage'), 'file-storage must be a declared CoreServiceName slot').toBe(true);
  });

  it('the storage group is keyed by the canonical slot name, not by its route', () => {
    expect(SERVICE_ENDPOINT_CATALOG['file-storage'], 'catalog must be keyed `file-storage`').toBeDefined();
    expect(SERVICE_ENDPOINT_CATALOG.storage, '`storage` is the ROUTE, never the slot key').toBeUndefined();
    expect(SERVICE_ENDPOINT_CATALOG['file-storage'].defaultRoute).toBe('/api/v1/storage');
  });

  it('every service-gated catalog key is a canonical slot', () => {
    const nonSlot = Object.keys(SERVICE_ENDPOINT_CATALOG).filter(k => !SLOTS.has(k));

    expect(
      nonSlot,
      'these catalog keys name no CoreServiceName slot, so /discovery can never report them '
        + 'and their groups will never render on any host — key them by the canonical slot name, '
        + 'or retire the entry',
    ).toEqual([]);
  });

  // #5286: the DISCOVERY LOOKUP already prefers the canonical `storage` wire
  // key (framework #9683) even though the catalog's own key vocabulary above
  // has not been re-keyed yet (see the comment on the `file-storage` catalog
  // entry in the source file). Pin the alias table directly rather than
  // through `CoreServiceName.options`, which does not yet list `storage` in
  // the locally pinned `@objectstack/spec` dependency — this assertion does
  // not depend on that dependency catching up.
  it('maps the deprecated `file-storage` catalog key to the canonical `storage` discovery key', () => {
    expect(DEPRECATED_SERVICE_SLOT_ALIASES['file-storage']).toBe('storage');
  });
});
