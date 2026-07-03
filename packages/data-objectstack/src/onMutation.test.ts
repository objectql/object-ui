/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression: ObjectStackAdapter must implement `onMutation` and emit an event
 * after every successful create/update/delete (and bulk variant).
 *
 * Real-world symptom (framework app-showcase): inline-edit a grid cell, click
 * "全部保存" (Save All) — the write persisted but the list did NOT auto-refresh.
 * ListView auto-refreshes by subscribing to `dataSource.onMutation`; the
 * ObjectStack adapter never implemented it, so the per-row `update` writes
 * issued by ObjectGrid's default batch-save were silent and the grid kept
 * showing stale rows until a manual reload.
 */
import { describe, it, expect, vi } from 'vitest';
import { ObjectStackAdapter } from './index';
import type { MutationEvent } from '@object-ui/types';

function makeDS(stub: Record<string, any>) {
  const ds: any = new ObjectStackAdapter({
    baseUrl: 'http://test.local',
    fetch: vi.fn(async () => {
      const body = { success: true, data: { capabilities: {}, routes: {} } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  });
  ds.connected = true;
  ds.connectionState = 'connected';
  ds.client = { data: stub };
  return ds;
}

describe('ObjectStackAdapter.onMutation', () => {
  it('emits an update event after a successful update (the inline-edit save path)', async () => {
    const update = vi
      .fn()
      .mockResolvedValue({ record: { id: 'r1', account: 'acc-1' } });
    const ds = makeDS({ update });

    const events: MutationEvent[] = [];
    const unsub = ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.update('showcase_project', 'r1', { account: 'acc-1' });

    expect(events).toEqual([
      { type: 'update', resource: 'showcase_project', id: 'r1', record: { id: 'r1', account: 'acc-1' } },
    ]);

    // Unsubscribe stops delivery.
    unsub();
    await ds.update('showcase_project', 'r1', { account: 'acc-2' });
    expect(events).toHaveLength(1);
  });

  it('emits a create event with the new record', async () => {
    const create = vi.fn().mockResolvedValue({ record: { id: 'new', name: 'X' } });
    const ds = makeDS({ create });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.create('showcase_project', { name: 'X' });

    expect(events).toEqual([
      { type: 'create', resource: 'showcase_project', record: { id: 'new', name: 'X' } },
    ]);
  });

  it('emits a delete event only when the server confirms deletion', async () => {
    const del = vi
      .fn()
      .mockResolvedValueOnce({ deleted: true })
      .mockResolvedValueOnce({ deleted: false });
    const ds = makeDS({ delete: del });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.delete('showcase_project', 'r1');
    await ds.delete('showcase_project', 'r2');

    expect(events).toEqual([
      { type: 'delete', resource: 'showcase_project', id: 'r1' },
    ]);
  });

  it('emits a single bulk event per bulkUpdate call (not per id)', async () => {
    const updateMany = vi.fn().mockResolvedValue({ succeeded: 3, failed: 0, results: [] });
    const ds = makeDS({ updateMany });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.bulkUpdate('showcase_project', ['a', 'b', 'c'], { archived: true });

    expect(events).toEqual([{ type: 'update', resource: 'showcase_project' }]);
  });

  it('does not emit when a bulk operation affected zero rows', async () => {
    const updateMany = vi.fn().mockResolvedValue({ succeeded: 0, failed: 0, results: [] });
    const ds = makeDS({ updateMany });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.bulkUpdate('showcase_project', ['a'], { archived: true });

    expect(events).toEqual([]);
  });

  it('isolates a throwing listener so the mutation still resolves and others fire', async () => {
    const update = vi.fn().mockResolvedValue({ record: { id: 'r1' } });
    const ds = makeDS({ update });
    const good = vi.fn();
    ds.onMutation(() => { throw new Error('boom'); });
    ds.onMutation(good);

    await expect(ds.update('showcase_project', 'r1', { x: 1 })).resolves.toBeTruthy();
    expect(good).toHaveBeenCalledTimes(1);
  });
});
