/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * resolveActionParams — regression coverage for `visible`-predicate propagation.
 *
 * The create-user phone bug (framework #2871 + objectui #2406) hid the
 * `phoneNumber` param via `visible: 'features.phoneNumber == true'`, but the
 * resolver dropped `visible` on the way to `ActionParamDialog`, so the field
 * kept rendering. These tests lock in that the predicate survives resolution —
 * in both the raw-string and the spec-normalised `{ dialect, source }` envelope
 * forms, and across inline / field-backed / missing-field branches.
 */
import { describe, it, expect } from 'vitest';
import { resolveActionParams, type ResolveActionParamsContext, type RawActionParam } from './resolveActionParams';

const ctx = (over: Partial<ResolveActionParamsContext> = {}): ResolveActionParamsContext => ({
  objectName: 'sys_user',
  objects: [
    { name: 'sys_user', fields: { phone_number: { type: 'text', label: 'Phone' } } },
  ],
  fieldLabel: (_o, _f, fallback) => fallback,
  ...over,
});

describe('resolveActionParams — visible propagation', () => {
  it('propagates a raw-string visible on an inline param', () => {
    const params: RawActionParam[] = [{ name: 'phoneNumber', visible: 'features.phoneNumber == true' }];
    expect(resolveActionParams(params, ctx())[0].visible).toBe('features.phoneNumber == true');
  });

  it('unwraps the { dialect, source } envelope the spec serialises to', () => {
    const params: RawActionParam[] = [
      { name: 'phoneNumber', visible: { dialect: 'cel', source: 'features.phoneNumber == true' } },
    ];
    expect(resolveActionParams(params, ctx())[0].visible).toBe('features.phoneNumber == true');
  });

  it('propagates visible on a field-backed param', () => {
    const params: RawActionParam[] = [{ field: 'phone_number', visible: 'features.phoneNumber == true' }];
    expect(resolveActionParams(params, ctx())[0].visible).toBe('features.phoneNumber == true');
  });

  it('propagates visible on the missing-field fallback branch', () => {
    const params: RawActionParam[] = [{ field: 'does_not_exist', visible: 'features.phoneNumber == true' }];
    // No such field on the object → text-input fallback, but visible still survives.
    expect(resolveActionParams(params, ctx())[0].visible).toBe('features.phoneNumber == true');
  });

  it('leaves visible undefined when the param has no predicate', () => {
    const params: RawActionParam[] = [{ name: 'email' }];
    expect(resolveActionParams(params, ctx())[0].visible).toBeUndefined();
  });

  it('treats an empty predicate as absent (always visible)', () => {
    const params: RawActionParam[] = [
      { name: 'a', visible: '' },
      { name: 'b', visible: { dialect: 'cel', source: '' } },
    ];
    const out = resolveActionParams(params, ctx());
    expect(out[0].visible).toBeUndefined();
    expect(out[1].visible).toBeUndefined();
  });
});

describe('resolveActionParams — widget config (ADR-0059)', () => {
  const fileCtx = () =>
    ctx({
      objects: [
        {
          name: 'sys_user',
          fields: {
            avatar_file: {
              type: 'file',
              label: 'Avatar',
              multiple: true,
              accept: ['image/*'],
              maxSize: 1024,
            },
            phone_number: { type: 'text', label: 'Phone' },
          },
        },
      ],
    });

  it('carries multiple/accept/maxSize on an inline param', () => {
    const params: RawActionParam[] = [
      { name: 'attachments', type: 'file', multiple: true, accept: ['application/pdf'], maxSize: 2048 },
    ];
    expect(resolveActionParams(params, ctx())[0]).toMatchObject({
      type: 'file',
      multiple: true,
      accept: ['application/pdf'],
      maxSize: 2048,
    });
  });

  it('inherits multiple/accept/maxSize from the referenced field (any type, not just lookup)', () => {
    const params: RawActionParam[] = [{ field: 'avatar_file' }];
    expect(resolveActionParams(params, fileCtx())[0]).toMatchObject({
      type: 'file',
      multiple: true,
      accept: ['image/*'],
      maxSize: 1024,
    });
  });

  it('inline overrides win over the field metadata', () => {
    const params: RawActionParam[] = [{ field: 'avatar_file', multiple: false, maxSize: 4096 }];
    expect(resolveActionParams(params, fileCtx())[0]).toMatchObject({
      multiple: false,
      accept: ['image/*'],
      maxSize: 4096,
    });
  });

  it('carries multiple/accept/maxSize on the missing-field fallback branch', () => {
    const params: RawActionParam[] = [
      { field: 'does_not_exist', type: 'file', multiple: true, accept: ['.csv'], maxSize: 99 },
    ];
    expect(resolveActionParams(params, ctx())[0]).toMatchObject({
      multiple: true,
      accept: ['.csv'],
      maxSize: 99,
    });
  });
});

/**
 * #3405 — an inline `lookup` param carries its own picker target.
 *
 * Real-world break (PLAT-DEF-005): a QC dispatch action declared
 * `{ name: 'inspector', type: 'lookup', reference: 'sys_user' }`. The key was
 * unknown to both the spec schema and this resolver, so it was dropped twice
 * over and `paramToField()` degraded the param to a "paste the record id
 * (UUID)" text box — a supervisor had to go find a user's UUID by hand.
 */
describe('resolveActionParams — inline lookup reference target (#3405)', () => {
  const lookupCtx = () =>
    ctx({
      objects: [
        {
          name: 'quality_dispatch',
          fields: {
            inspector: { type: 'lookup', label: '质检人', reference: 'sys_user' },
            reviewer: { type: 'lookup', label: 'Reviewer', reference_to: 'sys_user', display_field: 'name' },
          },
        },
      ],
      objectName: 'quality_dispatch',
    });

  it('maps an inline `reference` onto referenceTo so the picker can query', () => {
    const params: RawActionParam[] = [
      { name: 'inspector', label: '质检员', type: 'lookup', reference: 'sys_user', required: true },
    ];
    expect(resolveActionParams(params, lookupCtx())[0]).toMatchObject({
      name: 'inspector',
      type: 'lookup',
      referenceTo: 'sys_user',
    });
  });

  it('still inherits the target from the referenced field when field-backed', () => {
    expect(resolveActionParams([{ field: 'inspector' }], lookupCtx())[0]).toMatchObject({
      type: 'lookup',
      referenceTo: 'sys_user',
    });
    expect(resolveActionParams([{ field: 'reviewer' }], lookupCtx())[0]).toMatchObject({
      referenceTo: 'sys_user',
      displayField: 'name',
    });
  });

  it('lets an inline reference override the field metadata', () => {
    const params: RawActionParam[] = [{ field: 'inspector', reference: 'sys_member' }];
    expect(resolveActionParams(params, lookupCtx())[0].referenceTo).toBe('sys_member');
  });

  it('keeps the inline reference on the missing-field fallback branch', () => {
    const params: RawActionParam[] = [
      { field: 'does_not_exist', type: 'lookup', reference: 'sys_user' },
    ];
    expect(resolveActionParams(params, lookupCtx())[0].referenceTo).toBe('sys_user');
  });

  it('leaves referenceTo undefined for a non-picker inline param', () => {
    expect(resolveActionParams([{ name: 'note', type: 'textarea' }], lookupCtx())[0].referenceTo).toBeUndefined();
  });
});
