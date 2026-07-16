// Copyright (c) 2026 ObjectStack Inc. MIT.
import { describe, it, expect } from 'vitest';
import { resolveRowCrudAffordances } from '../rowCrudAffordances';

describe('resolveRowCrudAffordances', () => {
  const wired = { operationsUpdate: true, operationsDelete: true, hasOnEdit: true, hasOnDelete: true };

  it('surfaces generic edit/delete by default (userActions undefined)', () => {
    expect(resolveRowCrudAffordances({ ...wired })).toEqual({ canEdit: true, canDelete: true });
  });

  it('keeps both when userActions explicitly true', () => {
    expect(resolveRowCrudAffordances({ ...wired, userActions: { edit: true, delete: true } }))
      .toEqual({ canEdit: true, canDelete: true });
  });

  it('suppresses generic edit/delete when the object opts out (userActions false)', () => {
    // sys_environment case: edit:false + delete:false → no generic kebab entries,
    // leaving only the object's dedicated Rename / Delete actions (no duplicate).
    expect(resolveRowCrudAffordances({ ...wired, userActions: { edit: false, delete: false } }))
      .toEqual({ canEdit: false, canDelete: false });
  });

  it('gates edit and delete independently', () => {
    expect(resolveRowCrudAffordances({ ...wired, userActions: { edit: false } }))
      .toEqual({ canEdit: false, canDelete: true });
    expect(resolveRowCrudAffordances({ ...wired, userActions: { delete: false } }))
      .toEqual({ canEdit: true, canDelete: false });
  });

  it('still requires the callback + operation to be wired (opt-out is not opt-in)', () => {
    expect(resolveRowCrudAffordances({ hasOnEdit: false, hasOnDelete: false, operationsUpdate: true, operationsDelete: true }))
      .toEqual({ canEdit: false, canDelete: false });
  });

  it('honors explicit rowActions (edit/delete strings) when callbacks exist', () => {
    expect(resolveRowCrudAffordances({ wantEditAction: true, wantDeleteAction: true, hasOnEdit: true, hasOnDelete: true }))
      .toEqual({ canEdit: true, canDelete: true });
  });

  describe('#2614 object form (per-record CEL predicates)', () => {
    it('passes visibleWhen/disabledWhen through untouched and keeps canEdit/canDelete on', () => {
      const res = resolveRowCrudAffordances({
        ...wired,
        userActions: {
          edit: { disabledWhen: 'record.frozen == true' },
          delete: { visibleWhen: { dialect: 'cel', source: 'record.frozen != true' } },
        },
      });
      expect(res.canEdit).toBe(true);
      expect(res.canDelete).toBe(true);
      expect(res.editPredicates).toEqual({ disabledWhen: 'record.frozen == true' });
      expect(res.deletePredicates).toEqual({ visibleWhen: { dialect: 'cel', source: 'record.frozen != true' } });
    });

    it('object form with enabled:false opts out like the bare boolean (and drops predicates)', () => {
      const res = resolveRowCrudAffordances({
        ...wired,
        userActions: { edit: { enabled: false, disabledWhen: 'record.frozen == true' } },
      });
      expect(res.canEdit).toBe(false);
      expect(res.editPredicates).toBeUndefined();
      expect(res.canDelete).toBe(true);
    });

    it('object form without predicates adds nothing (boolean-equivalent)', () => {
      const res = resolveRowCrudAffordances({ ...wired, userActions: { edit: { enabled: true }, delete: {} } });
      expect(res).toEqual({ canEdit: true, canDelete: true });
      expect(res.editPredicates).toBeUndefined();
      expect(res.deletePredicates).toBeUndefined();
    });

    it('predicates are not surfaced when the affordance is not wired at all', () => {
      const res = resolveRowCrudAffordances({
        hasOnEdit: false,
        operationsUpdate: true,
        userActions: { edit: { disabledWhen: 'record.frozen == true' } },
      });
      expect(res.canEdit).toBe(false);
      expect(res.editPredicates).toBeUndefined();
    });
  });
});
