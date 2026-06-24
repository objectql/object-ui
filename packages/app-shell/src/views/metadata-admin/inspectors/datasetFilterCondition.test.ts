// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
import { describe, it, expect } from 'vitest';
import { groupToCondition, conditionToGroup } from './datasetFilterCondition';

describe('datasetFilterCondition', () => {
  it('serializes a single condition without an $and wrapper', () => {
    expect(groupToCondition({ logic: 'and', conditions: [{ field: 'status', operator: 'equals', value: 'won' }] }))
      .toEqual({ status: { $eq: 'won' } });
  });

  it('serializes multiple conditions as a flat $and', () => {
    expect(groupToCondition({ logic: 'and', conditions: [
      { field: 'stage', operator: 'equals', value: 'won' },
      { field: 'amount', operator: 'greaterThan', value: 1000 },
    ] })).toEqual({ $and: [{ stage: { $eq: 'won' } }, { amount: { $gt: 1000 } }] });
  });

  it('maps isEmpty/isNotEmpty to $exists', () => {
    expect(groupToCondition({ logic: 'and', conditions: [{ field: 'closed_at', operator: 'isNotEmpty' }] }))
      .toEqual({ closed_at: { $exists: true } });
  });

  it('drops unmapped operators rather than emitting a bad filter', () => {
    expect(groupToCondition({ logic: 'and', conditions: [{ field: 'x', operator: 'notContains', value: 'a' }] }))
      .toBeUndefined();
  });

  it('empty group → undefined', () => {
    expect(groupToCondition({ logic: 'and', conditions: [] })).toBeUndefined();
  });

  it('round-trips representable conditions (condition → group → condition)', () => {
    for (const c of [
      { status: { $eq: 'won' } },
      { $and: [{ stage: { $eq: 'won' } }, { amount: { $gt: 1000 } }] },
      { region: { $in: ['NA', 'EU'] } },
      { closed_at: { $exists: false } },
    ]) {
      const { group, representable } = conditionToGroup(c);
      expect(representable).toBe(true);
      expect(groupToCondition(group)).toEqual(c);
    }
  });

  it('parses implicit equality {field: scalar}', () => {
    const { group, representable } = conditionToGroup({ status: 'active' });
    expect(representable).toBe(true);
    expect(group.conditions).toEqual([{ id: 'c0', field: 'status', operator: 'equals', value: 'active' }]);
  });

  it('flags non-representable shapes (nested $or / multi-op) for the source editor', () => {
    expect(conditionToGroup({ $or: [{ a: { $eq: 1 } }] }).representable).toBe(false);
    expect(conditionToGroup({ amount: { $gt: 1, $lt: 9 } }).representable).toBe(false);
    expect(conditionToGroup({ $and: [{ $or: [{ a: { $eq: 1 } }] }] }).representable).toBe(false);
  });
});
