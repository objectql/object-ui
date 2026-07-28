/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectStackAdapter must surface the framework's write-observability channel
 * (#3431/#3455): when a create/update response carries `droppedFields` — fields
 * the backend LEGALLY stripped (read-only / locked-by-state) — the adapter emits
 * a WriteWarningEvent so the app shell can toast the user instead of letting the
 * dropped value vanish silently. The write itself still succeeded.
 */
import { describe, it, expect, vi } from 'vitest';
import { ObjectStackAdapter } from './index';
import type { WriteWarningEvent } from './index';

function makeDS(stub: Record<string, any>) {
  const ds: any = new ObjectStackAdapter({
    baseUrl: 'http://test.local',
    fetch: vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { capabilities: {}, routes: {} } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  });
  ds.connected = true;
  ds.connectionState = 'connected';
  ds.client = { data: stub };
  return ds;
}

const ONE_DROP = [{ object: 'approval_case', fields: ['approval_status'], reason: 'readonly' }];

describe('ObjectStackAdapter.onWriteWarning', () => {
  it('emits a create write-warning carrying the dropped fields and the new id', async () => {
    const create = vi.fn().mockResolvedValue({ record: { id: 'r1', title: 'A' }, droppedFields: ONE_DROP });
    const ds = makeDS({ create });
    const events: WriteWarningEvent[] = [];
    ds.onWriteWarning((e: WriteWarningEvent) => events.push(e));

    const rec = await ds.create('approval_case', { title: 'A', approval_status: 'approved' });

    // The write still returns the plain record (unchanged behaviour).
    expect(rec).toEqual({ id: 'r1', title: 'A' });
    expect(events).toEqual([
      { operation: 'create', resource: 'approval_case', id: 'r1', droppedFields: ONE_DROP },
    ]);
  });

  it('emits an update write-warning carrying the target id', async () => {
    const update = vi.fn().mockResolvedValue({ record: { id: 'r1' }, droppedFields: ONE_DROP });
    const ds = makeDS({ update });
    const events: WriteWarningEvent[] = [];
    ds.onWriteWarning((e: WriteWarningEvent) => events.push(e));

    await ds.update('approval_case', 'r1', { approval_status: 'approved' });

    expect(events).toEqual([
      { operation: 'update', resource: 'approval_case', id: 'r1', droppedFields: ONE_DROP },
    ]);
  });

  it('does NOT emit when the response carries no droppedFields (the common case)', async () => {
    const create = vi.fn().mockResolvedValue({ record: { id: 'r1', title: 'A' } });
    const update = vi.fn().mockResolvedValue({ record: { id: 'r1' } });
    const ds = makeDS({ create, update });
    const events: WriteWarningEvent[] = [];
    ds.onWriteWarning((e: WriteWarningEvent) => events.push(e));

    await ds.create('approval_case', { title: 'A' });
    await ds.update('approval_case', 'r1', { title: 'B' });

    expect(events).toEqual([]);
  });

  it('does NOT emit for an empty or malformed droppedFields payload', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ record: { id: 'r1' }, droppedFields: [] })
      .mockResolvedValueOnce({ record: { id: 'r2' }, droppedFields: 'nope' })
      .mockResolvedValueOnce({ record: { id: 'r3' }, droppedFields: [{ object: 'x', fields: [] }] });
    const ds = makeDS({ create });
    const events: WriteWarningEvent[] = [];
    ds.onWriteWarning((e: WriteWarningEvent) => events.push(e));

    await ds.create('x', {});
    await ds.create('x', {});
    await ds.create('x', {}); // event present but its fields[] is empty → filtered out

    expect(events).toEqual([]);
  });

  // ── cross-object batch (framework #3794) ─────────────────────────────────
  //
  // `batchTransaction` is the console record form's save path for a
  // master-detail record, so this is where a `readonlyWhen` strip actually
  // reaches a user editing a form. Its response tags each event with the index
  // of the operation that produced it.

  it('emits a write-warning per event on a cross-object batch, resolving the op', async () => {
    const batchTransaction = vi.fn().mockResolvedValue({
      results: [{ id: 'acc1' }, { id: 'inv1' }],
      droppedFields: [
        { object: 'invoice', fields: ['tax_rate'], reason: 'readonly_when', index: 1 },
      ],
    });
    const ds = makeDS({ batchTransaction });
    ds.atomicBatchCapability = true;
    const events: WriteWarningEvent[] = [];
    ds.onWriteWarning((e: WriteWarningEvent) => events.push(e));

    await ds.batchTransaction([
      { object: 'account', action: 'create', data: { name: 'Acme' } },
      { object: 'invoice', action: 'update', id: 'inv1', data: { status: 'paid', tax_rate: 9 } },
    ]);

    expect(events).toEqual([
      {
        operation: 'update',
        resource: 'invoice',
        id: 'inv1',
        droppedFields: [{ object: 'invoice', fields: ['tax_rate'], reason: 'readonly_when' }],
      },
    ]);
  });

  it('does NOT emit for a clean batch or a malformed droppedFields list', async () => {
    const batchTransaction = vi
      .fn()
      .mockResolvedValueOnce({ results: [{ id: 'a' }] })
      .mockResolvedValueOnce({ results: [{ id: 'a' }], droppedFields: [{ object: 'x', fields: [], index: 0 }] });
    const ds = makeDS({ batchTransaction });
    ds.atomicBatchCapability = true;
    const events: WriteWarningEvent[] = [];
    ds.onWriteWarning((e: WriteWarningEvent) => events.push(e));

    await ds.batchTransaction([{ object: 'x', action: 'create', data: {} }]);
    await ds.batchTransaction([{ object: 'x', action: 'create', data: {} }]);

    expect(events).toEqual([]);
  });

  it('stops delivering after unsubscribe', async () => {
    const create = vi.fn().mockResolvedValue({ record: { id: 'r1' }, droppedFields: ONE_DROP });
    const ds = makeDS({ create });
    const events: WriteWarningEvent[] = [];
    const unsub = ds.onWriteWarning((e: WriteWarningEvent) => events.push(e));

    await ds.create('approval_case', {});
    unsub();
    await ds.create('approval_case', {});

    expect(events).toHaveLength(1);
  });

  it('isolates a throwing listener so the write still resolves and other listeners fire', async () => {
    const update = vi.fn().mockResolvedValue({ record: { id: 'r1' }, droppedFields: ONE_DROP });
    const ds = makeDS({ update });
    const good = vi.fn();
    ds.onWriteWarning(() => { throw new Error('boom'); });
    ds.onWriteWarning(good);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(ds.update('approval_case', 'r1', { approval_status: 'x' })).resolves.toBeTruthy();
    expect(good).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
