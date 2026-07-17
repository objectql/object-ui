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

/**
 * Regression for #2582: a ModalForm over an object WITH subforms delegates to
 * MasterDetailForm, which persists parent + child rows through ONE
 * `batchTransaction` (`POST /api/v1/batch`). That path never emitted
 * MutationEvents, so the related list and the "相关" tab count badge stayed
 * stale after a successful create/edit until a full page reload. The adapter
 * must emit one event per committed operation — and nothing when the
 * transaction failed (it rolled back entirely).
 */
describe('ObjectStackAdapter.batchTransaction mutation events', () => {
  function makeBatchDS(responder: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
    const ds: any = new ObjectStackAdapter({
      baseUrl: 'http://test.local',
      fetch: vi.fn(responder),
    });
    ds.connected = true;
    ds.connectionState = 'connected';
    return ds;
  }

  it('emits one event per op after a committed master-detail CREATE batch', async () => {
    const ds = makeBatchDS(async () =>
      new Response(
        JSON.stringify({
          results: [
            { id: 'p1', name: 'Task version A' },
            { id: 'c1', task: 'p1', label: 'Check item 1' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.batchTransaction([
      { object: 'ehr_task_version', action: 'create', data: { name: 'Task version A' } },
      { object: 'ehr_task_check_item', action: 'create', data: { task: { $ref: 0 }, label: 'Check item 1' } },
    ]);

    expect(events).toEqual([
      { type: 'create', resource: 'ehr_task_version', record: { id: 'p1', name: 'Task version A' } },
      { type: 'create', resource: 'ehr_task_check_item', record: { id: 'c1', task: 'p1', label: 'Check item 1' } },
    ]);
  });

  it('emits update/create/delete events after a committed master-detail EDIT batch', async () => {
    const ds = makeBatchDS(async () =>
      new Response(
        JSON.stringify({
          results: [{ id: 'p1' }, { id: 'c-new' }, { id: 'c1' }, { deleted: true }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.batchTransaction([
      { object: 'ehr_task_version', action: 'update', id: 'p1', data: { name: 'Renamed' } },
      { object: 'ehr_task_check_item', action: 'create', data: { task: 'p1' } },
      { object: 'ehr_task_check_item', action: 'update', id: 'c1', data: { label: 'Edited' } },
      { object: 'ehr_task_check_item', action: 'delete', id: 'c2' },
    ]);

    expect(events).toEqual([
      { type: 'update', resource: 'ehr_task_version', id: 'p1', record: { id: 'p1' } },
      { type: 'create', resource: 'ehr_task_check_item', record: { id: 'c-new' } },
      { type: 'update', resource: 'ehr_task_check_item', id: 'c1', record: { id: 'c1' } },
      { type: 'delete', resource: 'ehr_task_check_item', id: 'c2' },
    ]);
  });

  it('treats an op without an explicit action as a create (the server default)', async () => {
    const ds = makeBatchDS(async () =>
      new Response(JSON.stringify({ results: [{ id: 'p1' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.batchTransaction([{ object: 'ehr_task_version', data: { name: 'X' } }]);

    expect(events).toEqual([
      { type: 'create', resource: 'ehr_task_version', record: { id: 'p1' } },
    ]);
  });

  it('emits NOTHING when the batch failed — the transaction rolled back', async () => {
    const ds = makeBatchDS(async () =>
      new Response(JSON.stringify({ error: 'validation failed' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await expect(
      ds.batchTransaction([{ object: 'ehr_task_version', action: 'create', data: {} }]),
    ).rejects.toThrow('validation failed');

    expect(events).toEqual([]);
  });
});

/**
 * Regression for #2582 (fallback path): when the server lacks the transactional
 * batch endpoint, MasterDetailForm persists child rows via `bulk(child,
 * 'create', rows)` (applyDetail → createMany). `bulk` only emitted progress
 * events, so those writes were equally invisible to the invalidation bus. Each
 * branch now emits ONE resource-level event, matching bulkUpdate/bulkDelete.
 */
describe('ObjectStackAdapter.bulk mutation events', () => {
  it('emits a single create event per bulk create call', async () => {
    const createMany = vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    const ds = makeDS({ createMany });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.bulk('ehr_task_check_item', 'create', [{ label: 'a' }, { label: 'b' }]);

    expect(events).toEqual([{ type: 'create', resource: 'ehr_task_check_item' }]);
  });

  it('does not emit when a bulk create returned zero records', async () => {
    const createMany = vi.fn().mockResolvedValue([]);
    const ds = makeDS({ createMany });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.bulk('ehr_task_check_item', 'create', [{ label: 'a' }]);

    expect(events).toEqual([]);
  });

  it('emits a single delete event per bulk delete call', async () => {
    const deleteMany = vi.fn().mockResolvedValue(undefined);
    const ds = makeDS({ deleteMany });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.bulk('ehr_task_check_item', 'delete', [{ id: 'c1' }, { id: 'c2' }] as any);

    expect(events).toEqual([{ type: 'delete', resource: 'ehr_task_check_item' }]);
  });

  it('emits a single update event per bulk update call', async () => {
    const updateMany = vi.fn().mockResolvedValue([{ id: 'c1' }]);
    const ds = makeDS({ updateMany });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await ds.bulk('ehr_task_check_item', 'update', [{ id: 'c1', label: 'x' }] as any);

    expect(events).toEqual([{ type: 'update', resource: 'ehr_task_check_item' }]);
  });

  it('bulk create failure emits nothing', async () => {
    const createMany = vi.fn().mockRejectedValue(new Error('boom'));
    const ds = makeDS({ createMany });
    const events: MutationEvent[] = [];
    ds.onMutation((e: MutationEvent) => events.push(e));

    await expect(ds.bulk('ehr_task_check_item', 'create', [{ label: 'a' }])).rejects.toThrow();

    expect(events).toEqual([]);
  });
});
