/**
 * importTargetFields — writable vs match-only derivation for the ImportWizard
 * (#020: "编号存在则更新" — the record number must be usable as an upsert match
 * key even though it is autonumber/readonly and therefore not writable).
 */
import { describe, it, expect } from 'vitest';
import { importTargetFields, type ImportFieldPerms } from './importTargetFields';

const fields = {
  code: { type: 'autonumber', label: '编号', required: true },
  name: { type: 'text', label: '名称', required: true },
  slot: { type: 'text', label: '机位号' },
  total: { type: 'formula', label: '合计' },
  child_sum: { type: 'summary', label: '子表合计' },
  locked_note: { type: 'text', label: '锁定备注', readonly: true },
};

const permsAllowing = (allow: (field: string, op: 'read' | 'write') => boolean): ImportFieldPerms => ({
  isLoaded: true,
  checkField: (_obj, field, op) => allow(field, op),
});

describe('importTargetFields', () => {
  it('keeps writable fields as write targets and marks autonumber/readonly as match-only', () => {
    const out = importTargetFields('device', fields);
    const byName = Object.fromEntries(out.map((f) => [f.name, f]));

    expect(byName.name).toMatchObject({ required: true });
    expect(byName.name.matchOnly).toBeUndefined();
    expect(byName.slot.matchOnly).toBeUndefined();

    // The record number is present again — but only for matching.
    expect(byName.code).toMatchObject({ matchOnly: true, type: 'autonumber' });
    expect(byName.locked_note).toMatchObject({ matchOnly: true });
    // A match-only column is never a required WRITE column, even when the
    // schema declares required (the runtime owns the value).
    expect(byName.code.required).toBe(false);
  });

  it('still drops computed fields — no storage column to match or write', () => {
    const out = importTargetFields('device', fields);
    const names = out.map((f) => f.name);
    expect(names).not.toContain('total');
    expect(names).not.toContain('child_sum');
  });

  it('match-only targets are gated on FLS read; write targets on FLS write', () => {
    // Reader who cannot write `name` and cannot read `locked_note`.
    const out = importTargetFields('device', fields, permsAllowing((field, op) =>
      op === 'write' ? field === 'slot' : field !== 'locked_note',
    ));
    const names = out.map((f) => f.name);
    expect(names).toContain('slot'); // writable
    expect(names).toContain('code'); // readable → match-only
    expect(names).not.toContain('locked_note'); // unreadable → gone entirely
    // `name` lost write access → degrades to a match-only (readable) target
    // rather than disappearing: it can still locate rows.
    expect(out.find((f) => f.name === 'name')).toMatchObject({ matchOnly: true, required: false });
  });

  it('without a loaded perms channel, falls back to schema-only derivation', () => {
    const out = importTargetFields('device', fields, { isLoaded: false, checkField: () => false });
    expect(out.map((f) => f.name).sort()).toEqual(
      ['code', 'locked_note', 'name', 'slot'],
    );
  });
});
