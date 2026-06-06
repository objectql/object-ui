import { describe, it, expect, vi } from 'vitest';
import { diffRows, sumRows, applyDetail, idOf, buildMasterDetailBatch, buildMasterDetailEditBatch } from './masterDetailTx';

describe('buildMasterDetailBatch — atomic master-detail ops', () => {
  it('puts the parent first and references it via $ref:0 on each child FK', () => {
    const ops = buildMasterDetailBatch(
      'expense_claim',
      { title: 'Trip', total_amount: 42 },
      [{ childObject: 'expense_line', relationshipField: 'expense_claim', rows: [{ amount: 10 }, { amount: 32 }] }],
    );
    expect(ops).toEqual([
      { object: 'expense_claim', action: 'create', data: { title: 'Trip', total_amount: 42 } },
      { object: 'expense_line', action: 'create', data: { amount: 10, expense_claim: { $ref: 0 } } },
      { object: 'expense_line', action: 'create', data: { amount: 32, expense_claim: { $ref: 0 } } },
    ]);
  });

  it('handles a parent with no children', () => {
    const ops = buildMasterDetailBatch('p', { name: 'x' }, [{ childObject: 'c', relationshipField: 'p', rows: [] }]);
    expect(ops).toHaveLength(1);
    expect(ops[0].object).toBe('p');
  });
});

describe('buildMasterDetailEditBatch — atomic master-detail edit ops', () => {
  it('updates the parent then diffs children into create/update/delete', () => {
    const ops = buildMasterDetailEditBatch(
      'po',
      'p1',
      { status: 'open', total_amount: 45 },
      [
        {
          childObject: 'po_line',
          relationshipField: 'po',
          rows: [{ id: 'l1', amount: 15 }, { amount: 30 }], // l1 edited, one new, l2 removed
          original: [{ id: 'l1', amount: 10 }, { id: 'l2', amount: 20 }],
        },
      ],
    );
    expect(ops).toEqual([
      { object: 'po', action: 'update', id: 'p1', data: { status: 'open', total_amount: 45 } },
      { object: 'po_line', action: 'create', data: { amount: 30, po: 'p1' } },
      { object: 'po_line', action: 'update', id: 'l1', data: { id: 'l1', amount: 15, po: 'p1' } },
      { object: 'po_line', action: 'delete', id: 'l2' },
    ]);
  });

  it('emits only the parent update when children are unchanged', () => {
    const rows = [{ id: 'l1', amount: 10 }];
    const ops = buildMasterDetailEditBatch('po', 'p1', { status: 'open' }, [
      { childObject: 'po_line', relationshipField: 'po', rows, original: [{ id: 'l1', amount: 10 }] },
    ]);
    // parent update + l1 update (rows with ids always re-update; no creates/deletes)
    expect(ops[0]).toEqual({ object: 'po', action: 'update', id: 'p1', data: { status: 'open' } });
    expect(ops.filter((o) => o.action === 'delete')).toHaveLength(0);
    expect(ops.filter((o) => o.action === 'create')).toHaveLength(0);
  });
});

describe('masterDetailTx — pure helpers', () => {
  it('idOf reads id / _id / recordId', () => {
    expect(idOf({ id: 'a' })).toBe('a');
    expect(idOf({ _id: 'b' })).toBe('b');
    expect(idOf({ recordId: 'c' })).toBe('c');
    expect(idOf({})).toBeUndefined();
    expect(idOf(null)).toBeUndefined();
  });

  it('sumRows sums a numeric column, ignoring blanks/NaN', () => {
    expect(sumRows([{ amount: 10 }, { amount: 20.5 }, { amount: null }, { amount: 'x' }], 'amount')).toBe(30.5);
    expect(sumRows([], 'amount')).toBe(0);
    expect(sumRows(undefined as any, 'amount')).toBe(0);
  });

  it('diffRows classifies create / update / delete', () => {
    const original = [{ id: 'l1', amount: 10 }, { id: 'l2', amount: 20 }];
    const current = [{ id: 'l1', amount: 15 }, { amount: 30 }]; // l2 removed, one new
    const d = diffRows(original, current);
    expect(d.toUpdate).toEqual([{ id: 'l1', amount: 15 }]);
    expect(d.toCreate).toEqual([{ amount: 30 }]);
    expect(d.toDelete).toEqual(['l2']);
  });
});

function mockDataSource(overrides: any = {}) {
  return {
    create: vi.fn(async (_obj: string, data: any) => ({ id: 'new-' + Math.random().toString(36).slice(2, 7), ...data })),
    update: vi.fn(async (_obj: string, id: string, data: any) => ({ id, ...data })),
    delete: vi.fn(async () => true),
    bulk: vi.fn(async (_obj: string, _op: string, rows: any[]) => rows.map((r, i) => ({ id: 'b' + i, ...r }))),
    ...overrides,
  } as any;
}

describe('applyDetail — client-orchestrated child write', () => {
  it('create mode: sets FK, bulk-creates children, rolls up the total', async () => {
    const ds = mockDataSource();
    const res = await applyDetail(ds, 'expense_claim', 'claim_1', {
      childObject: 'expense_line',
      relationshipField: 'expense_claim',
      rows: [{ amount: 10 }, { amount: 32.5 }],
      amountField: 'amount',
      totalField: 'total_amount',
    });

    // FK injected on every row, single bulk call
    expect(ds.bulk).toHaveBeenCalledTimes(1);
    expect(ds.bulk).toHaveBeenCalledWith('expense_line', 'create', [
      { amount: 10, expense_claim: 'claim_1' },
      { amount: 32.5, expense_claim: 'claim_1' },
    ]);
    // rollup written onto the parent
    expect(ds.update).toHaveBeenCalledWith('expense_claim', 'claim_1', { total_amount: 42.5 });
    // created ids surfaced for cleanup
    expect(res.created).toEqual([
      { object: 'expense_line', id: 'b0' },
      { object: 'expense_line', id: 'b1' },
    ]);
  });

  it('tolerates a bulk() that returns {records:[...]} instead of an array', async () => {
    // Mirrors the real ObjectStack adapter, whose createMany can resolve to a
    // wrapped shape rather than a bare array (regression: "newRecords is not iterable").
    const ds = mockDataSource({
      bulk: vi.fn(async (_o: string, _op: string, rows: any[]) => ({
        records: rows.map((r, i) => ({ id: 'w' + i, ...r })),
      })),
    });
    const res = await applyDetail(ds, 'expense_claim', 'claim_1', {
      childObject: 'expense_line',
      relationshipField: 'expense_claim',
      rows: [{ amount: 10 }, { amount: 5 }],
      amountField: 'amount',
      totalField: 'total_amount',
    });
    expect(res.created).toEqual([
      { object: 'expense_line', id: 'w0' },
      { object: 'expense_line', id: 'w1' },
    ]);
    expect(ds.update).toHaveBeenCalledWith('expense_claim', 'claim_1', { total_amount: 15 });
  });

  it('create mode without bulk falls back to per-row create', async () => {
    const ds = mockDataSource({ bulk: undefined });
    await applyDetail(ds, 'po', 'po_1', {
      childObject: 'po_line',
      relationshipField: 'po',
      rows: [{ qty: 1 }, { qty: 2 }],
    });
    expect(ds.create).toHaveBeenCalledTimes(2);
    expect(ds.create).toHaveBeenCalledWith('po_line', { qty: 1, po: 'po_1' });
    expect(ds.create).toHaveBeenCalledWith('po_line', { qty: 2, po: 'po_1' });
  });

  it('edit mode: creates new, updates changed, deletes removed', async () => {
    const ds = mockDataSource();
    await applyDetail(ds, 'expense_claim', 'claim_1', {
      childObject: 'expense_line',
      relationshipField: 'expense_claim',
      original: [{ id: 'l1', amount: 10 }, { id: 'l2', amount: 20 }],
      rows: [{ id: 'l1', amount: 15 }, { amount: 30 }], // edit l1, drop l2, add one
      amountField: 'amount',
      totalField: 'total_amount',
    });

    // new row created (with FK)
    expect(ds.bulk).toHaveBeenCalledWith('expense_line', 'create', [{ amount: 30, expense_claim: 'claim_1' }]);
    // changed row updated (with FK)
    expect(ds.update).toHaveBeenCalledWith('expense_line', 'l1', { id: 'l1', amount: 15, expense_claim: 'claim_1' });
    // removed row deleted
    expect(ds.delete).toHaveBeenCalledWith('expense_line', 'l2');
    // rollup reflects the current rows (15 + 30 = 45)
    expect(ds.update).toHaveBeenCalledWith('expense_claim', 'claim_1', { total_amount: 45 });
  });

  it('skips rollup when no totalField is configured', async () => {
    const ds = mockDataSource();
    await applyDetail(ds, 'expense_claim', 'claim_1', {
      childObject: 'expense_line',
      relationshipField: 'expense_claim',
      rows: [{ amount: 10 }],
    });
    // only the bulk create — no parent update
    expect(ds.update).not.toHaveBeenCalled();
  });
});
