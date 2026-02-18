/**
 * ReportView Dynamic Fields Unit Tests
 *
 * Tests the field derivation logic that replaces hardcoded MOCK_FIELDS
 * with fields from object schema. Uses a lightweight approach to avoid
 * OOM issues from heavy plugin-report imports.
 */

import { describe, it, expect } from 'vitest';

/**
 * Port of the availableFields derivation logic from ReportView.tsx.
 * This tests the pure logic without importing the full component tree.
 */
function deriveAvailableFields(
  reportData: any,
  objects: any[],
  fallbackFields: any[]
): any[] {
  const objName = reportData?.objectName || reportData?.dataSource?.object || reportData?.dataSource?.resource;
  if (objName && objects?.length) {
    const objDef = objects.find((o: any) => o.name === objName);
    if (objDef?.fields) {
      const fields = objDef.fields;
      if (Array.isArray(fields)) {
        return fields.map((f: any) =>
          typeof f === 'string'
            ? { name: f, label: f, type: 'text' }
            : { name: f.name, label: f.label || f.name, type: f.type || 'text' },
        );
      }
      return Object.entries(fields).map(([name, def]: [string, any]) => ({
        name,
        label: def.label || name,
        type: def.type || 'text',
      }));
    }
  }
  return fallbackFields;
}

const FALLBACK = [
  { name: 'month', label: 'Month', type: 'string' },
  { name: 'revenue', label: 'Revenue', type: 'number' },
];

const OBJECTS = [
  {
    name: 'opportunity',
    label: 'Opportunity',
    fields: [
      { name: 'name', label: 'Deal Name', type: 'text' },
      { name: 'amount', label: 'Amount', type: 'currency' },
      { name: 'stage', label: 'Stage', type: 'select' },
    ],
  },
  {
    name: 'contact',
    label: 'Contact',
    fields: {
      first_name: { label: 'First Name', type: 'text' },
      last_name: { label: 'Last Name', type: 'text' },
      email: { label: 'Email', type: 'email' },
    },
  },
];

describe('ReportView Dynamic Fields Logic', () => {
  it('should derive fields from array-style object schema', () => {
    const fields = deriveAvailableFields({ objectName: 'opportunity' }, OBJECTS, FALLBACK);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual({ name: 'name', label: 'Deal Name', type: 'text' });
    expect(fields[1]).toEqual({ name: 'amount', label: 'Amount', type: 'currency' });
    expect(fields[2]).toEqual({ name: 'stage', label: 'Stage', type: 'select' });
  });

  it('should derive fields from object-map-style schema', () => {
    const fields = deriveAvailableFields({ objectName: 'contact' }, OBJECTS, FALLBACK);
    expect(fields).toHaveLength(3);
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'first_name', label: 'First Name', type: 'text' }),
        expect.objectContaining({ name: 'email', label: 'Email', type: 'email' }),
      ])
    );
  });

  it('should use dataSource.object for lookup', () => {
    const fields = deriveAvailableFields(
      { dataSource: { object: 'opportunity' } },
      OBJECTS,
      FALLBACK
    );
    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual({ name: 'name', label: 'Deal Name', type: 'text' });
  });

  it('should use dataSource.resource for lookup', () => {
    const fields = deriveAvailableFields(
      { dataSource: { resource: 'contact' } },
      OBJECTS,
      FALLBACK
    );
    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual(expect.objectContaining({ name: 'first_name' }));
  });

  it('should fall back to defaults when no matching object found', () => {
    const fields = deriveAvailableFields({ objectName: 'nonexistent' }, OBJECTS, FALLBACK);
    expect(fields).toBe(FALLBACK);
  });

  it('should fall back to defaults when reportData has no objectName or dataSource', () => {
    const fields = deriveAvailableFields({}, OBJECTS, FALLBACK);
    expect(fields).toBe(FALLBACK);
  });

  it('should fall back to defaults when objects list is empty', () => {
    const fields = deriveAvailableFields({ objectName: 'opportunity' }, [], FALLBACK);
    expect(fields).toBe(FALLBACK);
  });

  it('should handle string-only fields', () => {
    const objects = [
      { name: 'simple', fields: ['id', 'name', 'email'] },
    ];
    const fields = deriveAvailableFields({ objectName: 'simple' }, objects, FALLBACK);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual({ name: 'id', label: 'id', type: 'text' });
  });
});
