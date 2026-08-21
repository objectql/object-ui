/**
 * objectui#5544 — `sys_user_preference` request budget across one console mount.
 *
 * ## What the card reported, and what this file actually pins
 *
 * The card measured a cold console load and grouped the resource timings by
 * `new URL(r.name).pathname`, reporting `/api/v1/data/sys_user_preference` ×3
 * on prod and ×6 on staging as duplicate requests. Those numbers are the
 * card's measurement against a deployed build — NOT taken here, and not
 * reproducible from this repo.
 *
 * Grouping by pathname is the trap. The console's per-user KV reads all share
 * one pathname and differ only in the `key` predicate, which rides in the
 * query string: `ConsoleShell`'s `UserStateBridge` attaches THREE adapters,
 * one per slot — `ui.favorites`, `ui.recent`, `ui.flow.palette.recents` — and
 * each is a distinct row in `sys_user_preference`. Three reads on a cold load
 * is therefore the correct budget, not a defect; a pathname-level count cannot
 * tell those three apart from the same read issued three times.
 *
 * ## Both directions, because a count assertion alone is not enough
 *
 * The card proposes "dedup at the request layer (in-flight requests sharing a
 * Promise per key)". That dedup already exists — `ObjectStackAdapter.find()`
 * coalesces on `resource + serialized params` — and the third case below pins
 * it. The hazard is a future "fix" that widens the coalescing key to the
 * ENDPOINT: it would collapse these three distinct reads into one and starve
 * two of the three consumers, while making a pathname-level count look
 * perfect. So this file pins the budget AND the payloads together:
 *
 * 1. exactly one read per distinct preference key across one mount, and
 * 2. every consumer still receives its own row.
 *
 * Assertion 2 is what fails on a naive endpoint-level dedup; assertion 1 is
 * what fails if a caller starts fetching twice.
 */

import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { ObjectStackAdapter, createObjectStackUserStateAdapter } from '@object-ui/data-objectstack';
import {
  UserStateAdaptersProvider,
  useAttachUserStateAdapters,
} from '../../context/UserStateAdapters';
import { FavoritesProvider, useFavorites } from '../../context/FavoritesProvider';
import { RecentItemsProvider, useRecentItems } from '../../context/RecentItemsProvider';
import {
  FlowPaletteRecentsProvider,
  useFlowPaletteRecents,
} from '../../context/FlowPaletteRecentsProvider';

/**
 * The three preference keys `ConsoleShell`'s `UserStateBridge` attaches on a
 * console boot. Kept in this order so a diff against that component reads
 * straight across.
 */
const FAVORITES_KEY = 'ui.favorites';
const RECENT_KEY = 'ui.recent';
const FLOW_KEY = 'ui.flow.palette.recents';

/** The row each key resolves to — distinct payloads, so a starved consumer shows up. */
const ROWS: Record<string, unknown[]> = {
  [FAVORITES_KEY]: [{ id: 'object:contact', label: 'Contact', href: '/contact', type: 'object' }],
  [RECENT_KEY]: [{ id: 'object:lead', label: 'Lead', href: '/lead', type: 'object' }],
  [FLOW_KEY]: ['flow_step_alpha'],
};

/** Pull the `key` predicate out of the adapter's serialized query options. */
function keyOf(opts: unknown): string {
  const filters = (opts as { filters?: unknown })?.filters;
  if (!Array.isArray(filters)) return '<no-key>';
  for (const part of filters) {
    if (Array.isArray(part) && part[0] === 'key') return String(part[2]);
  }
  return '<no-key>';
}

/**
 * A real `ObjectStackAdapter` over a counting transport stub. Every
 * `client.data.find` is recorded, so the assertions below count what would
 * have left the browser rather than what a component believes it asked for.
 */
function makeCountingAdapter(calls: { resource: string; key: string }[]) {
  const ds = new ObjectStackAdapter({
    baseUrl: 'http://test.local',
    fetch: vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, data: { capabilities: {}, routes: {} } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  }) as unknown as {
    connected: boolean;
    connectionState: string;
    client: unknown;
    find: (resource: string, params?: unknown) => Promise<unknown>;
  };
  ds.connected = true;
  ds.connectionState = 'connected';
  ds.client = {
    data: {
      find: async (resource: string, opts: unknown) => {
        const key = keyOf(opts);
        calls.push({ resource, key });
        // A real round-trip is not instantaneous; leaving a gap here is what
        // lets an in-flight coalescer be observed at all.
        await new Promise(resolve => setTimeout(resolve, 5));
        const value = ROWS[key];
        // The client SDK answers with `records`, which is what
        // `normalizeQueryResult` reads — `data` here would normalize to empty.
        if (!value) return { records: [], total: 0 };
        return { records: [{ id: `row-${key}`, user_id: 'u1', key, value }], total: 1 };
      },
    },
  };
  return ds;
}

/**
 * Mirrors `ConsoleShell`'s `UserStateBridge` effect body: one adapter per slot,
 * created once per (user, dataSource) and attached to the providers. The real
 * bridge is module-private to `ConsoleShell`, and exporting it purely for a
 * test would widen that module's public surface, so the effect is replicated
 * here with the same three keys.
 */
function BridgeReplica({ ds, userId }: { ds: unknown; userId: string }) {
  const attach = useAttachUserStateAdapters();
  useEffect(() => {
    if (!userId || !ds) return;
    const favorites = createObjectStackUserStateAdapter({
      dataSource: ds as never,
      userId,
      key: FAVORITES_KEY,
    });
    const recent = createObjectStackUserStateAdapter({
      dataSource: ds as never,
      userId,
      key: RECENT_KEY,
    });
    const flowPaletteRecents = createObjectStackUserStateAdapter<string>({
      dataSource: ds as never,
      userId,
      key: FLOW_KEY,
    });
    attach('favorites', favorites);
    attach('recent', recent);
    attach('flowPaletteRecents', flowPaletteRecents);
    return () => {
      attach('favorites', null);
      attach('recent', null);
      attach('flowPaletteRecents', null);
    };
  }, [userId, ds, attach]);
  return null;
}

interface Seen {
  favorites: string[];
  recent: string[];
  flow: string[];
}

/**
 * Module-scope holder, written from an effect and never from the render phase
 * — the same shape `MetadataProvider.requestBudget.test.tsx` uses. It is not a
 * prop, because writing through a prop is what the react-compiler rule refuses.
 */
const latest: { current: Seen } = { current: { favorites: [], recent: [], flow: [] } };

function resetSeen() {
  latest.current = { favorites: [], recent: [], flow: [] };
}

function Consumers() {
  const { favorites } = useFavorites();
  const { recentItems } = useRecentItems();
  const { recents } = useFlowPaletteRecents();
  useEffect(() => {
    latest.current = {
      favorites: favorites.map(f => f.id),
      recent: recentItems.map(r => r.id),
      flow: [...recents],
    };
  }, [favorites, recentItems, recents]);
  return <div data-testid="ready">ready</div>;
}

function mountConsoleUserState(ds: unknown) {
  return render(
    <UserStateAdaptersProvider>
      <FavoritesProvider>
        <RecentItemsProvider>
          <FlowPaletteRecentsProvider>
            <BridgeReplica ds={ds} userId="u1" />
            <Consumers />
          </FlowPaletteRecentsProvider>
        </RecentItemsProvider>
      </FavoritesProvider>
    </UserStateAdaptersProvider>,
  );
}

/** Let every pending microtask/timer drain so a LATE duplicate is still counted. */
async function settle() {
  await new Promise(resolve => setTimeout(resolve, 120));
}

describe('console sys_user_preference request budget (objectui#5544)', () => {
  it('reads each preference key exactly once across one mount', async () => {
    const calls: { resource: string; key: string }[] = [];
    resetSeen();
    mountConsoleUserState(makeCountingAdapter(calls));

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await settle();

    const prefCalls = calls.filter(c => c.resource === 'sys_user_preference');
    // One read per slot — three distinct keys, none of them fetched twice.
    expect(prefCalls.filter(c => c.key === FAVORITES_KEY)).toHaveLength(1);
    expect(prefCalls.filter(c => c.key === RECENT_KEY)).toHaveLength(1);
    expect(prefCalls.filter(c => c.key === FLOW_KEY)).toHaveLength(1);
    // …and nothing else reached the transport on this endpoint.
    expect(prefCalls.map(c => c.key).sort()).toEqual(
      [FAVORITES_KEY, FLOW_KEY, RECENT_KEY].sort(),
    );
  });

  it('delivers its own row to every consumer that was fetching one', async () => {
    const calls: { resource: string; key: string }[] = [];
    resetSeen();
    mountConsoleUserState(makeCountingAdapter(calls));

    // Three distinct payloads, three distinct consumers. Collapsing the three
    // reads into one (an endpoint-level dedup) starves two of them, and this
    // is the assertion that catches it.
    await waitFor(() => {
      expect(latest.current.favorites).toEqual(['object:contact']);
      expect(latest.current.recent).toEqual(['object:lead']);
      expect(latest.current.flow).toEqual(['flow_step_alpha']);
    });
  });

  it('coalesces two IDENTICAL in-flight reads into one round trip', async () => {
    // The dedup the card asks for already exists at the request layer:
    // `find()` shares one Promise per `resource + params`. Two adapters on the
    // same key issue one request and both still resolve with the row.
    const calls: { resource: string; key: string }[] = [];
    const ds = makeCountingAdapter(calls);
    const a = createObjectStackUserStateAdapter({
      dataSource: ds as never,
      userId: 'u1',
      key: FAVORITES_KEY,
    });
    const b = createObjectStackUserStateAdapter({
      dataSource: ds as never,
      userId: 'u1',
      key: FAVORITES_KEY,
    });

    const [first, second] = await Promise.all([a.load(), b.load()]);

    expect(calls.filter(c => c.key === FAVORITES_KEY)).toHaveLength(1);
    // Coalesced, not starved — both callers get the data.
    expect(first).toEqual([ROWS[FAVORITES_KEY][0]]);
    expect(second).toEqual([ROWS[FAVORITES_KEY][0]]);
  });
});
