/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { ExpressionEvaluator } from '../ExpressionEvaluator';

describe('ExpressionEvaluator - Formula Functions Integration', () => {
  it('should evaluate SUM in an expression', () => {
    const evaluator = new ExpressionEvaluator({
      data: { items: [{ price: 10 }, { price: 20 }, { price: 30 }] },
    });
    expect(evaluator.evaluate("${SUM(data.items, 'price')}")).toBe(60);
  });

  it('should evaluate IF in an expression', () => {
    const evaluator = new ExpressionEvaluator({
      data: { age: 25 },
    });
    expect(evaluator.evaluate("${IF(data.age >= 18, 'Adult', 'Minor')}")).toBe('Adult');
  });

  it('should evaluate TODAY()', () => {
    const evaluator = new ExpressionEvaluator({});
    const result = evaluator.evaluate('${TODAY()}');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should evaluate NOW()', () => {
    const evaluator = new ExpressionEvaluator({});
    const result = evaluator.evaluate('${NOW()}');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should evaluate AVG in template', () => {
    const evaluator = new ExpressionEvaluator({
      scores: [10, 20, 30],
    });
    expect(evaluator.evaluate('${AVG(scores)}')).toBe(20);
  });

  it('should evaluate UPPER / LOWER', () => {
    const evaluator = new ExpressionEvaluator({
      data: { name: 'Alice' },
    });
    expect(evaluator.evaluate('${UPPER(data.name)}')).toBe('ALICE');
    expect(evaluator.evaluate('${LOWER(data.name)}')).toBe('alice');
  });

  it('should evaluate ROUND in template', () => {
    const evaluator = new ExpressionEvaluator({
      data: { price: 19.999 },
    });
    expect(evaluator.evaluate('${ROUND(data.price, 2)}')).toBe(20);
  });

  it('should evaluate COALESCE', () => {
    const evaluator = new ExpressionEvaluator({
      data: { nickname: null, name: 'Bob' },
    });
    expect(evaluator.evaluate('${COALESCE(data.nickname, data.name)}')).toBe('Bob');
  });

  it('should evaluate CONCAT in template string', () => {
    const evaluator = new ExpressionEvaluator({
      first: 'John',
      last: 'Doe',
    });
    expect(evaluator.evaluate("${CONCAT(first, ' ', last)}")).toBe('John Doe');
  });

  it('should evaluate nested function calls', () => {
    const evaluator = new ExpressionEvaluator({
      data: { items: [{ price: 10.555 }, { price: 20.333 }] },
    });
    expect(evaluator.evaluate("${ROUND(SUM(data.items, 'price'), 1)}")).toBe(30.9);
  });

  it('should evaluate PERCENT', () => {
    const evaluator = new ExpressionEvaluator({
      data: { rate: 0.15 },
    });
    expect(evaluator.evaluate('${PERCENT(data.rate)}')).toBe('15%');
  });

  it('should evaluate AND / OR / NOT in conditions', () => {
    const evaluator = new ExpressionEvaluator({
      data: { active: true, admin: false },
    });
    expect(evaluator.evaluateCondition('${AND(data.active, NOT(data.admin))}')).toBe(true);
    expect(evaluator.evaluateCondition('${OR(data.active, data.admin)}')).toBe(true);
  });

  it('should use fromStandardContext factory', () => {
    const evaluator = ExpressionEvaluator.fromStandardContext({
      data: { name: 'Alice', amount: 1500 },
      user: { id: '1', name: 'Admin' },
    });

    expect(evaluator.evaluate('${data.name}')).toBe('Alice');
    expect(evaluator.evaluate('${record.name}')).toBe('Alice'); // alias
    expect(evaluator.evaluate('${user.name}')).toBe('Admin');
    expect(evaluator.evaluate("${IF(data.amount > 1000, 'High', 'Low')}")).toBe('High');
  });

  it('should carry formula functions through withContext', () => {
    const evaluator = new ExpressionEvaluator({ data: { x: 10 } });
    const child = evaluator.withContext({ extra: 5 });

    expect(child.evaluate('${SUM([data.x, extra])}')).toBe(15);
    expect(child.evaluate('${TODAY()}')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
