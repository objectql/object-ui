import { describe, it, expect } from 'vitest';
import {
  validateSchema,
  assertValidSchema,
  isValidSchema,
  formatValidationErrors,
} from '../../validation/schema-validator';

describe('schema-validator', () => {
  describe('validateSchema', () => {
    it('validates a minimal valid schema', () => {
      const result = validateSchema({ type: 'form' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects schema without type', () => {
      const result = validateSchema({} as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates CRUD schema with columns', () => {
      const result = validateSchema({
        type: 'crud',
        columns: [{ name: 'id', label: 'ID' }],
        api: '/api/users',
      });
      expect(result.valid).toBe(true);
    });

    it('warns about CRUD without columns', () => {
      const result = validateSchema({ type: 'crud' });
      const hasColumnsIssue = [...result.errors, ...result.warnings].some(
        (e) => e.message.toLowerCase().includes('column'),
      );
      expect(hasColumnsIssue).toBe(true);
    });

    it('validates form with fields', () => {
      const result = validateSchema({
        type: 'form',
        fields: [
          { name: 'email', label: 'Email', type: 'string' },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('detects duplicate field names in forms', () => {
      const result = validateSchema({
        type: 'form',
        fields: [
          { name: 'email', label: 'Email', type: 'string' },
          { name: 'email', label: 'Email 2', type: 'string' },
        ],
      });
      const hasDuplicateWarning = [...result.errors, ...result.warnings].some(
        (e) => e.message.toLowerCase().includes('duplicate'),
      );
      expect(hasDuplicateWarning).toBe(true);
    });

    it('validates nested children', () => {
      const result = validateSchema({
        type: 'grid',
        children: [
          { type: 'button', label: 'OK' },
        ],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('isValidSchema', () => {
    it('returns true for valid schema', () => {
      expect(isValidSchema({ type: 'form' })).toBe(true);
    });

    it('returns false for invalid schema', () => {
      expect(isValidSchema({})).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isValidSchema({} as any)).toBe(false);
    });

    it('returns false for non-object values', () => {
      expect(isValidSchema('string' as any)).toBe(false);
      expect(isValidSchema(42 as any)).toBe(false);
    });
  });

  describe('assertValidSchema', () => {
    it('does not throw for valid schema', () => {
      expect(() => assertValidSchema({ type: 'form' })).not.toThrow();
    });

    it('throws for invalid schema', () => {
      expect(() => assertValidSchema({} as any)).toThrow();
    });
  });

  describe('formatValidationErrors', () => {
    it('formats validation errors', () => {
      const result = validateSchema({} as any);
      const formatted = formatValidationErrors(result);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('returns empty string for valid schemas', () => {
      const result = validateSchema({ type: 'form' });
      const formatted = formatValidationErrors(result);
      expect(formatted).toBe('');
    });
  });
});
