/**
 * @object-ui/core - Validation Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { ValidationEngine } from '../validation-engine';
import type { AdvancedValidationSchema } from '@object-ui/types';

describe('ValidationEngine', () => {
  const engine = new ValidationEngine();

  describe('Basic Validation', () => {
    it('should validate required field', async () => {
      const schema: AdvancedValidationSchema = {
        field: 'email',
        rules: [
          {
            type: 'required',
            message: 'Email is required',
          },
        ],
      };

      const result1 = await engine.validate('', schema);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toHaveLength(1);
      expect(result1.errors[0].message).toBe('Email is required');

      const result2 = await engine.validate('test@example.com', schema);
      expect(result2.valid).toBe(true);
      expect(result2.errors).toHaveLength(0);
    });

    it('should validate email format', async () => {
      const schema: AdvancedValidationSchema = {
        field: 'email',
        rules: [
          {
            type: 'email',
          },
        ],
      };

      const result1 = await engine.validate('invalid-email', schema);
      expect(result1.valid).toBe(false);

      const result2 = await engine.validate('valid@example.com', schema);
      expect(result2.valid).toBe(true);
    });

    it('should validate phone format', async () => {
      const schema: AdvancedValidationSchema = {
        field: 'phone',
        rules: [
          {
            type: 'phone',
          },
        ],
      };

      // Valid phone numbers with various formats
      const validResult1 = await engine.validate('123-456-7890', schema);
      expect(validResult1.valid).toBe(true);

      const validResult2 = await engine.validate('+1 (234) 567-8900', schema);
      expect(validResult2.valid).toBe(true);

      const validResult3 = await engine.validate('1234567890', schema);
      expect(validResult3.valid).toBe(true);

      // Invalid phone number with letters
      const invalidResult = await engine.validate('123-abc-7890', schema);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('Custom Validation', () => {
    it('should validate with custom sync function', async () => {
      const schema: AdvancedValidationSchema = {
        field: 'custom',
        rules: [
          {
            type: 'custom',
            validator: (value) => {
              if (value === 'forbidden') {
                return 'This value is forbidden';
              }
              return true;
            },
          },
        ],
      };

      const result1 = await engine.validate('forbidden', schema);
      expect(result1.valid).toBe(false);
      expect(result1.errors[0].message).toBe('This value is forbidden');

      const result2 = await engine.validate('allowed', schema);
      expect(result2.valid).toBe(true);
    });
  });
});
