// Copyright (c) 2026 ObjectStack Inc. MIT.
import { describe, it, expect } from 'vitest';
import { resolveRowCrudAffordances } from '../rowCrudAffordances';

/** The row-level verdict only — drops the object-level bulk-delete bit. */
const rowGate = (opts: Parameters<typeof resolveRowCrudAffordances>[0]) => {
  const { canEdit, canDelete } = resolveRowCrudAffordances(opts);
  return { canEdit, canDelete };
};

describe('resolveRowCrudAffordances', () => {
  const wired = { operationsUpdate: true, operationsDelete: true, hasOnEdit: true, hasOnDelete: true };

  it('surfaces generic edit/delete by default (userActions undefined)', () => {
    expect(rowGate({ ...wired })).toEqual({ canEdit: true, canDelete: true });
  });

  it('keeps both when userActions explicitly true', () => {
    expect(rowGate({ ...wired, userActions: { edit: true, delete: true } }))
      .toEqual({ canEdit: true, canDelete: true });
  });

  it('suppresses generic edit/delete when the object opts out (userActions false)', () => {
    // sys_environment case: edit:false + delete:false → no generic kebab entries,
    // leaving only the object's dedicated Rename / Delete actions (no duplicate).
    expect(rowGate({ ...wired, userActions: { edit: false, delete: false } }))
      .toEqual({ canEdit: false, canDelete: false });
  });

  it('gates edit and delete independently', () => {
    expect(rowGate({ ...wired, userActions: { edit: false } }))
      .toEqual({ canEdit: false, canDelete: true });
    expect(rowGate({ ...wired, userActions: { delete: false } }))
      .toEqual({ canEdit: true, canDelete: false });
  });

  it('still requires the callback + operation to be wired (opt-out is not opt-in)', () => {
    expect(rowGate({ hasOnEdit: false, hasOnDelete: false, operationsUpdate: true, operationsDelete: true }))
      .toEqual({ canEdit: false, canDelete: false });
  });

  it('honors explicit rowActions (edit/delete strings) when callbacks exist', () => {
    expect(rowGate({ wantEditAction: true, wantDeleteAction: true, hasOnEdit: true, hasOnDelete: true }))
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
      expect(rowGate({ ...wired, userActions: { edit: { enabled: true }, delete: {} } }))
        .toEqual({ canEdit: true, canDelete: true });
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

    it('a server denial drops the predicates along with the affordance', () => {
      const res = resolveRowCrudAffordances({
        ...wired,
        userActions: { edit: { disabledWhen: 'record.frozen == true' } },
        effectiveApiOperations: ['get', 'list'],
      });
      expect(res.canEdit).toBe(false);
      expect(res.editPredicates).toBeUndefined();
    });
  });

  // [#3720] The fourth face of #3391: the row kebab intersects with the
  // server-resolved effective operation set (`/me/permissions` apiOperations),
  // matching the toolbar (objectui#2823), detail/form (#3546) and related-list
  // gates. Intersection, never union.
  describe('#3720 effective API operation set', () => {
    const FULL = ['get', 'list', 'create', 'update', 'delete'];

    it('keeps both entries when the effective set carries update + delete', () => {
      expect(rowGate({ ...wired, effectiveApiOperations: FULL }))
        .toEqual({ canEdit: true, canDelete: true });
    });

    it('hides both when the effective set is read-only', () => {
      expect(rowGate({ ...wired, effectiveApiOperations: ['get', 'list'] }))
        .toEqual({ canEdit: false, canDelete: false });
    });

    it('gates the two operations independently', () => {
      expect(rowGate({ ...wired, effectiveApiOperations: ['get', 'list', 'update'] }))
        .toEqual({ canEdit: true, canDelete: false });
      expect(rowGate({ ...wired, effectiveApiOperations: ['get', 'list', 'delete'] }))
        .toEqual({ canEdit: false, canDelete: true });
    });

    it('an empty effective set exposes nothing', () => {
      expect(rowGate({ ...wired, effectiveApiOperations: [] }))
        .toEqual({ canEdit: false, canDelete: false });
    });

    it('a missing effective set preserves the pre-#3720 behavior', () => {
      expect(rowGate({ ...wired, effectiveApiOperations: undefined }))
        .toEqual({ canEdit: true, canDelete: true });
      expect(rowGate({ ...wired, effectiveApiOperations: null }))
        .toEqual({ canEdit: true, canDelete: true });
    });

    it('intersects, never unions — a server grant cannot re-open a userActions opt-out', () => {
      expect(rowGate({ ...wired, userActions: { edit: false, delete: false }, effectiveApiOperations: FULL }))
        .toEqual({ canEdit: false, canDelete: false });
    });

    it('intersects, never unions — a userActions opt-in cannot survive a server denial', () => {
      expect(rowGate({ ...wired, userActions: { edit: true, delete: true }, effectiveApiOperations: ['get', 'list'] }))
        .toEqual({ canEdit: false, canDelete: false });
    });
  });

  // [#3720] The same chain never applied the ADR-0103 bucket lock either: the
  // module used to assume it arrived upstream via the view's `operations.*`,
  // but `operations` defaults to "whatever the consumer wired" and every main
  // list wires onEdit/onDelete unconditionally. Now it runs the shared policy.
  describe('#3720 ADR-0103 lifecycle bucket', () => {
    it('an absent managedBy resolves to the platform bucket (both entries on)', () => {
      expect(rowGate({ ...wired, managedBy: undefined }))
        .toEqual({ canEdit: true, canDelete: true });
    });

    it('config objects keep generic edit/delete', () => {
      expect(rowGate({ ...wired, managedBy: 'config' }))
        .toEqual({ canEdit: true, canDelete: true });
    });

    it.each(['system', 'engine-owned', 'append-only', 'better-auth'])(
      'engine-owned bucket %s hides generic edit/delete',
      (managedBy) => {
        expect(rowGate({ ...wired, managedBy })).toEqual({ canEdit: false, canDelete: false });
      },
    );

    it('a userActions opt-in re-opens a bucket-locked object (sys_user edit)', () => {
      expect(rowGate({ ...wired, managedBy: 'better-auth', userActions: { edit: true } }))
        .toEqual({ canEdit: true, canDelete: false });
    });

    it('the server effective set still clamps a bucket opt-in', () => {
      expect(rowGate({
        ...wired,
        managedBy: 'better-auth',
        userActions: { edit: true },
        effectiveApiOperations: ['get', 'list'],
      })).toEqual({ canEdit: false, canDelete: false });
    });
  });

  // [#3720] Bulk delete gates on the OBJECT verdict, not the row one: it rides
  // `onBulkDelete`, a different callback from the row `onDelete`.
  describe('#3720 objectCanDelete (the bulk-delete gate)', () => {
    it('stays true when the row callback is absent but the object allows delete', () => {
      const res = resolveRowCrudAffordances({ operationsUpdate: true, operationsDelete: true, hasOnDelete: false });
      expect(res.canDelete).toBe(false);
      expect(res.objectCanDelete).toBe(true);
    });

    it('follows the object verdict through every layer', () => {
      expect(resolveRowCrudAffordances({ ...wired, userActions: { delete: false } }).objectCanDelete).toBe(false);
      expect(resolveRowCrudAffordances({ ...wired, managedBy: 'append-only' }).objectCanDelete).toBe(false);
      expect(resolveRowCrudAffordances({ ...wired, effectiveApiOperations: ['get', 'list'] }).objectCanDelete).toBe(false);
      expect(resolveRowCrudAffordances({ ...wired, effectiveApiOperations: ['get', 'list', 'delete'] }).objectCanDelete).toBe(true);
    });
  });
});
