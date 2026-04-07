/**
 * Metadata Converters Tests
 *
 * Tests for the shared toObjectDefinition and toFieldDefinition converters.
 */

import { describe, it, expect } from 'vitest';
import {
  toObjectDefinition,
  toFieldDefinition,
  type MetadataObject,
  type MetadataField,
} from '../utils/metadataConverters';

describe('metadataConverters', () => {
  describe('toObjectDefinition', () => {
    it('should convert basic object definition', () => {
      const obj: MetadataObject = {
        name: 'account',
        label: 'Account',
        description: 'Customer accounts',
        enabled: true,
        fields: [
          { name: 'id', type: 'text' },
          { name: 'name', type: 'text' },
        ],
      };

      const result = toObjectDefinition(obj, 0);
      expect(result.id).toBe('account');
      expect(result.name).toBe('account');
      expect(result.label).toBe('Account');
      expect(result.description).toBe('Customer accounts');
      expect(result.enabled).toBe(true);
      expect(result.fieldCount).toBe(2);
      expect(result.group).toBe('Custom Objects');
      expect(result.isSystem).toBe(false);
    });

    it('should detect system objects by sys_ prefix', () => {
      const obj: MetadataObject = {
        name: 'sys_user',
        label: 'User',
      };
      const result = toObjectDefinition(obj, 0);
      expect(result.isSystem).toBe(true);
      expect(result.group).toBe('System Objects');
    });

    it('should handle object label as object with defaultValue', () => {
      const obj: MetadataObject = {
        name: 'test',
        label: { defaultValue: 'Test Label' },
      };
      const result = toObjectDefinition(obj, 0);
      expect(result.label).toBe('Test Label');
    });

    it('should handle pluralLabel with snake_case fallback', () => {
      const obj: MetadataObject = {
        name: 'test',
        label: 'Test',
        plural_label: 'Tests',
      };
      const result = toObjectDefinition(obj, 0);
      expect(result.pluralLabel).toBe('Tests');
    });

    it('should convert relationships', () => {
      const obj: MetadataObject = {
        name: 'account',
        label: 'Account',
        relationships: [
          { object: 'contact', type: 'one-to-many', name: 'contacts' },
        ],
      };
      const result = toObjectDefinition(obj, 0);
      expect(result.relationships).toHaveLength(1);
      expect(result.relationships![0].relatedObject).toBe('contact');
      expect(result.relationships![0].type).toBe('one-to-many');
    });

    it('should handle fields as Record (object format)', () => {
      const obj: MetadataObject = {
        name: 'account',
        label: 'Account',
        fields: {
          id: { name: 'id', type: 'text' },
          name: { name: 'name', type: 'text' },
          email: { name: 'email', type: 'email' },
        },
      };
      const result = toObjectDefinition(obj, 0);
      expect(result.fieldCount).toBe(3);
    });
  });

  describe('toFieldDefinition', () => {
    it('should convert basic field definition', () => {
      const field: MetadataField = {
        name: 'email',
        label: 'Email',
        type: 'email',
        required: true,
      };
      const result = toFieldDefinition(field, 0);
      expect(result.id).toBe('email');
      expect(result.name).toBe('email');
      expect(result.label).toBe('Email');
      expect(result.type).toBe('email');
      expect(result.required).toBe(true);
    });

    it('should detect system fields (id, createdAt, updatedAt)', () => {
      const field: MetadataField = {
        name: 'id',
        label: 'ID',
        type: 'text',
        readonly: true,
      };
      const result = toFieldDefinition(field, 0);
      expect(result.isSystem).toBe(true);
    });

    it('should handle default_value snake_case fallback', () => {
      const field: MetadataField = {
        name: 'status',
        type: 'text',
        default_value: 'active',
      };
      const result = toFieldDefinition(field, 0);
      expect(result.defaultValue).toBe('active');
    });

    it('should convert string options to label/value pairs', () => {
      const field: MetadataField = {
        name: 'status',
        type: 'select',
        options: ['active', 'inactive'],
      };
      const result = toFieldDefinition(field, 0);
      expect(result.options).toEqual([
        { label: 'active', value: 'active' },
        { label: 'inactive', value: 'inactive' },
      ]);
    });

    it('should handle object options with color', () => {
      const field: MetadataField = {
        name: 'priority',
        type: 'select',
        options: [
          { label: 'High', value: 'high', color: 'red' },
          { value: 'low' },
        ],
      };
      const result = toFieldDefinition(field, 0);
      expect(result.options).toEqual([
        { label: 'High', value: 'high', color: 'red' },
        { label: 'low', value: 'low', color: undefined },
      ]);
    });

    it('should handle reference_to snake_case fallback', () => {
      const field: MetadataField = {
        name: 'account_id',
        type: 'lookup',
        reference_to: 'account',
      };
      const result = toFieldDefinition(field, 0);
      expect(result.referenceTo).toBe('account');
    });
  });
});
