// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useApiDiscovery — service-gated endpoint groups (#4240).
 *
 * ## The defect this file pins
 *
 * `SERVICE_ENDPOINT_CATALOG` keys are looked up straight in `/discovery`'s
 * `services` map, which the framework keys by `CoreServiceName`. The storage
 * group was keyed `storage`; the canonical slot is `file-storage`. So the
 * lookup missed on every host, and a miss is indistinguishable from "no such
 * service" — the deliberate fail-closed branch (ADR-0076 D12) then hid all
 * three storage endpoints everywhere, on every deployment, forever.
 *
 * That is the nastiest shape this page can fail in: fail-closed is *correct*
 * behaviour, so the symptom is silence rather than an error, and a mis-keyed
 * group is indistinguishable from a legitimately absent service.
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
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { CoreServiceName } from '@objectstack/spec/system';

import {
  useApiDiscovery,
  SERVICE_ENDPOINT_CATALOG,
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

describe('useApiDiscovery — the storage group (#4240)', () => {
  it('renders the Storage group with its 3 endpoints when /discovery reports the `file-storage` slot usable', async () => {
    const groups = await groupsFor({ 'file-storage': USABLE_STORAGE });

    const storage = storageGroup(groups);
    expect(storage, 'Storage group must render when the file-storage slot is filled and usable').toBeDefined();
    expect(storage!.endpoints.map(e => `${e.method} ${e.path}`)).toEqual([
      'POST /api/v1/storage/upload',
      'GET /api/v1/storage/:fileId',
      'DELETE /api/v1/storage/:fileId',
    ]);
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

  // The canonical name is the ONLY accepted spelling. A tolerant reader here
  // (accepting `storage` as well) would be a consumer-side workaround for a
  // producer-side vocabulary, and would re-hide the real defect the moment the
  // framework changed anything.
  it('does not resurrect the group from the legacy `storage` spelling', async () => {
    const groups = await groupsFor({ storage: USABLE_STORAGE });
    expect(storageGroup(groups)).toBeUndefined();
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
});
