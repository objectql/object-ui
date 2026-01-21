/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { convertFiltersToAST, convertOperatorToAST, type FilterNode } from '../filter-converter';

describe('Filter Converter Utilities', () => {
  describe('convertOperatorToAST', () => {
    it('should convert known operators', () => {
      expect(convertOperatorToAST('$eq')).toBe('=');
      expect(convertOperatorToAST('$ne')).toBe('!=');
      expect(convertOperatorToAST('$gt')).toBe('>');
      expect(convertOperatorToAST('$gte')).toBe('>=');
      expect(convertOperatorToAST('$lt')).toBe('<');
      expect(convertOperatorToAST('$lte')).toBe('<=');
      expect(convertOperatorToAST('$in')).toBe('in');
      expect(convertOperatorToAST('$nin')).toBe('notin');
      expect(convertOperatorToAST('$notin')).toBe('notin');
      expect(convertOperatorToAST('$contains')).toBe('contains');
      expect(convertOperatorToAST('$startswith')).toBe('startswith');
      expect(convertOperatorToAST('$between')).toBe('between');
    });

    it('should return null for unknown operators', () => {
      expect(convertOperatorToAST('$unknown')).toBe(null);
      expect(convertOperatorToAST('$exists')).toBe(null);
    });
  });

  describe('convertFiltersToAST', () => {
    it('should convert simple equality filter', () => {
      const result = convertFiltersToAST({ status: 'active' });
      expect(result).toEqual(['status', '=', 'active']);
    });

    it('should convert single operator filter', () => {
      const result = convertFiltersToAST({ age: { $gte: 18 } });
      expect(result).toEqual(['age', '>=', 18]);
    });

    it('should convert multiple operators on same field', () => {
      const result = convertFiltersToAST({ age: { $gte: 18, $lte: 65 } }) as FilterNode;
      expect(result[0]).toBe('and');
      expect(result.slice(1)).toContainEqual(['age', '>=', 18]);
      expect(result.slice(1)).toContainEqual(['age', '<=', 65]);
    });

    it('should convert multiple fields with and logic', () => {
      const result = convertFiltersToAST({
        age: { $gte: 18 },
        status: 'active'
      }) as FilterNode;
      expect(result[0]).toBe('and');
      expect(result.slice(1)).toContainEqual(['age', '>=', 18]);
      expect(result.slice(1)).toContainEqual(['status', '=', 'active']);
    });

    it('should handle $in operator', () => {
      const result = convertFiltersToAST({
        status: { $in: ['active', 'pending'] }
      });
      expect(result).toEqual(['status', 'in', ['active', 'pending']]);
    });

    it('should handle $nin operator', () => {
      const result = convertFiltersToAST({
        status: { $nin: ['archived'] }
      });
      expect(result).toEqual(['status', 'notin', ['archived']]);
    });

    it('should warn on $regex operator and convert to contains', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = convertFiltersToAST({
        name: { $regex: '^John' }
      });
      
      expect(result).toEqual(['name', 'contains', '^John']);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ObjectUI] Warning: $regex operator is not fully supported')
      );
      
      consoleSpy.mockRestore();
    });

    it('should throw error on unknown operator', () => {
      expect(() => {
        convertFiltersToAST({ age: { $unknown: 18 } });
      }).toThrow('[ObjectUI] Unknown filter operator');
    });

    it('should skip null and undefined values', () => {
      const result = convertFiltersToAST({
        name: 'John',
        age: null,
        email: undefined
      });
      expect(result).toEqual(['name', '=', 'John']);
    });

    it('should return original filter if empty after filtering', () => {
      const result = convertFiltersToAST({
        age: null,
        email: undefined
      });
      expect(result).toEqual({
        age: null,
        email: undefined
      });
    });
  });
});
