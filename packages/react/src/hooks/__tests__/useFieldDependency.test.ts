/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  evaluateFieldVisibility,
  evaluateFieldDependencies,
  useFieldDependency,
  type FieldDependencyConfig,
} from '../useFieldDependency';

describe('evaluateFieldVisibility', () => {
  it('returns false when hidden is true', () => {
    expect(evaluateFieldVisibility({ name: 'f', hidden: true }, {})).toBe(false);
  });

  it('returns true when no visibleOn expression', () => {
    expect(evaluateFieldVisibility({ name: 'f' }, {})).toBe(true);
  });

  it('evaluates visibleOn expression with data context', () => {
    const config: FieldDependencyConfig = {
      name: 'state',
      visibleOn: "${data.country === 'US'}",
    };
    expect(evaluateFieldVisibility(config, { country: 'US' })).toBe(true);
    expect(evaluateFieldVisibility(config, { country: 'CA' })).toBe(false);
  });

  it('returns true on evaluation error (safe default)', () => {
    const config: FieldDependencyConfig = {
      name: 'f',
      visibleOn: '${data.invalid.deep.access}',
    };
    expect(evaluateFieldVisibility(config, {})).toBe(true);
  });

  it('supports form context alias', () => {
    const config: FieldDependencyConfig = {
      name: 'zipCode',
      visibleOn: "${form.showZip === true}",
    };
    expect(evaluateFieldVisibility(config, { showZip: true })).toBe(true);
    expect(evaluateFieldVisibility(config, { showZip: false })).toBe(false);
  });
});

describe('evaluateFieldDependencies', () => {
  it('evaluates multiple fields', () => {
    const fields: FieldDependencyConfig[] = [
      { name: 'country' },
      { name: 'state', visibleOn: "${data.country === 'US'}" },
      { name: 'province', visibleOn: "${data.country === 'CA'}" },
      { name: 'secret', hidden: true },
    ];

    const result = evaluateFieldDependencies(fields, { country: 'US' });
    expect(result).toEqual({
      country: true,
      state: true,
      province: false,
      secret: false,
    });
  });
});

describe('useFieldDependency', () => {
  const baseFields: FieldDependencyConfig[] = [
    { name: 'country' },
    { name: 'state', dependsOn: 'country', visibleOn: "${data.country !== ''}" },
    { name: 'city', dependsOn: 'state', visibleOn: "${data.state !== ''}" },
  ];

  it('returns visibility map based on form data', () => {
    const { result } = renderHook(() =>
      useFieldDependency({
        fields: baseFields,
        formData: { country: 'US', state: 'CA', city: '' },
      })
    );

    expect(result.current.getFieldVisibility('country')).toBe(true);
    expect(result.current.getFieldVisibility('state')).toBe(true);
    expect(result.current.getFieldVisibility('city')).toBe(true);
  });

  it('hides dependent fields when parent is empty', () => {
    const { result } = renderHook(() =>
      useFieldDependency({
        fields: baseFields,
        formData: { country: '', state: '', city: '' },
      })
    );

    expect(result.current.getFieldVisibility('country')).toBe(true);
    expect(result.current.getFieldVisibility('state')).toBe(false);
    expect(result.current.getFieldVisibility('city')).toBe(false);
  });

  it('getDependentFields returns children of a parent', () => {
    const { result } = renderHook(() =>
      useFieldDependency({
        fields: baseFields,
        formData: { country: 'US', state: '', city: '' },
      })
    );

    expect(result.current.getDependentFields('country')).toEqual(['state']);
    expect(result.current.getDependentFields('state')).toEqual(['city']);
    expect(result.current.getDependentFields('city')).toEqual([]);
  });

  it('getParentValue returns the parent field value', () => {
    const { result } = renderHook(() =>
      useFieldDependency({
        fields: baseFields,
        formData: { country: 'US', state: 'CA', city: '' },
      })
    );

    expect(result.current.getParentValue('state')).toBe('US');
    expect(result.current.getParentValue('city')).toBe('CA');
    expect(result.current.getParentValue('country')).toBeUndefined();
  });

  it('returns true for unknown field names', () => {
    const { result } = renderHook(() =>
      useFieldDependency({
        fields: baseFields,
        formData: {},
      })
    );

    expect(result.current.getFieldVisibility('nonexistent')).toBe(true);
  });

  it('updates visibility when formData changes', () => {
    const { result, rerender } = renderHook(
      ({ formData }) =>
        useFieldDependency({
          fields: baseFields,
          formData,
        }),
      { initialProps: { formData: { country: '', state: '', city: '' } } }
    );

    expect(result.current.getFieldVisibility('state')).toBe(false);

    rerender({ formData: { country: 'US', state: '', city: '' } });
    expect(result.current.getFieldVisibility('state')).toBe(true);
  });
});
