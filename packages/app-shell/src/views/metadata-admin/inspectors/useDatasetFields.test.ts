// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  resolveLabel,
  resolveReferenceTo,
  fieldTypeToDimensionType,
  normalizeObject,
  buildFieldOptions,
  resolvePath,
  referencesDataset,
  type NormalizedObject,
} from './useDatasetFields';

describe('resolveLabel', () => {
  it('reads a plain string', () => expect(resolveLabel('Region', 'x')).toBe('Region'));
  it('reads an i18n object default', () => expect(resolveLabel({ default: 'Région' }, 'x')).toBe('Région'));
  it('falls back when empty / missing', () => {
    expect(resolveLabel('', 'fallback')).toBe('fallback');
    expect(resolveLabel(undefined, 'fallback')).toBe('fallback');
    expect(resolveLabel({}, 'fallback')).toBe('fallback');
  });
});

describe('resolveReferenceTo', () => {
  it('reads string / camel / snake variants', () => {
    expect(resolveReferenceTo({ reference: 'account' })).toBe('account'); // framework lookup shape
    expect(resolveReferenceTo({ reference_to: 'account' })).toBe('account');
    expect(resolveReferenceTo({ referenceTo: 'account' })).toBe('account');
    expect(resolveReferenceTo({ reference_to_object: 'account' })).toBe('account');
  });
  it('reads array + object shapes', () => {
    expect(resolveReferenceTo({ reference_to: ['account', 'lead'] })).toBe('account');
    expect(resolveReferenceTo({ reference_to: { object: 'account' } })).toBe('account');
  });
  it('returns undefined when absent', () => expect(resolveReferenceTo({ type: 'text' })).toBeUndefined());
});

describe('fieldTypeToDimensionType', () => {
  it('maps relationships → lookup', () => {
    expect(fieldTypeToDimensionType('lookup')).toBe('lookup');
    expect(fieldTypeToDimensionType('master_detail')).toBe('lookup');
  });
  it('maps temporal → date and numeric → number', () => {
    expect(fieldTypeToDimensionType('datetime')).toBe('date');
    expect(fieldTypeToDimensionType('currency')).toBe('number');
    expect(fieldTypeToDimensionType('percent')).toBe('number');
  });
  it('maps boolean and defaults to string', () => {
    expect(fieldTypeToDimensionType('boolean')).toBe('boolean');
    expect(fieldTypeToDimensionType('text')).toBe('string');
    expect(fieldTypeToDimensionType(undefined)).toBe('string');
  });
});

describe('normalizeObject', () => {
  it('reads record-shaped fields and extracts relationships', () => {
    const norm = normalizeObject(
      {
        label: 'Opportunity',
        fields: {
          amount: { type: 'currency', label: 'Amount' },
          account: { type: 'lookup', label: 'Account', reference_to: 'account' },
          stage: { type: 'text' },
        },
      },
      'opportunity',
    );
    expect(norm.label).toBe('Opportunity');
    expect(norm.fields.map((f) => f.name)).toEqual(['amount', 'account', 'stage']);
    expect(norm.relationships).toEqual([{ name: 'account', label: 'Account', referenceTo: 'account' }]);
  });

  it('reads array-shaped fields too', () => {
    const norm = normalizeObject(
      { fields: [{ name: 'owner', type: 'master_detail', reference_to: 'user' }] },
      'task',
    );
    expect(norm.relationships).toEqual([{ name: 'owner', label: 'owner', referenceTo: 'user' }]);
  });

  it('is defensive about a missing doc', () => {
    expect(normalizeObject(null, 'x')).toEqual({ label: 'x', fields: [], relationships: [] });
  });
});

describe('buildFieldOptions', () => {
  const base: NormalizedObject = {
    label: 'Opportunity',
    fields: [
      { name: 'amount', label: 'Amount', type: 'currency', def: {} },
      { name: 'account', label: 'Account', type: 'lookup', def: {} },
    ],
    relationships: [{ name: 'account', label: 'Account', referenceTo: 'account' }],
  };
  const accountObj: NormalizedObject = {
    label: 'Account',
    fields: [{ name: 'region', label: 'Region', type: 'text', def: {} }],
    relationships: [],
  };

  it('lists base fields under the base group', () => {
    const opts = buildFieldOptions(base, [], {});
    expect(opts).toEqual([
      { value: 'amount', label: 'Amount', type: 'currency', group: 'Opportunity' },
      { value: 'account', label: 'Account', type: 'lookup', group: 'Opportunity' },
    ]);
  });

  it('appends relationship.field paths for included relationships', () => {
    const opts = buildFieldOptions(base, ['account'], { account: accountObj });
    expect(opts).toContainEqual({ value: 'account.region', label: 'Region', type: 'text', group: 'Account → Account' });
  });

  it('skips included relationships whose target is not loaded', () => {
    const opts = buildFieldOptions(base, ['account'], {});
    expect(opts.some((o) => o.value.startsWith('account.'))).toBe(false);
  });
});

describe('referencesDataset', () => {
  it('matches a top-level dataset binding', () => {
    expect(referencesDataset({ dataset: 'sales' }, 'sales')).toBe(true);
    expect(referencesDataset({ dataset: 'other' }, 'sales')).toBe(false);
  });
  it('matches a nested widget binding', () => {
    const dashboard = { widgets: [{ type: 'kpi' }, { type: 'chart', dataset: 'sales' }] };
    expect(referencesDataset(dashboard, 'sales')).toBe(true);
  });
  it('is false for unrelated docs', () => {
    expect(referencesDataset({ widgets: [{ object: 'sales' }] }, 'sales')).toBe(false);
  });
});

describe('resolvePath + multi-hop buildFieldOptions (ADR-0071)', () => {
  const base: NormalizedObject = {
    label: 'Opportunity',
    fields: [{ name: 'amount', label: 'Amount', type: 'currency', def: {} }],
    relationships: [{ name: 'account', label: 'Account', referenceTo: 'account' }],
  };
  const accountObj: NormalizedObject = {
    label: 'Account',
    fields: [{ name: 'region', label: 'Region', type: 'text', def: {} }],
    relationships: [{ name: 'owner', label: 'Owner', referenceTo: 'user' }],
  };
  const userObj: NormalizedObject = {
    label: 'User',
    fields: [
      { name: 'region', label: 'User Region', type: 'text', def: {} },
      { name: 'email', label: 'Email', type: 'text', def: {} },
    ],
    relationships: [],
  };
  const objectsByName = { account: accountObj, user: userObj };

  it('walks a single hop', () => {
    const r = resolvePath(base, 'account', objectsByName);
    expect(r?.target.label).toBe('Account');
    expect(r?.labels).toEqual(['Account']);
  });

  it('walks a two-hop chain, collecting each hop label', () => {
    const r = resolvePath(base, 'account.owner', objectsByName);
    expect(r?.target.label).toBe('User');
    expect(r?.labels).toEqual(['Account', 'Owner']);
  });

  it('returns undefined when a hop object is not loaded', () => {
    expect(resolvePath(base, 'account.owner', { account: accountObj })).toBeUndefined();
  });

  it('returns undefined for an unknown relationship segment', () => {
    expect(resolvePath(base, 'nope', objectsByName)).toBeUndefined();
  });

  it('emits multi-hop `path.field` options with a chained heading', () => {
    const opts = buildFieldOptions(base, ['account.owner'], objectsByName);
    expect(opts).toContainEqual({ value: 'account.owner.region', label: 'User Region', type: 'text', group: 'Account → Owner → User' });
    expect(opts).toContainEqual({ value: 'account.owner.email', label: 'Email', type: 'text', group: 'Account → Owner → User' });
  });

  it('skips a multi-hop path whose chain is not fully loaded', () => {
    const opts = buildFieldOptions(base, ['account.owner'], { account: accountObj });
    expect(opts.some((o) => o.value.startsWith('account.owner.'))).toBe(false);
  });
});
