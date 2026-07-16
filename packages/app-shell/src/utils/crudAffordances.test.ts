/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * UI-side mirror of the framework's `resolveCrudAffordances`. Covers the
 * managedBy bucket defaults, the boolean overrides, and the objectui#2614
 * object form of `userActions.edit` / `delete` (per-record CEL predicates).
 */
import { describe, it, expect } from 'vitest';
import { resolveCrudAffordances } from './crudAffordances';

describe('resolveCrudAffordances (app-shell mirror)', () => {
  it('defaults to the platform bucket when managedBy is unset', () => {
    expect(resolveCrudAffordances({})).toEqual({
      create: true, import: true, edit: true, delete: true, exportCsv: true,
    });
  });

  it('applies the bucket default matrix (append-only → export only)', () => {
    expect(resolveCrudAffordances({ managedBy: 'append-only' })).toEqual({
      create: false, import: false, edit: false, delete: false, exportCsv: true,
    });
  });

  it('boolean userActions override the bucket default per flag', () => {
    const aff = resolveCrudAffordances({ managedBy: 'system', userActions: { edit: true } });
    expect(aff.edit).toBe(true);
    expect(aff.delete).toBe(false);
  });

  describe('#2614 object form (per-record CEL predicates)', () => {
    it('carries predicates through and resolves enabled from the bucket default', () => {
      const aff = resolveCrudAffordances({
        userActions: {
          edit: { disabledWhen: 'record.frozen == true' },
          delete: { visibleWhen: { dialect: 'cel', source: 'record.frozen != true' } },
        },
      });
      expect(aff.edit).toBe(true);
      expect(aff.delete).toBe(true);
      expect(aff.editPredicates).toEqual({ disabledWhen: 'record.frozen == true' });
      expect(aff.deletePredicates).toEqual({ visibleWhen: { dialect: 'cel', source: 'record.frozen != true' } });
    });

    it('object form enabled:false opts out like the bare boolean', () => {
      const aff = resolveCrudAffordances({
        userActions: { edit: { enabled: false, disabledWhen: 'record.frozen == true' } },
      });
      expect(aff.edit).toBe(false);
      // Predicates still surface — the caller decides what a disabled
      // affordance means; the grid path drops them with canEdit=false.
      expect(aff.editPredicates).toEqual({ disabledWhen: 'record.frozen == true' });
    });

    it('object form without predicates is byte-identical to the boolean path', () => {
      const aff = resolveCrudAffordances({ userActions: { edit: { enabled: true }, delete: {} } });
      expect(aff).toEqual({
        create: true, import: true, edit: true, delete: true, exportCsv: true,
      });
      expect('editPredicates' in aff).toBe(false);
      expect('deletePredicates' in aff).toBe(false);
    });
  });
});
