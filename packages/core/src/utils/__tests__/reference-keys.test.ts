/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeFieldReferenceKeys,
  normalizeSchemaReferenceKeys,
} from '../reference-keys';

describe('normalizeFieldReferenceKeys', () => {
  it('stamps reference_to from the ObjectStack-convention `reference` key', () => {
    // Exactly what the showcase backend serves for showcase_project.account.
    const field = { type: 'lookup', reference: 'showcase_account' } as any;
    normalizeFieldReferenceKeys(field);
    expect(field.reference_to).toBe('showcase_account');
    expect(field.reference).toBe('showcase_account');
  });

  it('stamps `reference` from a reference_to-keyed (ObjectUI-authored) field', () => {
    const field = { type: 'master_detail', reference_to: 'showcase_project' } as any;
    normalizeFieldReferenceKeys(field);
    expect(field.reference).toBe('showcase_project');
  });

  it('accepts legacy camelCase referenceTo as a source', () => {
    const field = { type: 'lookup', referenceTo: 'accounts' } as any;
    normalizeFieldReferenceKeys(field);
    expect(field.reference_to).toBe('accounts');
    expect(field.reference).toBe('accounts');
  });

  it('never overwrites keys that are already set', () => {
    // Divergent keys are broken metadata; first-wins (reference_to) but the
    // existing `reference` value must not be clobbered.
    const field = { reference_to: 'a', reference: 'b' } as any;
    normalizeFieldReferenceKeys(field);
    expect(field.reference_to).toBe('a');
    expect(field.reference).toBe('b');
  });

  it('is a no-op for non-relational fields, empty targets, and non-objects', () => {
    const plain = { type: 'text' } as any;
    normalizeFieldReferenceKeys(plain);
    expect('reference_to' in plain).toBe(false);
    expect('reference' in plain).toBe(false);

    const empty = { type: 'lookup', reference: '' } as any;
    normalizeFieldReferenceKeys(empty);
    expect('reference_to' in empty).toBe(false);

    expect(normalizeFieldReferenceKeys(null)).toBeNull();
    expect(normalizeFieldReferenceKeys('lookup' as any)).toBe('lookup');
  });

  it('is idempotent', () => {
    const field = { type: 'user', reference: 'sys_user' } as any;
    normalizeFieldReferenceKeys(normalizeFieldReferenceKeys(field));
    expect(field).toEqual({ type: 'user', reference: 'sys_user', reference_to: 'sys_user' });
  });
});

describe('normalizeSchemaReferenceKeys', () => {
  it('normalizes every field of a map-shaped schema in place', () => {
    const schema = {
      name: 'showcase_project',
      fields: {
        name: { type: 'text' },
        account: { type: 'lookup', reference: 'showcase_account' },
        team_members: { type: 'user', reference: 'sys_user', multiple: true },
      },
    } as any;
    const out = normalizeSchemaReferenceKeys(schema);
    expect(out).toBe(schema); // mutates the cached object, not a copy
    expect(schema.fields.account.reference_to).toBe('showcase_account');
    expect(schema.fields.team_members.reference_to).toBe('sys_user');
    expect('reference_to' in schema.fields.name).toBe(false);
  });

  it('normalizes array-shaped field containers', () => {
    const schema = {
      fields: [
        { name: 'project', type: 'master_detail', reference: 'showcase_project' },
        { name: 'title', type: 'text' },
      ],
    } as any;
    normalizeSchemaReferenceKeys(schema);
    expect(schema.fields[0].reference_to).toBe('showcase_project');
  });

  it('tolerates schemas without fields and non-object input', () => {
    expect(normalizeSchemaReferenceKeys(null)).toBeNull();
    expect(normalizeSchemaReferenceKeys({ name: 'x' } as any)).toEqual({ name: 'x' });
    expect(normalizeSchemaReferenceKeys({ fields: 'nope' } as any)).toEqual({ fields: 'nope' });
  });
});
