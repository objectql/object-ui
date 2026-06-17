import { describe, it, expect } from 'vitest';
import { normalizeSectionField, buildSectionFields } from './sectionFields';
import { mapFieldTypeToFormType } from '@object-ui/fields';

const objectSchema = {
  name: 'crm_account',
  fields: {
    name: { type: 'text', label: 'Account Name', required: true, description: 'Legal name' },
    industry: {
      type: 'select',
      label: 'Industry',
      options: [{ label: 'Tech', value: 'tech' }],
    },
    billing_address: { type: 'address', label: 'Billing Address' },
  },
};

const ctx = {
  objectSchema,
  objectName: 'crm_account',
  fieldLabel: (_obj: string, _name: string, fallback?: string) => fallback || _name,
};

describe('normalizeSectionField', () => {
  it('resolves a spec FormFieldSchema object (key `field`, not `name`)', () => {
    // This is the exact shape that crashed the form: react-hook-form received
    // `name === undefined` and threw on `name.split('.')`.
    const f = normalizeSectionField({ field: 'name', required: true, colSpan: 2 }, ctx);
    expect(f.name).toBe('name');           // ← was undefined before the fix
    expect(f.type).toBe(mapFieldTypeToFormType('text')); // merged from object schema
    expect(f.required).toBe(true);         // spec override
    expect((f as any).colSpan).toBe(2);    // spec override
    expect((f as any).field).toMatchObject({ type: 'text' }); // metadata object, not the string
  });

  it('merges select options + label from the object schema', () => {
    const f = normalizeSectionField({ field: 'industry' }, ctx);
    expect(f.name).toBe('industry');
    expect(f.type).toBe(mapFieldTypeToFormType('select'));
    expect((f as any).options).toEqual([{ label: 'Tech', value: 'tech' }]);
  });

  it('maps spec override keys (helpText→description, readonly→disabled)', () => {
    const f = normalizeSectionField(
      { field: 'name', helpText: 'Custom hint', readonly: true },
      ctx,
    );
    expect(f.description).toBe('Custom hint');
    expect((f as any).disabled).toBe(true);
  });

  it('builds from the object schema for a string shorthand', () => {
    const f = normalizeSectionField('industry', ctx);
    expect(f.name).toBe('industry');
    expect(f.type).toBe(mapFieldTypeToFormType('select'));
  });

  it('passes a runtime FormField object through unchanged (field = metadata object)', () => {
    const runtime = { name: 'custom', type: 'text', label: 'Custom' };
    const f = normalizeSectionField(runtime as any, ctx);
    expect(f.name).toBe('custom');
    expect(f.type).toBe('text');
  });

  it('still yields a name when the spec field is not in the object schema', () => {
    const f = normalizeSectionField({ field: 'ghost', required: true }, ctx);
    expect(f.name).toBe('ghost'); // never undefined → no `.split` crash
  });
});

describe('buildSectionFields', () => {
  it('normalizes a mixed section (string + spec object) with no undefined names', () => {
    const fields = buildSectionFields(
      { fields: ['industry', { field: 'name', required: true, colSpan: 2 }] },
      ctx,
    );
    expect(fields.map((f) => f.name)).toEqual(['industry', 'name']);
    expect(fields.every((f) => typeof f.name === 'string')).toBe(true);
  });
});
