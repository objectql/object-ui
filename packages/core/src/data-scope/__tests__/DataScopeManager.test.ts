/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { DataScopeManager, type RowLevelFilter } from '../DataScopeManager';

describe('DataScopeManager', () => {
  describe('Scope Registration', () => {
    it('should register and retrieve a scope', () => {
      const manager = new DataScopeManager();
      manager.registerScope('contacts', { data: [{ name: 'Alice' }] });
      const scope = manager.getScope('contacts');
      expect(scope).toBeDefined();
      expect(scope?.data).toEqual([{ name: 'Alice' }]);
    });

    it('should return undefined for unregistered scope', () => {
      const manager = new DataScopeManager();
      expect(manager.getScope('unknown')).toBeUndefined();
    });

    it('should remove a scope', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      expect(manager.getScope('test')).toBeDefined();
      manager.removeScope('test');
      expect(manager.getScope('test')).toBeUndefined();
    });

    it('should list scope names', () => {
      const manager = new DataScopeManager();
      manager.registerScope('a', { data: [] });
      manager.registerScope('b', { data: [] });
      expect(manager.getScopeNames()).toEqual(['a', 'b']);
    });

    it('should clear all scopes', () => {
      const manager = new DataScopeManager();
      manager.registerScope('a', { data: [] });
      manager.registerScope('b', { data: [] });
      manager.clear();
      expect(manager.getScopeNames()).toEqual([]);
    });
  });

  describe('Scope Configuration', () => {
    it('should register scope with config', () => {
      const manager = new DataScopeManager();
      manager.registerScopeWithConfig('test', {
        data: [1, 2, 3],
        readOnly: true,
        filters: [{ field: 'status', operator: 'eq', value: 'active' }],
      });

      expect(manager.getScope('test')?.data).toEqual([1, 2, 3]);
      expect(manager.isReadOnly('test')).toBe(true);
      expect(manager.getFilters('test')).toHaveLength(1);
    });

    it('should throw when updating read-only scope', () => {
      const manager = new DataScopeManager();
      manager.registerScopeWithConfig('readonly', { readOnly: true });
      expect(() => manager.updateScopeData('readonly', [1])).toThrow('Cannot update read-only scope');
    });
  });

  describe('Row-Level Filtering', () => {
    it('should apply eq filter', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.setFilters('test', [{ field: 'status', operator: 'eq', value: 'active' }]);

      const result = manager.applyFilters('test', [
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' },
        { id: 3, status: 'active' },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(3);
    });

    it('should apply gt filter', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.setFilters('test', [{ field: 'age', operator: 'gt', value: 18 }]);

      const result = manager.applyFilters('test', [
        { name: 'A', age: 15 },
        { name: 'B', age: 25 },
        { name: 'C', age: 18 },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('B');
    });

    it('should apply in filter', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.setFilters('test', [{ field: 'role', operator: 'in', value: ['admin', 'editor'] }]);

      const result = manager.applyFilters('test', [
        { name: 'A', role: 'admin' },
        { name: 'B', role: 'viewer' },
        { name: 'C', role: 'editor' },
      ]);

      expect(result).toHaveLength(2);
    });

    it('should apply contains filter', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.setFilters('test', [{ field: 'name', operator: 'contains', value: 'ob' }]);

      const result = manager.applyFilters('test', [
        { name: 'Bob' },
        { name: 'Alice' },
        { name: 'Robert' },
      ]);

      expect(result).toHaveLength(2);
    });

    it('should apply multiple filters (AND logic)', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.setFilters('test', [
        { field: 'status', operator: 'eq', value: 'active' },
        { field: 'age', operator: 'gte', value: 18 },
      ]);

      const result = manager.applyFilters('test', [
        { status: 'active', age: 25 },
        { status: 'inactive', age: 25 },
        { status: 'active', age: 15 },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(25);
    });

    it('should return all data when no filters set', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      const data = [{ a: 1 }, { a: 2 }];
      expect(manager.applyFilters('test', data)).toEqual(data);
    });
  });

  describe('Scope Updates', () => {
    it('should update scope data', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.updateScopeData('test', [1, 2, 3]);
      expect(manager.getScope('test')?.data).toEqual([1, 2, 3]);
    });

    it('should update loading state', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [], loading: false });
      manager.updateScopeLoading('test', true);
      expect(manager.getScope('test')?.loading).toBe(true);
    });

    it('should update error state', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.updateScopeError('test', new Error('fail'));
      expect(manager.getScope('test')?.error).toBeDefined();
    });
  });

  describe('Change Listeners', () => {
    it('should notify listeners on scope registration', () => {
      const manager = new DataScopeManager();
      let notified = false;
      manager.onScopeChange('test', () => { notified = true; });
      manager.registerScope('test', { data: [] });
      expect(notified).toBe(true);
    });

    it('should notify listeners on data update', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      let newData: any;
      manager.onScopeChange('test', (scope) => { newData = scope.data; });
      manager.updateScopeData('test', [1, 2]);
      expect(newData).toEqual([1, 2]);
    });

    it('should allow unsubscribing', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      let count = 0;
      const unsub = manager.onScopeChange('test', () => { count++; });
      manager.updateScopeData('test', [1]);
      expect(count).toBe(1);
      unsub();
      manager.updateScopeData('test', [2]);
      expect(count).toBe(1);
    });
  });

  describe('Unknown operator fails closed (objectui#7378)', () => {
    // Why the cast is here, and why it must stay: `RowLevelFilter['operator']`
    // is a closed nine-member union, so TypeScript refuses `'equals'` or
    // `'is_null'` at a call site. That protects TypeScript callers and nothing
    // else. A scope rule read back from stored JSON reaches `applyFilters` as a
    // plain string, and the switch keys on that string at runtime, exactly the
    // way it is spelled below. The cast reproduces the path stored data takes;
    // it is the point of these tests, not a shortcut to be "cleaned up". A
    // test that only spells the nine declared operators cannot reach the
    // `default` arm at all.
    const storedRule = (field: string, operator: string, value: unknown): RowLevelFilter =>
      ({ field, operator, value }) as unknown as RowLevelFilter;

    it('does not admit a record it cannot evaluate (operator outside every published vocabulary)', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.setFilters('test', [storedRule('status', 'not_an_operator', 'active')]);

      const result = manager.applyFilters('test', [
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' },
      ]);

      // Fail closed: a rule the evaluator cannot answer denies every row in
      // the scope, the same answer `evaluateCondition` in @object-ui/permissions
      // gives from its own `default` arm. Before the fix this returned both
      // rows, `{ id: 2 }` included, with no error and no console line.
      expect(result).toEqual([]);
    });

    it('does not let an unrecognised rule widen a scope another rule narrows (AND semantics)', () => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.setFilters('test', [
        { field: 'status', operator: 'eq', value: 'active' },
        storedRule('tenant', 'not_an_operator', 'acme'),
      ]);

      const result = manager.applyFilters('test', [
        { id: 1, status: 'active', tenant: 'acme' },
        { id: 2, status: 'active', tenant: 'other' },
        { id: 3, status: 'inactive', tenant: 'acme' },
      ]);

      // Before the fix the unknown `tenant` rule evaluated to `true`, so the
      // `status` rule alone decided and `{ id: 2, tenant: 'other' }` passed —
      // the row the second rule existed to hide. Now nothing passes.
      expect(result).toEqual([]);
    });

    // The spec's published vocabularies (`VIEW_FILTER_OPERATORS` from
    // `@objectstack/spec/ui`, `VALID_AST_OPERATORS` from `@objectstack/spec/data`)
    // carry spellings this switch has no arm for: the canonical forms of the
    // implemented abbreviations, and the whole null-ness family. Measured on
    // @objectstack/spec 17.2.0: 18 of the 20 view operators and 44 of the 53
    // AST operators have no arm. Until they are either implemented or refused
    // by name, they MUST take the fail-closed arm rather than the admit-all one.
    // A change that implements these spellings rewrites the expectations below
    // to the evaluated result; it never deletes the cases. Every case is
    // chosen so that a CORRECT evaluation of the spelling admits at least one
    // of the two rows: an implementation that lands without rewriting the
    // expectation turns red here instead of passing by coincidence.
    it.each([
      ['equals', 'status', 'active'],
      ['not_equals', 'status', 'active'],
      ['greater_than', 'age', 20],
      ['not_in', 'status', ['inactive']],
      ['starts_with', 'status', 'act'],
      ['is_null', 'status', null],
      ['is_not_null', 'status', null],
    ])('denies rather than admits for the published-but-unimplemented spelling %s', (operator, field, value) => {
      const manager = new DataScopeManager();
      manager.registerScope('test', { data: [] });
      manager.setFilters('test', [storedRule(field, operator, value)]);

      const result = manager.applyFilters('test', [
        { id: 1, status: 'active', age: 30 },
        { id: 2, status: null, age: 10 },
      ]);

      expect(result).toEqual([]);
    });
  });
});
