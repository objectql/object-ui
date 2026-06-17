import { describe, it, expect } from 'vitest';
import { readObjectFieldGroups, deriveFieldGroupSections } from './fieldGroups';
import type { FormField } from '@object-ui/types';

const field = (name: string, group?: string): FormField =>
  ({ name, label: name, ...(group ? { group } : {}) }) as FormField;

describe('readObjectFieldGroups', () => {
  it('normalizes a well-formed list', () => {
    expect(
      readObjectFieldGroups([
        { key: 'contact', label: 'Contact' },
        { key: 'billing', label: 'Billing' },
      ]),
    ).toEqual([
      { key: 'contact', label: 'Contact' },
      { key: 'billing', label: 'Billing' },
    ]);
  });

  it('drops entries without a string key and tolerates a missing label', () => {
    expect(
      readObjectFieldGroups([
        { key: 'contact' },
        { label: 'no key' },
        { key: 42 },
        null,
        'nope',
      ]),
    ).toEqual([{ key: 'contact', label: undefined }]);
  });

  it('returns [] for non-array input', () => {
    expect(readObjectFieldGroups(undefined)).toEqual([]);
    expect(readObjectFieldGroups(null)).toEqual([]);
    expect(readObjectFieldGroups({})).toEqual([]);
  });
});

describe('deriveFieldGroupSections', () => {
  const groups = [
    { key: 'contact', label: 'Contact Info' },
    { key: 'billing', label: 'Billing' },
  ];

  it('returns null when no groups are declared', () => {
    expect(deriveFieldGroupSections([field('a', 'contact')], undefined)).toBeNull();
    expect(deriveFieldGroupSections([field('a', 'contact')], [])).toBeNull();
  });

  it('returns null when no field opts into a declared group', () => {
    expect(deriveFieldGroupSections([field('a'), field('b')], groups)).toBeNull();
    // group references an undeclared key → treated as ungrouped → null
    expect(deriveFieldGroupSections([field('a', 'unknown')], groups)).toBeNull();
  });

  it('groups fields in declared order using field names', () => {
    const sections = deriveFieldGroupSections(
      [field('email', 'contact'), field('amount', 'billing'), field('phone', 'contact')],
      groups,
    );
    expect(sections).toEqual([
      { name: 'contact', label: 'Contact Info', fields: ['email', 'phone'] },
      { name: 'billing', label: 'Billing', fields: ['amount'] },
    ]);
  });

  it('drops empty declared groups', () => {
    const sections = deriveFieldGroupSections([field('email', 'contact')], groups);
    expect(sections).toEqual([
      { name: 'contact', label: 'Contact Info', fields: ['email'] },
    ]);
  });

  it('collects ungrouped fields into a trailing untitled section', () => {
    const sections = deriveFieldGroupSections(
      [field('name'), field('email', 'contact'), field('notes', 'unknown')],
      groups,
    );
    expect(sections).toEqual([
      { name: 'contact', label: 'Contact Info', fields: ['email'] },
      { fields: ['name', 'notes'] },
    ]);
    // The trailing bucket carries no name/label so it renders flat (no header).
    expect(sections?.[1]).not.toHaveProperty('name');
    expect(sections?.[1]).not.toHaveProperty('label');
  });

  it('falls back to a group key when no label is given', () => {
    const sections = deriveFieldGroupSections(
      [field('email', 'contact')],
      [{ key: 'contact' }],
    );
    expect(sections).toEqual([{ name: 'contact', label: 'contact', fields: ['email'] }]);
  });
});
