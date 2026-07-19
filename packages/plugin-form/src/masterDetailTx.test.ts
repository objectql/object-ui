import { describe, it, expect } from 'vitest';
import { diffRows, sumRows, idOf, isBlankRow, buildMasterDetailBatch, buildMasterDetailEditBatch } from './masterDetailTx';

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

  it('skips blank/ghost rows so an untouched trailing line never persists', () => {
    const ops = buildMasterDetailBatch(
      'inv',
      { name: 'INV-1' },
      [{ childObject: 'inv_line', relationshipField: 'invoice', rows: [
        { product: 'Widget', quantity: 2, amount: 20 },
        { product: null, quantity: null, amount: null }, // ghost — must be dropped
      ] }],
    );
    expect(ops).toHaveLength(2); // parent + the one real line only
    expect(ops[1].data).toMatchObject({ product: 'Widget', invoice: { $ref: 0 } });
  });
});

describe('isBlankRow', () => {
  it('treats a row as blank when only the FK / id keys carry values', () => {
    expect(isBlankRow({ product: null, amount: null, invoice: { $ref: 0 } }, 'invoice')).toBe(true);
    expect(isBlankRow({ id: 'x', product: '', amount: null }, 'invoice')).toBe(true);
  });
  it('is not blank when any business field has a value', () => {
    expect(isBlankRow({ product: 'Widget', amount: null }, 'invoice')).toBe(false);
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

  it('folds a caller-computed rollup into op 0 so it commits in the same batch (#2679)', () => {
    // Acceptance criterion: the rollup total is no longer a separate trailing
    // parent update — the caller sums the lines and passes it as a parent field,
    // and it rides in op 0 (the parent update) inside the same transaction.
    const rows = [{ id: 'l1', amount: 15 }, { amount: 30 }];
    const total = sumRows(rows, 'amount');
    const ops = buildMasterDetailEditBatch('po', 'p1', { total_amount: total }, [
      { childObject: 'po_line', relationshipField: 'po', rows, original: [{ id: 'l1', amount: 10 }] },
    ]);
    expect(ops[0]).toEqual({ object: 'po', action: 'update', id: 'p1', data: { total_amount: 45 } });
    // No separate parent update anywhere else in the batch.
    expect(ops.filter((o) => o.object === 'po')).toHaveLength(1);
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

// A line-item child schema mirroring the real fixture pattern: `amount` is a
// STORED currency column carrying an `expression` for live client recompute
// (persisted as-is, MUST survive sanitize), while `line_total` (summary) and
// `note_calc` (formula) are true computed types the server rejects on write.
const LINE_SCHEMA = {
  fields: {
    product: { type: 'text' },
    quantity: { type: 'number' },
    unit_price: { type: 'currency' },
    amount: { type: 'currency', expression: { dialect: 'cel', source: 'record.quantity * record.unit_price' } },
    line_total: { type: 'summary' },
    note_calc: { type: 'formula' },
    invoice: { type: 'master_detail' },
  },
};

describe('child payload sanitize (childSchema supplied)', () => {
  const dirtyRow = (over: Record<string, any> = {}) => ({
    product: 'Widget', quantity: 2, unit_price: 10, amount: 20,
    line_total: 20, note_calc: 'x', ...over,
  });

  it('buildMasterDetailBatch strips computed/server-managed child fields, keeps stored amount + FK', () => {
    const ops = buildMasterDetailBatch('invoice', { name: 'INV-1' }, [{
      childObject: 'inv_line', relationshipField: 'invoice',
      rows: [dirtyRow({ id: 'client-only' })],
      childSchema: LINE_SCHEMA,
    }]);
    // formula/summary + client-only id dropped; stored amount kept; FK is $ref.
    expect(ops[1].data).toEqual({
      product: 'Widget', quantity: 2, unit_price: 10, amount: 20, invoice: { $ref: 0 },
    });
  });

  it('buildMasterDetailEditBatch: update carries routing id but a sanitized data payload', () => {
    const ops = buildMasterDetailEditBatch('invoice', 'inv1', { name: 'INV-1' }, [{
      childObject: 'inv_line', relationshipField: 'invoice',
      rows: [dirtyRow({ id: 'l1', amount: 25 }), dirtyRow({ product: 'New', amount: 5 })],
      original: [{ id: 'l1', product: 'Widget', quantity: 1, unit_price: 10, amount: 10 }],
      childSchema: LINE_SCHEMA,
    }]);
    // op[0] is the PARENT update — scope to the child object for the line ops.
    const upd = ops.find((o) => o.object === 'inv_line' && o.action === 'update');
    // Routed by id; data has the FK + stored fields, NOT id/line_total/note_calc.
    expect(upd).toEqual({
      object: 'inv_line', action: 'update', id: 'l1',
      data: { product: 'Widget', quantity: 2, unit_price: 10, amount: 25, invoice: 'inv1' },
    });
    const cre = ops.find((o) => o.object === 'inv_line' && o.action === 'create');
    expect(cre!.data).toEqual({ product: 'New', quantity: 2, unit_price: 10, amount: 5, invoice: 'inv1' });
    expect(cre!.data).not.toHaveProperty('note_calc');
  });

  it('leaves rows untouched when no childSchema is supplied (backward compatible)', () => {
    const ops = buildMasterDetailBatch('invoice', { name: 'INV-1' }, [{
      childObject: 'inv_line', relationshipField: 'invoice',
      rows: [dirtyRow()],
    }]);
    // No schema → the computed columns pass through unchanged (prior behavior).
    expect(ops[1].data).toMatchObject({ line_total: 20, note_calc: 'x' });
  });
});
