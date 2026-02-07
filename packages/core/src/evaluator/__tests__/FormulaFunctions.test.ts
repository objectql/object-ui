/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  SUM, AVG, MIN, MAX, COUNT,
  TODAY, NOW, YEAR, MONTH, DAY, DATEDIFF, DATEADD,
  IF, COALESCE, AND, OR, NOT, SWITCH,
  UPPER, LOWER, TRIM, CONCAT, LEN, SUBSTRING, CONTAINS,
  ROUND, FLOOR, CEIL, ABS, POWER,
  FIXED, PERCENT,
  FORMULA_FUNCTIONS,
} from '../FormulaFunctions';

describe('FormulaFunctions', () => {
  // ── Aggregation ──────────────────────────────────────────────────────────
  describe('Aggregation', () => {
    it('SUM should sum numbers in an array', () => {
      expect(SUM([1, 2, 3])).toBe(6);
      expect(SUM([10, 20, 30])).toBe(60);
    });

    it('SUM should sum by field path', () => {
      const items = [{ price: 10 }, { price: 20 }, { price: 30 }];
      expect(SUM(items, 'price')).toBe(60);
    });

    it('SUM should handle non-array input', () => {
      expect(SUM(null as any)).toBe(0);
      expect(SUM(undefined as any)).toBe(0);
    });

    it('AVG should calculate average', () => {
      expect(AVG([10, 20, 30])).toBe(20);
      expect(AVG([])).toBe(0);
    });

    it('MIN should find minimum', () => {
      expect(MIN([3, 1, 2])).toBe(1);
      const items = [{ val: 5 }, { val: 2 }, { val: 8 }];
      expect(MIN(items, 'val')).toBe(2);
    });

    it('MAX should find maximum', () => {
      expect(MAX([3, 1, 2])).toBe(3);
      const items = [{ val: 5 }, { val: 2 }, { val: 8 }];
      expect(MAX(items, 'val')).toBe(8);
    });

    it('COUNT should count items', () => {
      expect(COUNT([1, 2, 3])).toBe(3);
      expect(COUNT([{ a: 1 }, { a: null }, { a: 'x' }], 'a')).toBe(2);
    });
  });

  // ── Date ─────────────────────────────────────────────────────────────────
  describe('Date', () => {
    it('TODAY should return YYYY-MM-DD', () => {
      expect(TODAY()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('NOW should return ISO string', () => {
      expect(NOW()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('YEAR, MONTH, DAY should extract parts', () => {
      expect(YEAR('2024-06-15')).toBe(2024);
      expect(MONTH('2024-06-15')).toBe(6);
      expect(DAY('2024-06-15')).toBe(15);
    });

    it('DATEDIFF should calculate day difference', () => {
      expect(DATEDIFF('2024-01-01', '2024-01-11')).toBe(10);
    });

    it('DATEADD should add days', () => {
      expect(DATEADD('2024-01-01', 5)).toBe('2024-01-06');
    });
  });

  // ── Logic ────────────────────────────────────────────────────────────────
  describe('Logic', () => {
    it('IF should return correct branch', () => {
      expect(IF(true, 'yes', 'no')).toBe('yes');
      expect(IF(false, 'yes', 'no')).toBe('no');
    });

    it('COALESCE should return first non-null value', () => {
      expect(COALESCE(null, undefined, 'hello')).toBe('hello');
      expect(COALESCE(null, null)).toBeNull();
    });

    it('AND / OR / NOT should work correctly', () => {
      expect(AND(true, true)).toBe(true);
      expect(AND(true, false)).toBe(false);
      expect(OR(false, true)).toBe(true);
      expect(OR(false, false)).toBe(false);
      expect(NOT(true)).toBe(false);
    });

    it('SWITCH should match cases', () => {
      expect(SWITCH('a', 'a', 1, 'b', 2)).toBe(1);
      expect(SWITCH('b', 'a', 1, 'b', 2)).toBe(2);
      expect(SWITCH('c', 'a', 1, 'b', 2, 99)).toBe(99); // default
    });
  });

  // ── String ───────────────────────────────────────────────────────────────
  describe('String', () => {
    it('UPPER / LOWER / TRIM', () => {
      expect(UPPER('hello')).toBe('HELLO');
      expect(LOWER('HELLO')).toBe('hello');
      expect(TRIM('  hi  ')).toBe('hi');
    });

    it('CONCAT', () => {
      expect(CONCAT('a', 'b', 'c')).toBe('abc');
    });

    it('LEN', () => {
      expect(LEN('hello')).toBe(5);
      expect(LEN([1, 2, 3])).toBe(3);
    });

    it('SUBSTRING', () => {
      expect(SUBSTRING('hello', 1, 3)).toBe('ell');
      expect(SUBSTRING('hello', 2)).toBe('llo');
    });

    it('CONTAINS', () => {
      expect(CONTAINS('Hello World', 'world')).toBe(true);
      expect(CONTAINS('Hello', 'xyz')).toBe(false);
    });
  });

  // ── Math ─────────────────────────────────────────────────────────────────
  describe('Math', () => {
    it('ROUND / FLOOR / CEIL', () => {
      expect(ROUND(3.456, 2)).toBe(3.46);
      expect(FLOOR(3.9)).toBe(3);
      expect(CEIL(3.1)).toBe(4);
    });

    it('ABS / POWER', () => {
      expect(ABS(-5)).toBe(5);
      expect(POWER(2, 3)).toBe(8);
    });
  });

  // ── Format ───────────────────────────────────────────────────────────────
  describe('Format', () => {
    it('FIXED should format decimals', () => {
      expect(FIXED(3.14159, 2)).toBe('3.14');
    });

    it('PERCENT should format percentage', () => {
      expect(PERCENT(0.85)).toBe('85%');
      expect(PERCENT(0.8567, 1)).toBe('85.7%');
    });
  });

  // ── Registry ─────────────────────────────────────────────────────────────
  it('FORMULA_FUNCTIONS should contain all functions', () => {
    expect(FORMULA_FUNCTIONS.SUM).toBe(SUM);
    expect(FORMULA_FUNCTIONS.IF).toBe(IF);
    expect(FORMULA_FUNCTIONS.TODAY).toBe(TODAY);
    expect(FORMULA_FUNCTIONS.UPPER).toBe(UPPER);
    expect(FORMULA_FUNCTIONS.ROUND).toBe(ROUND);
    expect(Object.keys(FORMULA_FUNCTIONS).length).toBeGreaterThanOrEqual(30);
  });
});
