/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * bulkParamToField — the pure BulkActionParam → field-widget-metadata adapter
 * behind the ADR-0059 bulk-dialog migration (#3064). Pins the type mapping
 * (aliases, lookup degradation, sys_user promotion), the #2204 multiple
 * threading, and the option-value stringification the confirm step relies on.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  bulkParamToField,
  fieldNeedsDataSource,
  isLookupishParam,
  lookupTargetObject,
  resolveBulkParamWidgetType,
} from '../components/bulkParamToField';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveBulkParamWidgetType', () => {
  it('passes canonical widget types through and folds param-only aliases', () => {
    expect(resolveBulkParamWidgetType('lookup')).toBe('lookup');
    expect(resolveBulkParamWidgetType('date')).toBe('date');
    expect(resolveBulkParamWidgetType('checkbox')).toBe('boolean');
    expect(resolveBulkParamWidgetType('reference')).toBe('lookup');
    expect(resolveBulkParamWidgetType('datetime-local')).toBe('datetime');
  });

  it('falls back to text for unknown types (same as the form renderer)', () => {
    expect(resolveBulkParamWidgetType('no-such-type')).toBe('text');
  });
});

describe('bulkParamToField', () => {
  it('maps a lookup param to the record-picker field shape', () => {
    const field = bulkParamToField(
      { name: 'queue', label: 'Queue', type: 'lookup', object: 'queues', labelField: 'title', required: true },
      false,
    );
    expect(field).toMatchObject({
      name: 'queue',
      label: 'Queue',
      type: 'lookup',
      required: true,
      reference_to: 'queues',
      display_field: 'title',
      multiple: false,
    });
  });

  it('promotes a sys_user-targeting lookup to the user widget (form PeoplePicker parity)', () => {
    const field = bulkParamToField(
      { name: 'manager', type: 'lookup', object: 'sys_user' },
      false,
    );
    expect(field.type).toBe('user');
    expect(field.reference_to).toBe('sys_user');
  });

  it('degrades a targetless lookup to a text input with a dev warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const field = bulkParamToField({ name: 'ref', type: 'lookup' }, false);
    expect(field.type).toBe('text');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('threads the EFFECTIVE multiple flag (#2204), ignoring the raw param flag', () => {
    // Schema-derived multi wins over the omitted param flag…
    expect(bulkParamToField({ name: 'tags', type: 'select', options: [] }, true).multiple).toBe(true);
    // …and the argument is authoritative in the other direction too.
    expect(bulkParamToField({ name: 'tags', type: 'select', multiple: true, options: [] }, false).multiple).toBe(false);
  });

  it('stringifies option values so widget output matches confirm-step lookups', () => {
    const field = bulkParamToField(
      { name: 'level', type: 'select', options: [{ label: 'One', value: 1 }, { label: 'Yes', value: true }] },
      false,
    );
    expect(field.options).toEqual([
      { label: 'One', value: '1' },
      { label: 'Yes', value: 'true' },
    ]);
  });

  it('forwards catch-all widget config and strips dialog-owned keys', () => {
    const field = bulkParamToField(
      { name: 'amount', type: 'number', min: 0, step: 5, help: 'shown by the dialog', default: 10 },
      false,
    );
    expect(field.min).toBe(0);
    expect(field.step).toBe(5);
    expect(field).not.toHaveProperty('help');
    expect(field).not.toHaveProperty('default');
  });
});

describe('lookup helpers', () => {
  it('identifies picker params and their target object', () => {
    expect(isLookupishParam({ name: 'q', type: 'lookup', object: 'queues' })).toBe(true);
    expect(isLookupishParam({ name: 'u', type: 'user' })).toBe(true);
    expect(isLookupishParam({ name: 't', type: 'text' })).toBe(false);

    expect(lookupTargetObject({ name: 'q', type: 'lookup', object: 'queues' })).toBe('queues');
    // Person params default to sys_user like the form's UserField.
    expect(lookupTargetObject({ name: 'u', type: 'user' })).toBe('sys_user');
    expect(lookupTargetObject({ name: 'x', type: 'lookup' })).toBeUndefined();
  });

  it('only picker field shapes get the DataSource threaded', () => {
    expect(fieldNeedsDataSource({ type: 'user' })).toBe(true);
    expect(fieldNeedsDataSource({ type: 'lookup' })).toBe(true);
    expect(fieldNeedsDataSource({ type: 'date' })).toBe(false);
  });
});
