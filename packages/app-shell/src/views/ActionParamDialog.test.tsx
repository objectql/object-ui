/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * filterVisibleParams — action params gated by a `visible` CEL predicate
 * (evaluated against the features/user/app/data scope). Fixes the create-user
 * form offering a `phoneNumber` field the default backend rejects: the param is
 * `visible: 'features.phoneNumber == true'`, so it's hidden unless the opt-in
 * phoneNumber auth plugin is loaded.
 */
import { describe, it, expect } from 'vitest';
import type { ActionParamDef } from '@object-ui/core';
import { filterVisibleParams } from './ActionParamDialog';

const p = (name: string, visible?: string): ActionParamDef => ({
  name,
  label: name,
  type: 'text',
  ...(visible ? { visible } : {}),
});

describe('filterVisibleParams', () => {
  it('keeps params that have no visible predicate', () => {
    const params = [p('email'), p('name')];
    expect(filterVisibleParams(params, {}).map((x) => x.name)).toEqual(['email', 'name']);
  });

  it('hides the phoneNumber param when features.phoneNumber is false', () => {
    const params = [p('email'), p('phoneNumber', 'features.phoneNumber == true'), p('name')];
    const out = filterVisibleParams(params, { features: { phoneNumber: false } });
    expect(out.map((x) => x.name)).toEqual(['email', 'name']);
  });

  it('shows the phoneNumber param when features.phoneNumber is true', () => {
    const params = [p('email'), p('phoneNumber', 'features.phoneNumber == true'), p('name')];
    const out = filterVisibleParams(params, { features: { phoneNumber: true } });
    expect(out.map((x) => x.name)).toEqual(['email', 'phoneNumber', 'name']);
  });

  it('hides a feature-gated param when the flag is absent (conservative)', () => {
    const params = [p('phoneNumber', 'features.phoneNumber == true')];
    expect(filterVisibleParams(params, { features: {} })).toEqual([]);
  });

  it('defaults to visible when the predicate is malformed (fail-open)', () => {
    const params = [p('x', 'this is ((( not valid')];
    expect(filterVisibleParams(params, {}).map((x) => x.name)).toEqual(['x']);
  });

  it('handles the normalized {dialect, source} form the spec serializes to', () => {
    // The framework's ExpressionInputSchema normalizes the authored string to
    // `{ dialect: 'cel', source: '...' }`, so the served param carries the object
    // form — the evaluator unwraps `.source`, so gating still works.
    const params: ActionParamDef[] = [
      { name: 'phoneNumber', label: 'Phone', type: 'text', visible: { dialect: 'cel', source: 'features.phoneNumber == true' } as any },
    ];
    expect(filterVisibleParams(params, { features: { phoneNumber: false } })).toEqual([]);
    expect(filterVisibleParams(params, { features: { phoneNumber: true } }).map((x) => x.name)).toEqual(['phoneNumber']);
  });
});
