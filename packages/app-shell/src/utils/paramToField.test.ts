/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * paramToField — the param → field adapter behind ActionParamDialog's shared
 * field-widget rendering (ADR-0059), plus the drift guard pinning param
 * support ⊇ form support. The dialog used to hand-roll a per-type ternary
 * chain, so every form type without its own branch (`file`, `image`,
 * `richtext`, `color`, …) silently collapsed to a text box; routing through
 * `FORM_FIELD_TYPES` + this drift test makes that class of bug impossible to
 * reintroduce silently.
 */
import { describe, it, expect, vi } from 'vitest';
import { FORM_FIELD_TYPES } from '@object-ui/fields';
import type { ActionParamDef } from '@object-ui/core';
import { paramToField, resolveParamWidgetType } from './paramToField';

const p = (over: Partial<ActionParamDef>): ActionParamDef => ({
  name: 'x',
  label: 'X',
  type: 'text',
  ...over,
});

describe('param widget support ⊇ form widget support (drift guard)', () => {
  it('every form field type resolves to its own widget — never the text fallback', () => {
    // If this fails: a type was added to `fieldWidgetMap` that the param
    // dialog would degrade to another widget. The adapter resolves widget-map
    // keys by identity, so this can only regress if that resolution changes —
    // do not special-case types out without an alias entry here.
    const degraded = FORM_FIELD_TYPES.filter((t) => resolveParamWidgetType(t) !== t);
    expect(degraded).toEqual([]);
  });

  it('legacy param-only spellings fold onto canonical widgets', () => {
    expect(resolveParamWidgetType('checkbox')).toBe('boolean');
    expect(resolveParamWidgetType('reference')).toBe('lookup');
    expect(resolveParamWidgetType('datetime-local')).toBe('datetime');
    expect(resolveParamWidgetType('autonumber')).toBe('auto_number');
  });

  it('spec FieldType aliases resolve through the form mapping, unknown types fall back to text', () => {
    expect(resolveParamWidgetType('toggle')).toBe('boolean');
    expect(resolveParamWidgetType('json')).toBe('code');
    expect(resolveParamWidgetType('secret')).toBe('password');
    expect(resolveParamWidgetType('tree')).toBe('lookup');
    expect(resolveParamWidgetType('no-such-type')).toBe('text');
  });
});

describe('paramToField', () => {
  it('maps the widget-relevant config for a plain param', () => {
    const field = paramToField(p({
      name: 'reason',
      label: 'Reason',
      type: 'textarea',
      required: true,
      placeholder: 'Why?',
    }));
    expect(field).toMatchObject({
      name: 'reason',
      label: 'Reason',
      type: 'textarea',
      required: true,
      placeholder: 'Why?',
    });
  });

  it('carries options for select params', () => {
    const options = [{ label: 'A', value: 'a' }];
    expect(paramToField(p({ type: 'select', options }))).toMatchObject({ type: 'select', options });
  });

  it('carries upload config (multiple/accept/maxSize) for file params', () => {
    const field = paramToField(p({
      type: 'file',
      multiple: true,
      accept: ['application/pdf'],
      maxSize: 5 * 1024 * 1024,
    }));
    expect(field).toMatchObject({
      type: 'file',
      multiple: true,
      accept: ['application/pdf'],
      maxSize: 5 * 1024 * 1024,
    });
  });

  it('renders boolean params as a checkbox (dialog inline-row UX), not the form switch', () => {
    expect(paramToField(p({ type: 'boolean' }))).toMatchObject({ type: 'boolean', widget: 'checkbox' });
    expect(paramToField(p({ type: 'checkbox' }))).toMatchObject({ type: 'boolean', widget: 'checkbox' });
  });

  it('maps the full lookup picker config to snake_case field metadata', () => {
    const field = paramToField(p({
      type: 'lookup',
      referenceTo: 'space_users',
      displayField: 'name',
      idField: 'id',
      descriptionField: 'email',
      multiple: true,
      titleFormat: '{first_name} {last_name}',
      lookupColumns: [{ field: 'name' }],
      lookupFilters: [{ field: 'active', operator: '=', value: true }],
      lookupPageSize: 25,
      dependsOn: ['org'],
    }));
    expect(field).toMatchObject({
      type: 'lookup',
      reference_to: 'space_users',
      display_field: 'name',
      id_field: 'id',
      description_field: 'email',
      multiple: true,
      title_format: '{first_name} {last_name}',
      lookup_columns: [{ field: 'name' }],
      lookup_filters: [{ field: 'active', operator: '=', value: true }],
      lookup_page_size: 25,
      depends_on: ['org'],
    });
  });

  it('lookup param without a referenceTo target falls back to a text input (param-only fallback)', () => {
    expect(paramToField(p({ type: 'lookup' }))).toMatchObject({ type: 'text' });
    expect(paramToField(p({ type: 'reference' }))).toMatchObject({ type: 'text' });
  });

  // #3405 — the fallback is now a broken-metadata signal, not a normal path,
  // so it must be audible in dev instead of silently handing the user a box
  // that wants a raw UUID.
  it('warns in dev when a picker param degrades for want of a target', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      paramToField(p({ name: 'inspector', type: 'lookup' }));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('inspector');
      expect(warn.mock.calls[0][0]).toContain('reference');

      warn.mockClear();
      paramToField(p({ name: 'inspector', type: 'lookup', referenceTo: 'sys_user' }));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('user params keep their picker without needing referenceTo (implicit sys_user)', () => {
    expect(paramToField(p({ type: 'user' }))).toMatchObject({ type: 'user' });
  });
});
