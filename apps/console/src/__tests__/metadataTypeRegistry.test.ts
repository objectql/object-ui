/**
 * Metadata Type Registry Tests
 *
 * Tests for the centralized metadata type configuration registry.
 */

import { describe, it, expect } from 'vitest';
import {
  METADATA_TYPES,
  getMetadataTypeConfig,
  getGenericMetadataTypes,
  getHubMetadataTypes,
  DEFAULT_FORM_FIELDS,
  type MetadataTypeConfig,
  type MetadataFormFieldDef,
  type MetadataActionDef,
} from '../config/metadataTypeRegistry';

describe('metadataTypeRegistry', () => {
  describe('METADATA_TYPES', () => {
    it('should contain at least the core metadata types', () => {
      const types = METADATA_TYPES.map((m) => m.type);
      expect(types).toContain('app');
      expect(types).toContain('object');
      expect(types).toContain('dashboard');
      expect(types).toContain('page');
      expect(types).toContain('report');
    });

    it('should have required fields for every entry', () => {
      for (const entry of METADATA_TYPES) {
        expect(entry.type).toBeTruthy();
        expect(entry.label).toBeTruthy();
        expect(entry.pluralLabel).toBeTruthy();
        expect(entry.description).toBeTruthy();
        expect(entry.icon).toBeTruthy();
      }
    });

    it('should mark app and object as having custom pages', () => {
      const app = METADATA_TYPES.find((m) => m.type === 'app')!;
      const obj = METADATA_TYPES.find((m) => m.type === 'object')!;
      expect(app.hasCustomPage).toBe(true);
      expect(app.customRoute).toBe('/system/apps');
      expect(obj.hasCustomPage).toBe(true);
      expect(obj.customRoute).toBe('/system/objects');
    });

    it('should not mark generic types as having custom pages', () => {
      const dashboard = METADATA_TYPES.find((m) => m.type === 'dashboard')!;
      const page = METADATA_TYPES.find((m) => m.type === 'page')!;
      const report = METADATA_TYPES.find((m) => m.type === 'report')!;
      expect(dashboard.hasCustomPage).toBeFalsy();
      expect(page.hasCustomPage).toBeFalsy();
      expect(report.hasCustomPage).toBeFalsy();
    });

    it('should have unique type strings', () => {
      const types = METADATA_TYPES.map((m) => m.type);
      expect(new Set(types).size).toBe(types.length);
    });
  });

  describe('getMetadataTypeConfig', () => {
    it('should return config for known types', () => {
      const config = getMetadataTypeConfig('dashboard');
      expect(config).toBeDefined();
      expect(config!.type).toBe('dashboard');
      expect(config!.label).toBe('Dashboard');
    });

    it('should return undefined for unknown types', () => {
      expect(getMetadataTypeConfig('nonexistent')).toBeUndefined();
    });
  });

  describe('getGenericMetadataTypes', () => {
    it('should exclude types with custom pages', () => {
      const generic = getGenericMetadataTypes();
      const types = generic.map((m) => m.type);
      expect(types).not.toContain('app');
      expect(types).not.toContain('object');
    });

    it('should include generic types', () => {
      const generic = getGenericMetadataTypes();
      const types = generic.map((m) => m.type);
      expect(types).toContain('dashboard');
      expect(types).toContain('page');
      expect(types).toContain('report');
    });
  });

  describe('getHubMetadataTypes', () => {
    it('should return all metadata types', () => {
      const hub = getHubMetadataTypes();
      expect(hub.length).toBe(METADATA_TYPES.length);
    });
  });

  describe('formFields', () => {
    it('should have formFields on generic metadata types', () => {
      const generic = getGenericMetadataTypes();
      for (const entry of generic) {
        expect(entry.formFields).toBeDefined();
        expect(entry.formFields!.length).toBeGreaterThan(0);
      }
    });

    it('should include name, label, and description fields', () => {
      const dashboard = getMetadataTypeConfig('dashboard')!;
      const keys = dashboard.formFields!.map((f) => f.key);
      expect(keys).toContain('name');
      expect(keys).toContain('label');
      expect(keys).toContain('description');
    });

    it('should mark name as disabledOnEdit', () => {
      const dashboard = getMetadataTypeConfig('dashboard')!;
      const nameField = dashboard.formFields!.find((f) => f.key === 'name')!;
      expect(nameField.disabledOnEdit).toBe(true);
    });
  });

  describe('DEFAULT_FORM_FIELDS', () => {
    it('should contain name, label, and description', () => {
      const keys = DEFAULT_FORM_FIELDS.map((f) => f.key);
      expect(keys).toEqual(['name', 'label', 'description']);
    });

    it('should mark name and label as required', () => {
      const name = DEFAULT_FORM_FIELDS.find((f) => f.key === 'name')!;
      const label = DEFAULT_FORM_FIELDS.find((f) => f.key === 'label')!;
      expect(name.required).toBe(true);
      expect(label.required).toBe(true);
    });
  });

  describe('MetadataTypeConfig type support', () => {
    it('should accept actions field in MetadataTypeConfig', () => {
      const config: MetadataTypeConfig = {
        type: 'test',
        label: 'Test',
        pluralLabel: 'Tests',
        description: 'Test type',
        icon: 'database',
        actions: [
          { key: 'export', label: 'Export', scope: 'page' },
          { key: 'view', label: 'View', scope: 'row' },
        ],
      };
      expect(config.actions).toHaveLength(2);
      expect(config.actions![0].scope).toBe('page');
      expect(config.actions![1].scope).toBe('row');
    });

    it('should accept detailComponent field in MetadataTypeConfig', () => {
      const config: MetadataTypeConfig = {
        type: 'test',
        label: 'Test',
        pluralLabel: 'Tests',
        description: 'Test type',
        icon: 'database',
        detailComponent: () => null,
      };
      expect(config.detailComponent).toBeDefined();
    });
  });
});
