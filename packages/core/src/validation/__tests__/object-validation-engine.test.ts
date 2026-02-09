/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Object Validation Engine Tests
 * 
 * Tests for ObjectStack Spec v2.0.1 object-level validation
 */

import { describe, it, expect, vi } from 'vitest';
import { ObjectValidationEngine, type ObjectValidationContext } from '../validators/object-validation-engine';
import type {
  ScriptValidation,
  UniquenessValidation,
  StateMachineValidation,
  CrossFieldValidation,
  AsyncValidation,
  ConditionalValidation,
  FormatValidation,
  RangeValidation,
} from '@object-ui/types';

describe('ObjectValidationEngine', () => {
  describe('ScriptValidation', () => {
    it('should validate when script condition is true', async () => {
      const engine = new ObjectValidationEngine();
      const rule: ScriptValidation = {
        type: 'script',
        name: 'age_check',
        label: 'Age Check',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Must be 18 or older',
        condition: 'age >= 18',
      };

      const context: ObjectValidationContext = {
        record: { age: 25 },
      };

      const results = await engine.validateRecord([rule], context, 'insert');
      expect(results).toHaveLength(0); // No errors
    });

    it('should fail validation when script condition is false', async () => {
      const engine = new ObjectValidationEngine();
      const rule: ScriptValidation = {
        type: 'script',
        name: 'age_check',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Must be 18 or older',
        condition: 'age >= 18',
      };

      const context: ObjectValidationContext = {
        record: { age: 16 },
      };

      const results = await engine.validateRecord([rule], context, 'insert');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        valid: false,
        message: 'Must be 18 or older',
        rule: 'age_check',
        severity: 'error',
      });
    });

    it('should support complex script conditions', async () => {
      const engine = new ObjectValidationEngine();
      const rule: ScriptValidation = {
        type: 'script',
        name: 'discount_check',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Discount cannot exceed 50% for non-premium customers',
        condition: 'discount <= 50 || is_premium === true',
      };

      const context1: ObjectValidationContext = {
        record: { discount: 30, is_premium: false },
      };
      const results1 = await engine.validateRecord([rule], context1, 'insert');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { discount: 75, is_premium: true },
      };
      const results2 = await engine.validateRecord([rule], context2, 'insert');
      expect(results2).toHaveLength(0);

      const context3: ObjectValidationContext = {
        record: { discount: 75, is_premium: false },
      };
      const results3 = await engine.validateRecord([rule], context3, 'insert');
      expect(results3).toHaveLength(1);
    });
  });

  describe('UniquenessValidation', () => {
    it('should validate uniqueness using custom checker', async () => {
      const uniquenessChecker = vi.fn().mockResolvedValue(true);
      const engine = new ObjectValidationEngine(undefined, uniquenessChecker);

      const rule: UniquenessValidation = {
        type: 'unique',
        name: 'unique_email',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Email must be unique',
        fields: ['email'],
      };

      const context: ObjectValidationContext = {
        record: { email: 'user@example.com' },
      };

      const results = await engine.validateRecord([rule], context, 'insert');
      expect(results).toHaveLength(0);
      expect(uniquenessChecker).toHaveBeenCalledWith(
        ['email'],
        { email: 'user@example.com' },
        undefined,
        context
      );
    });

    it('should fail when uniqueness check fails', async () => {
      const uniquenessChecker = vi.fn().mockResolvedValue(false);
      const engine = new ObjectValidationEngine(undefined, uniquenessChecker);

      const rule: UniquenessValidation = {
        type: 'unique',
        name: 'unique_email',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Email must be unique',
        fields: ['email'],
      };

      const context: ObjectValidationContext = {
        record: { email: 'duplicate@example.com' },
      };

      const results = await engine.validateRecord([rule], context, 'insert');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        valid: false,
        message: 'Email must be unique',
      });
    });

    it('should support multi-field uniqueness', async () => {
      const uniquenessChecker = vi.fn().mockResolvedValue(true);
      const engine = new ObjectValidationEngine(undefined, uniquenessChecker);

      const rule: UniquenessValidation = {
        type: 'unique',
        name: 'unique_email_tenant',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Email must be unique within tenant',
        fields: ['email', 'tenant_id'],
      };

      const context: ObjectValidationContext = {
        record: { email: 'user@example.com', tenant_id: 'tenant-123' },
      };

      await engine.validateRecord([rule], context, 'insert');
      expect(uniquenessChecker).toHaveBeenCalledWith(
        ['email', 'tenant_id'],
        { email: 'user@example.com', tenant_id: 'tenant-123' },
        undefined,
        context
      );
    });
  });

  describe('StateMachineValidation', () => {
    it('should allow valid state transition', async () => {
      const engine = new ObjectValidationEngine();
      const rule: StateMachineValidation = {
        type: 'state_machine',
        name: 'order_status_flow',
        active: true,
        events: ['update'],
        severity: 'error',
        message: 'Invalid status transition',
        stateField: 'status',
        transitions: [
          { from: 'draft', to: 'submitted' },
          { from: 'submitted', to: 'approved' },
          { from: 'submitted', to: 'rejected' },
          { from: 'approved', to: 'completed' },
        ],
      };

      const context: ObjectValidationContext = {
        record: { status: 'submitted' },
        oldRecord: { status: 'draft' },
      };

      const results = await engine.validateRecord([rule], context, 'update');
      expect(results).toHaveLength(0);
    });

    it('should prevent invalid state transition', async () => {
      const engine = new ObjectValidationEngine();
      const rule: StateMachineValidation = {
        type: 'state_machine',
        name: 'order_status_flow',
        active: true,
        events: ['update'],
        severity: 'error',
        message: 'Invalid status transition',
        stateField: 'status',
        transitions: [
          { from: 'draft', to: 'submitted' },
          { from: 'submitted', to: 'approved' },
        ],
      };

      const context: ObjectValidationContext = {
        record: { status: 'approved' },
        oldRecord: { status: 'draft' },
      };

      const results = await engine.validateRecord([rule], context, 'update');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        valid: false,
      });
      expect(results[0].message).toContain('transition');
    });

    it('should support conditional state transitions', async () => {
      const engine = new ObjectValidationEngine();
      const rule: StateMachineValidation = {
        type: 'state_machine',
        name: 'conditional_transition',
        active: true,
        events: ['update'],
        severity: 'error',
        message: 'Invalid transition',
        stateField: 'status',
        transitions: [
          {
            from: 'pending',
            to: 'approved',
            condition: 'amount < 1000',
          },
        ],
      };

      const context1: ObjectValidationContext = {
        record: { status: 'approved', amount: 500 },
        oldRecord: { status: 'pending', amount: 500 },
      };
      const results1 = await engine.validateRecord([rule], context1, 'update');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { status: 'approved', amount: 2000 },
        oldRecord: { status: 'pending', amount: 2000 },
      };
      const results2 = await engine.validateRecord([rule], context2, 'update');
      expect(results2).toHaveLength(1);
    });
  });

  describe('CrossFieldValidation', () => {
    it('should validate cross-field constraints', async () => {
      const engine = new ObjectValidationEngine();
      const rule: CrossFieldValidation = {
        type: 'cross_field',
        name: 'date_range',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'End date must be after start date',
        fields: ['start_date', 'end_date'],
        condition: 'end_date > start_date',
      };

      const context1: ObjectValidationContext = {
        record: { start_date: new Date('2024-01-01'), end_date: new Date('2024-12-31') },
      };
      const results1 = await engine.validateRecord([rule], context1, 'insert');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { start_date: new Date('2024-12-31'), end_date: new Date('2024-01-01') },
      };
      const results2 = await engine.validateRecord([rule], context2, 'insert');
      expect(results2).toHaveLength(1);
    });
  });

  describe('FormatValidation', () => {
    it('should validate email format', async () => {
      const engine = new ObjectValidationEngine();
      const rule: FormatValidation = {
        type: 'format',
        name: 'email_format',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Invalid email format',
        field: 'email',
        format: 'email',
      };

      const context1: ObjectValidationContext = {
        record: { email: 'user@example.com' },
      };
      const results1 = await engine.validateRecord([rule], context1, 'insert');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { email: 'invalid-email' },
      };
      const results2 = await engine.validateRecord([rule], context2, 'insert');
      expect(results2).toHaveLength(1);
    });

    it('should validate URL format', async () => {
      const engine = new ObjectValidationEngine();
      const rule: FormatValidation = {
        type: 'format',
        name: 'url_format',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Invalid URL format',
        field: 'website',
        format: 'url',
      };

      const context1: ObjectValidationContext = {
        record: { website: 'https://example.com' },
      };
      const results1 = await engine.validateRecord([rule], context1, 'insert');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { website: 'not-a-url' },
      };
      const results2 = await engine.validateRecord([rule], context2, 'insert');
      expect(results2).toHaveLength(1);
    });

    it('should validate custom regex pattern', async () => {
      const engine = new ObjectValidationEngine();
      const rule: FormatValidation = {
        type: 'format',
        name: 'custom_pattern',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Must be 3 uppercase letters',
        field: 'code',
        pattern: '^[A-Z]{3}$',
      };

      const context1: ObjectValidationContext = {
        record: { code: 'ABC' },
      };
      const results1 = await engine.validateRecord([rule], context1, 'insert');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { code: 'ab' },
      };
      const results2 = await engine.validateRecord([rule], context2, 'insert');
      expect(results2).toHaveLength(1);
    });
  });

  describe('RangeValidation', () => {
    it('should validate numeric ranges', async () => {
      const engine = new ObjectValidationEngine();
      const rule: RangeValidation = {
        type: 'range',
        name: 'age_range',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Age must be between 18 and 65',
        field: 'age',
        min: 18,
        max: 65,
      };

      const context1: ObjectValidationContext = {
        record: { age: 30 },
      };
      const results1 = await engine.validateRecord([rule], context1, 'insert');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { age: 16 },
      };
      const results2 = await engine.validateRecord([rule], context2, 'insert');
      expect(results2).toHaveLength(1);

      const context3: ObjectValidationContext = {
        record: { age: 70 },
      };
      const results3 = await engine.validateRecord([rule], context3, 'insert');
      expect(results3).toHaveLength(1);
    });

    it('should validate date ranges', async () => {
      const engine = new ObjectValidationEngine();
      const rule: RangeValidation = {
        type: 'range',
        name: 'date_range',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Date must be in 2024',
        field: 'event_date',
        min: new Date('2024-01-01'),
        max: new Date('2024-12-31'),
      };

      const context1: ObjectValidationContext = {
        record: { event_date: new Date('2024-06-15') },
      };
      const results1 = await engine.validateRecord([rule], context1, 'insert');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { event_date: new Date('2025-01-01') },
      };
      const results2 = await engine.validateRecord([rule], context2, 'insert');
      expect(results2).toHaveLength(1);
    });
  });

  describe('ConditionalValidation', () => {
    it('should apply nested rules when condition is met', async () => {
      const engine = new ObjectValidationEngine();
      const rule: ConditionalValidation = {
        type: 'conditional',
        name: 'conditional_validation',
        active: true,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Conditional validation',
        condition: 'is_company === true',
        rules: [
          {
            type: 'script',
            name: 'company_name_required',
            active: true,
            events: ['insert', 'update'],
            severity: 'error',
            message: 'Company name is required',
            condition: 'company_name !== null && company_name !== ""',
          },
        ],
      };

      const context1: ObjectValidationContext = {
        record: { is_company: true, company_name: 'Acme Corp' },
      };
      const results1 = await engine.validateRecord([rule], context1, 'insert');
      expect(results1).toHaveLength(0);

      const context2: ObjectValidationContext = {
        record: { is_company: true, company_name: '' },
      };
      const results2 = await engine.validateRecord([rule], context2, 'insert');
      expect(results2).toHaveLength(1);

      const context3: ObjectValidationContext = {
        record: { is_company: false, company_name: '' },
      };
      const results3 = await engine.validateRecord([rule], context3, 'insert');
      expect(results3).toHaveLength(0); // Condition not met, rules not applied
    });
  });

  describe('Event Filtering', () => {
    it('should only run rules for matching events', async () => {
      const engine = new ObjectValidationEngine();
      const rule: ScriptValidation = {
        type: 'script',
        name: 'insert_only',
        active: true,
        events: ['insert'],
        severity: 'error',
        message: 'Validation message',
        condition: 'value > 0',
      };

      const context: ObjectValidationContext = {
        record: { value: -1 },
      };

      const insertResults = await engine.validateRecord([rule], context, 'insert');
      expect(insertResults).toHaveLength(1);

      const updateResults = await engine.validateRecord([rule], context, 'update');
      expect(updateResults).toHaveLength(0); // Rule not applied for update
    });
  });

  describe('Active Flag', () => {
    it('should skip inactive rules', async () => {
      const engine = new ObjectValidationEngine();
      const rule: ScriptValidation = {
        type: 'script',
        name: 'inactive_rule',
        active: false,
        events: ['insert', 'update'],
        severity: 'error',
        message: 'Validation message',
        condition: 'false',
      };

      const context: ObjectValidationContext = {
        record: { value: 1 },
      };

      const results = await engine.validateRecord([rule], context, 'insert');
      expect(results).toHaveLength(0); // Rule skipped because inactive
    });
  });

  describe('Severity Levels', () => {
    it('should return validation results with correct severity', async () => {
      const engine = new ObjectValidationEngine();
      const warningRule: ScriptValidation = {
        type: 'script',
        name: 'warning_check',
        active: true,
        events: ['insert', 'update'],
        severity: 'warning',
        message: 'This is a warning',
        condition: 'false',
      };

      const context: ObjectValidationContext = {
        record: {},
      };

      const results = await engine.validateRecord([warningRule], context, 'insert');
      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
    });
  });
});
