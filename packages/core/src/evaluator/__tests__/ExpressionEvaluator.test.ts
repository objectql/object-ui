/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { ExpressionEvaluator, evaluateExpression, evaluateCondition, evaluatePlainCondition } from '../ExpressionEvaluator';
import { ExpressionContext } from '../ExpressionContext';

describe('ExpressionContext', () => {
  it('should create context with initial data', () => {
    const ctx = new ExpressionContext({ name: 'John', age: 30 });
    expect(ctx.get('name')).toBe('John');
    expect(ctx.get('age')).toBe(30);
  });

  it('should support nested property access', () => {
    const ctx = new ExpressionContext({
      user: {
        name: 'John',
        profile: {
          email: 'john@example.com'
        }
      }
    });
    
    expect(ctx.get('user.name')).toBe('John');
    expect(ctx.get('user.profile.email')).toBe('john@example.com');
  });

  it('should support scope stacking', () => {
    const ctx = new ExpressionContext({ x: 10 });
    expect(ctx.get('x')).toBe(10);
    
    ctx.pushScope({ x: 20, y: 30 });
    expect(ctx.get('x')).toBe(20);
    expect(ctx.get('y')).toBe(30);
    
    ctx.popScope();
    expect(ctx.get('x')).toBe(10);
    expect(ctx.get('y')).toBeUndefined();
  });
});

describe('ExpressionEvaluator', () => {
  describe('evaluate', () => {
    it('should evaluate simple template expressions', () => {
      const evaluator = new ExpressionEvaluator({ name: 'John' });
      expect(evaluator.evaluate('Hello ${name}!')).toBe('Hello John!');
    });

    it('should evaluate nested property access', () => {
      const evaluator = new ExpressionEvaluator({
        data: { amount: 1500 }
      });
      expect(evaluator.evaluate('Amount: ${data.amount}')).toBe('Amount: 1500');
    });

    it('should handle non-string values', () => {
      const evaluator = new ExpressionEvaluator({});
      expect(evaluator.evaluate(true)).toBe(true);
      expect(evaluator.evaluate(42)).toBe(42);
      expect(evaluator.evaluate(null)).toBe(null);
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate comparison operators', () => {
      const evaluator = new ExpressionEvaluator({ data: { amount: 1500 } });
      
      expect(evaluator.evaluateExpression('data.amount > 1000')).toBe(true);
      expect(evaluator.evaluateExpression('data.amount < 1000')).toBe(false);
    });

    it('should block dangerous expressions', () => {
      const evaluator = new ExpressionEvaluator({});
      
      expect(() => evaluator.evaluateExpression('eval("malicious")')).toThrow();
      expect(() => evaluator.evaluateExpression('process.exit()')).toThrow();
    });
  });

  describe('evaluateCondition', () => {
    it('should return boolean for condition expressions', () => {
      const evaluator = new ExpressionEvaluator({ data: { age: 25 } });
      
      expect(evaluator.evaluateCondition('${data.age >= 18}')).toBe(true);
      expect(evaluator.evaluateCondition('${data.age < 18}')).toBe(false);
    });

    it('should handle boolean values directly', () => {
      const evaluator = new ExpressionEvaluator({});
      
      expect(evaluator.evaluateCondition(true)).toBe(true);
      expect(evaluator.evaluateCondition(false)).toBe(false);
    });
  });
});

describe('evaluatePlainCondition', () => {
  it('should evaluate a plain condition with direct field references', () => {
    expect(evaluatePlainCondition("status == 'overdue'", { status: 'overdue' })).toBe(true);
    expect(evaluatePlainCondition("status == 'overdue'", { status: 'active' })).toBe(false);
  });

  it('should evaluate numeric comparisons', () => {
    expect(evaluatePlainCondition('amount > 1000', { amount: 2500 })).toBe(true);
    expect(evaluatePlainCondition('amount > 1000', { amount: 500 })).toBe(false);
  });

  it('should evaluate compound conditions', () => {
    expect(evaluatePlainCondition("amount > 1000 && status === 'urgent'", { amount: 2000, status: 'urgent' })).toBe(true);
    expect(evaluatePlainCondition("amount > 1000 && status === 'urgent'", { amount: 2000, status: 'normal' })).toBe(false);
  });

  it('should support data.field references in template expressions', () => {
    expect(evaluatePlainCondition('${data.amount > 1000}', { amount: 2000 })).toBe(true);
    expect(evaluatePlainCondition('${data.amount > 1000}', { amount: 500 })).toBe(false);
  });

  it('should return false for invalid expressions', () => {
    expect(evaluatePlainCondition('!!!invalidSyntax', { status: 'ok' })).toBe(false);
  });

  it('should return false for non-boolean results', () => {
    expect(evaluatePlainCondition('status', { status: 'active' })).toBe(false);
  });
});
