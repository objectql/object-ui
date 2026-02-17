/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { evaluateConditionalFormatting } from '../ListView';

describe('evaluateConditionalFormatting', () => {
  // =========================================================================
  // Standard operator-based rules
  // =========================================================================
  describe('operator-based rules', () => {
    it('matches "equals" operator', () => {
      const result = evaluateConditionalFormatting(
        { status: 'active' },
        [{ field: 'status', operator: 'equals', value: 'active', backgroundColor: '#e0ffe0' }],
      );
      expect(result).toEqual({ backgroundColor: '#e0ffe0' });
    });

    it('matches "not_equals" operator', () => {
      const result = evaluateConditionalFormatting(
        { status: 'inactive' },
        [{ field: 'status', operator: 'not_equals', value: 'active', textColor: '#f00' }],
      );
      expect(result).toEqual({ color: '#f00' });
    });

    it('matches "contains" operator', () => {
      const result = evaluateConditionalFormatting(
        { name: 'John Doe' },
        [{ field: 'name', operator: 'contains', value: 'Doe', borderColor: '#00f' }],
      );
      expect(result).toEqual({ borderColor: '#00f' });
    });

    it('matches "greater_than" operator', () => {
      const result = evaluateConditionalFormatting(
        { amount: 500 },
        [{ field: 'amount', operator: 'greater_than', value: 100, backgroundColor: '#ff0' }],
      );
      expect(result).toEqual({ backgroundColor: '#ff0' });
    });

    it('does not match "greater_than" when equal', () => {
      const result = evaluateConditionalFormatting(
        { amount: 100 },
        [{ field: 'amount', operator: 'greater_than', value: 100, backgroundColor: '#ff0' }],
      );
      expect(result).toEqual({});
    });

    it('matches "less_than" operator', () => {
      const result = evaluateConditionalFormatting(
        { score: 3 },
        [{ field: 'score', operator: 'less_than', value: 5, textColor: '#aaa' }],
      );
      expect(result).toEqual({ color: '#aaa' });
    });

    it('matches "in" operator', () => {
      const result = evaluateConditionalFormatting(
        { priority: 'high' },
        [{ field: 'priority', operator: 'in', value: ['high', 'critical'], backgroundColor: '#fee' }],
      );
      expect(result).toEqual({ backgroundColor: '#fee' });
    });

    it('does not match "in" when value is absent from array', () => {
      const result = evaluateConditionalFormatting(
        { priority: 'low' },
        [{ field: 'priority', operator: 'in', value: ['high', 'critical'], backgroundColor: '#fee' }],
      );
      expect(result).toEqual({});
    });
  });

  // =========================================================================
  // Expression-based rules (L2 feature)
  // =========================================================================
  describe('expression-based rules', () => {
    it('evaluates a simple expression', () => {
      const result = evaluateConditionalFormatting(
        { amount: 2000, status: 'urgent' },
        [{
          field: '',
          operator: 'equals',
          value: '',
          expression: '${data.amount > 1000}',
          backgroundColor: '#f0f0f0',
        }],
      );
      expect(result).toEqual({ backgroundColor: '#f0f0f0' });
    });

    it('evaluates a complex expression with && operator', () => {
      const result = evaluateConditionalFormatting(
        { amount: 2000, status: 'urgent' },
        [{
          field: '',
          operator: 'equals',
          value: '',
          expression: '${data.amount > 1000 && data.status === "urgent"}',
          backgroundColor: '#fee2e2',
          textColor: '#dc2626',
        }],
      );
      expect(result).toEqual({ backgroundColor: '#fee2e2', color: '#dc2626' });
    });

    it('returns empty object when expression evaluates to false', () => {
      const result = evaluateConditionalFormatting(
        { amount: 50, status: 'normal' },
        [{
          field: '',
          operator: 'equals',
          value: '',
          expression: '${data.amount > 1000 && data.status === "urgent"}',
          backgroundColor: '#fee2e2',
        }],
      );
      expect(result).toEqual({});
    });

    it('does not throw on invalid expression and returns empty', () => {
      const result = evaluateConditionalFormatting(
        { amount: 100 },
        [{
          field: '',
          operator: 'equals',
          value: '',
          expression: '${data.!!!invalidSyntax}',
          backgroundColor: '#f00',
        }],
      );
      expect(result).toEqual({});
    });
  });

  // =========================================================================
  // Mixed rules (expression + standard) – first match wins
  // =========================================================================
  describe('mixed rules', () => {
    it('returns the first matching rule (expression first)', () => {
      const result = evaluateConditionalFormatting(
        { amount: 5000, status: 'active' },
        [
          {
            field: '',
            operator: 'equals',
            value: '',
            expression: '${data.amount > 1000}',
            backgroundColor: '#expr_match',
          },
          {
            field: 'status',
            operator: 'equals',
            value: 'active',
            backgroundColor: '#operator_match',
          },
        ],
      );
      expect(result).toEqual({ backgroundColor: '#expr_match' });
    });

    it('falls through non-matching expression to matching operator rule', () => {
      const result = evaluateConditionalFormatting(
        { amount: 50, status: 'active' },
        [
          {
            field: '',
            operator: 'equals',
            value: '',
            expression: '${data.amount > 1000}',
            backgroundColor: '#expr_match',
          },
          {
            field: 'status',
            operator: 'equals',
            value: 'active',
            backgroundColor: '#operator_match',
          },
        ],
      );
      expect(result).toEqual({ backgroundColor: '#operator_match' });
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('returns empty object for undefined rules', () => {
      expect(evaluateConditionalFormatting({ a: 1 }, undefined)).toEqual({});
    });

    it('returns empty object for empty rules array', () => {
      expect(evaluateConditionalFormatting({ a: 1 }, [])).toEqual({});
    });
  });
});
