import { describe, it, expect } from 'vitest';
import { MANAGED_BY_BUCKETS } from '@object-ui/types';
import {
  resolveCrudAffordances,
  isWriteOptedIn,
  isSystemWritable,
  isObjectInlineEditable,
  normalizeUserAction,
  userActionPredicates,
} from './managedBy';

describe('resolveCrudAffordances (shared source of truth)', () => {
  it('defaults to the platform bucket (full CRUD) when managedBy is unset', () => {
    expect(resolveCrudAffordances({})).toEqual({
      create: true, import: true, edit: true, delete: true, exportCsv: true,
    });
    expect(resolveCrudAffordances(null)).toEqual(resolveCrudAffordances({ managedBy: 'platform' }));
  });

  it('config: New/Edit/Delete + export, no import', () => {
    expect(resolveCrudAffordances({ managedBy: 'config' })).toEqual({
      create: true, import: false, edit: true, delete: true, exportCsv: true,
    });
  });

  it('system / engine-owned / append-only / better-auth: export-only by default', () => {
    for (const managedBy of ['system', 'engine-owned', 'append-only', 'better-auth']) {
      expect(resolveCrudAffordances({ managedBy })).toEqual({
        create: false, import: false, edit: false, delete: false, exportCsv: true,
      });
    }
  });

  it('userActions overrides the bucket default (ADR-0103 writable system)', () => {
    const aff = resolveCrudAffordances({ managedBy: 'system', userActions: { create: true, edit: true, delete: true } });
    expect(aff).toMatchObject({ create: true, edit: true, delete: true, import: false });
  });

  it('unknown bucket falls back to platform (defensive)', () => {
    expect(resolveCrudAffordances({ managedBy: 'totally-unknown' }).edit).toBe(true);
  });

  it('#2614 object form: carries predicates, keys off enabled, boolean path unchanged', () => {
    const withPreds = resolveCrudAffordances({
      managedBy: 'platform',
      userActions: { edit: { enabled: true, disabledWhen: 'record.locked == true' } },
    });
    expect(withPreds.edit).toBe(true);
    expect(withPreds.editPredicates).toEqual({ disabledWhen: 'record.locked == true' });
    // enabled omitted → falls back to the bucket default (platform edit = true)
    expect(resolveCrudAffordances({ managedBy: 'platform', userActions: { edit: { disabledWhen: 'x' } } }).edit).toBe(true);
    // boolean form leaves predicates absent
    expect(resolveCrudAffordances({ managedBy: 'system', userActions: { edit: true } }).editPredicates).toBeUndefined();
  });
});

describe('isWriteOptedIn', () => {
  it('true only for boolean true or { enabled: true }', () => {
    expect(isWriteOptedIn(true)).toBe(true);
    expect(isWriteOptedIn({ enabled: true })).toBe(true);
    expect(isWriteOptedIn(false)).toBe(false);
    expect(isWriteOptedIn({ enabled: false })).toBe(false);
    expect(isWriteOptedIn({ disabledWhen: 'x' })).toBe(false);
    expect(isWriteOptedIn(undefined)).toBe(false);
    expect(isWriteOptedIn(null)).toBe(false);
  });
});

describe('isSystemWritable (ADR-0103)', () => {
  it('true only for a system object that opened create, edit, or delete', () => {
    expect(isSystemWritable({ managedBy: 'system', userActions: { create: true } })).toBe(true);
    expect(isSystemWritable({ managedBy: 'system', userActions: { edit: { enabled: true } } })).toBe(true);
    expect(isSystemWritable({ managedBy: 'system', userActions: { delete: true } })).toBe(true);
  });
  it('false for engine-owned system and for other buckets even with userActions', () => {
    expect(isSystemWritable({ managedBy: 'system' })).toBe(false);
    expect(isSystemWritable({ managedBy: 'system', userActions: { edit: false } })).toBe(false);
    // append-only / better-auth are never "system-writable" regardless of userActions
    expect(isSystemWritable({ managedBy: 'append-only', userActions: { create: true } })).toBe(false);
    expect(isSystemWritable({ managedBy: 'better-auth', userActions: { edit: true } })).toBe(false);
    expect(isSystemWritable({ managedBy: 'platform' })).toBe(false);
    expect(isSystemWritable(null)).toBe(false);
  });
});

describe('isObjectInlineEditable', () => {
  it('mirrors the resolved edit affordance (replaces the old NON_EDITABLE_BUCKETS set)', () => {
    // Non-editable buckets by default...
    for (const managedBy of ['system', 'engine-owned', 'append-only', 'better-auth']) {
      expect(isObjectInlineEditable({ managedBy })).toBe(false);
    }
    // ...editable buckets and opened-up system objects.
    expect(isObjectInlineEditable({ managedBy: 'platform' })).toBe(true);
    expect(isObjectInlineEditable({ managedBy: 'config' })).toBe(true);
    expect(isObjectInlineEditable({ managedBy: 'system', userActions: { edit: true } })).toBe(true);
    // an explicit edit:false disables even on an otherwise-editable bucket
    expect(isObjectInlineEditable({ managedBy: 'platform', userActions: { edit: false } })).toBe(false);
  });
});

// The ONE parser for the userActions override shape, now consumed by the grid
// row affordances and related-list row predicates (objectui#2712 follow-up) so
// no package re-implements the boolean / #2614 object-form parse locally.
describe('normalizeUserAction (the single override parser)', () => {
  it('a missing flag falls back to the caller-supplied bucket default', () => {
    expect(normalizeUserAction(undefined, true)).toEqual({ enabled: true });
    expect(normalizeUserAction(undefined, false)).toEqual({ enabled: false });
    expect(normalizeUserAction(null, true)).toEqual({ enabled: true });
  });

  it('a bare boolean wins over the default and carries no predicates', () => {
    expect(normalizeUserAction(true, false)).toEqual({ enabled: true });
    expect(normalizeUserAction(false, true)).toEqual({ enabled: false });
  });

  it('object form: enabled overrides the default; predicates ride alongside', () => {
    expect(normalizeUserAction({ enabled: false, disabledWhen: 'record.frozen' }, true))
      .toEqual({ enabled: false, predicates: { disabledWhen: 'record.frozen' } });
    // omitted `enabled` falls back to the base; only the present predicate key is set.
    expect(normalizeUserAction({ visibleWhen: 'a' }, true))
      .toEqual({ enabled: true, predicates: { visibleWhen: 'a' } });
    // object form without predicates is boolean-equivalent.
    expect(normalizeUserAction({ enabled: true }, false)).toEqual({ enabled: true });
  });
});

describe('userActionPredicates', () => {
  it('returns predicates independent of the enabled verdict, undefined otherwise', () => {
    expect(userActionPredicates(true)).toBeUndefined();
    expect(userActionPredicates(false)).toBeUndefined();
    expect(userActionPredicates(undefined)).toBeUndefined();
    expect(userActionPredicates({ enabled: true })).toBeUndefined();
    expect(userActionPredicates({ disabledWhen: 'x' })).toEqual({ disabledWhen: 'x' });
    expect(userActionPredicates({ visibleWhen: 'a', disabledWhen: 'b' }))
      .toEqual({ visibleWhen: 'a', disabledWhen: 'b' });
    // predicates survive even when the flag opts the action out.
    expect(userActionPredicates({ enabled: false, visibleWhen: 'a' })).toEqual({ visibleWhen: 'a' });
  });
});

describe('MANAGED_BY_BUCKETS', () => {
  it('is the closed 6-bucket union in canonical order (ADR-0103 engine-owned split)', () => {
    expect(MANAGED_BY_BUCKETS).toEqual(['platform', 'config', 'system', 'engine-owned', 'append-only', 'better-auth']);
  });
});
