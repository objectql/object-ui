/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  inferDetailColumns,
  isWideFieldType,
  applyAutoSpan,
  applyDetailAutoLayout,
} from '../autoLayout';

describe('Detail Auto-Layout', () => {
  describe('inferDetailColumns', () => {
    it('should return 1 column for 0 fields', () => {
      expect(inferDetailColumns(0)).toBe(1);
    });

    it('should return 1 column for 1-3 fields', () => {
      expect(inferDetailColumns(1)).toBe(1);
      expect(inferDetailColumns(2)).toBe(1);
      expect(inferDetailColumns(3)).toBe(1);
    });

    it('should return 2 columns for 4-10 fields', () => {
      expect(inferDetailColumns(4)).toBe(2);
      expect(inferDetailColumns(7)).toBe(2);
      expect(inferDetailColumns(10)).toBe(2);
    });

    it('should return 3 columns for 11+ fields', () => {
      expect(inferDetailColumns(11)).toBe(3);
      expect(inferDetailColumns(15)).toBe(3);
      expect(inferDetailColumns(50)).toBe(3);
    });
  });

  describe('isWideFieldType', () => {
    it('should identify textarea as wide', () => {
      expect(isWideFieldType('textarea')).toBe(true);
      expect(isWideFieldType('field:textarea')).toBe(true);
    });

    it('should identify markdown as wide', () => {
      expect(isWideFieldType('markdown')).toBe(true);
      expect(isWideFieldType('field:markdown')).toBe(true);
    });

    it('should identify html as wide', () => {
      expect(isWideFieldType('html')).toBe(true);
      expect(isWideFieldType('field:html')).toBe(true);
    });

    it('should identify grid as wide', () => {
      expect(isWideFieldType('grid')).toBe(true);
      expect(isWideFieldType('field:grid')).toBe(true);
    });

    it('should identify rich-text as wide', () => {
      expect(isWideFieldType('rich-text')).toBe(true);
      expect(isWideFieldType('field:rich-text')).toBe(true);
    });

    it('should NOT identify regular types as wide', () => {
      expect(isWideFieldType('text')).toBe(false);
      expect(isWideFieldType('number')).toBe(false);
      expect(isWideFieldType('date')).toBe(false);
      expect(isWideFieldType('select')).toBe(false);
    });
  });

  describe('applyAutoSpan', () => {
    it('should return fields unchanged when columns <= 1', () => {
      const fields = [
        { name: 'desc', label: 'Description', type: 'textarea' },
      ];
      const result = applyAutoSpan(fields, 1);
      expect(result).toEqual(fields);
    });

    it('should set span on wide fields in multi-column layout', () => {
      const fields = [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'desc', label: 'Description', type: 'textarea' },
      ];
      const result = applyAutoSpan(fields, 2);
      expect(result[0].span).toBeUndefined();
      expect(result[1].span).toBe(2);
    });

    it('should NOT override user-defined span', () => {
      const fields = [
        { name: 'desc', label: 'Description', type: 'textarea', span: 1 },
      ];
      const result = applyAutoSpan(fields, 2);
      expect(result[0].span).toBe(1);
    });

    it('should handle fields without type', () => {
      const fields = [
        { name: 'name', label: 'Name' },
      ];
      const result = applyAutoSpan(fields, 2);
      expect(result[0].span).toBeUndefined();
    });
  });

  describe('applyDetailAutoLayout', () => {
    it('should infer 1 column for 3 fields', () => {
      const fields = [
        { name: 'a', label: 'A' },
        { name: 'b', label: 'B' },
        { name: 'c', label: 'C' },
      ];
      const result = applyDetailAutoLayout(fields, undefined);
      expect(result.columns).toBe(1);
    });

    it('should infer 2 columns for 5 fields', () => {
      const fields = Array.from({ length: 5 }, (_, i) => ({
        name: `f${i}`, label: `F${i}`,
      }));
      const result = applyDetailAutoLayout(fields, undefined);
      expect(result.columns).toBe(2);
    });

    it('should infer 3 columns for 15 fields', () => {
      const fields = Array.from({ length: 15 }, (_, i) => ({
        name: `f${i}`, label: `F${i}`,
      }));
      const result = applyDetailAutoLayout(fields, undefined);
      expect(result.columns).toBe(3);
    });

    it('should respect explicit columns and still apply auto-span', () => {
      const fields = [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'desc', label: 'Description', type: 'textarea' },
      ];
      const result = applyDetailAutoLayout(fields, 2);
      expect(result.columns).toBe(2);
      // Wide field gets auto-span
      expect(result.fields[1].span).toBe(2);
    });

    it('should not mutate original fields', () => {
      const fields = [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'desc', label: 'Description', type: 'textarea' },
      ];
      const original = fields.map(f => ({ ...f }));
      applyDetailAutoLayout(fields, undefined);
      expect(fields).toEqual(original);
    });

    it('should auto-span wide fields in inferred multi-column layout', () => {
      const fields = [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'email', label: 'Email', type: 'text' },
        { name: 'phone', label: 'Phone', type: 'text' },
        { name: 'addr', label: 'Address', type: 'text' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ];
      const result = applyDetailAutoLayout(fields, undefined);
      expect(result.columns).toBe(2);
      // textarea field should span full row
      expect(result.fields[4].span).toBe(2);
    });
  });
});
