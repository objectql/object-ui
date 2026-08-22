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
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FORM_FIELD_TYPES } from '@object-ui/fields';
import { EXPANDABLE_FIELD_TYPES, type ActionParamDef } from '@object-ui/core';
import { paramToField, resolveParamWidgetType } from './paramToField';

const p = (over: Partial<ActionParamDef>): ActionParamDef => ({
  name: 'x',
  label: 'X',
  type: 'text',
  ...over,
});

afterEach(() => {
  // The identity pins below install a spy on the Set object EXPORTED by core —
  // a shared, module-level object. A leaked spy would follow every later file
  // in the worker, so restoring is not optional here.
  vi.restoreAllMocks();
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
/**
 * The reference-bearing rule is core's object, not a copy (objectui#5312).
 *
 * This module held the FOURTH and last hand-maintained answer to one question —
 * "does this widget resolve a foreign key, so hand it the reference target?" —
 * as the inline disjunction `LOOKUP_WIDGET_TYPES.has(type) || type === 'user'`.
 * The other three converged on `@object-ui/core`'s `EXPANDABLE_FIELD_TYPES` in
 * objectui#4770 / #4790 / #4815.
 *
 * Every membership assertion in this file is satisfied by a private
 * `new Set(['lookup', 'master_detail', 'user', 'tree'])` holding the same
 * strings — i.e. by the exact state this change removed. So the load-bearing
 * pin below is on OBJECT IDENTITY (a spy on core's `has`), not on members.
 */
describe("the reference-bearing rule is core's object, not a copy (objectui#5312)", () => {
  it('asks `@object-ui/core` EXPANDABLE_FIELD_TYPES which params carry a reference target', () => {
    // The spy is installed on the Set exported by core and records a call only
    // if THIS module consulted THAT object. A member-identical private copy
    // leaves it empty, so this fails where a value check would pass.
    const spy = vi.spyOn(EXPANDABLE_FIELD_TYPES, 'has');
    try {
      expect(paramToField(p({ type: 'user' }))).toMatchObject({ type: 'user' });
      expect(spy.mock.calls.map(([k]) => k)).toContain('user');
    } finally {
      spy.mockRestore();
    }
  });

  it('reaches that object on the lookup path too, not just the person path', () => {
    // `user` and `lookup` enter the branch by different routes (the degrade
    // rule above runs first and only for `lookup` / `master_detail`), so a
    // convergence that reconnected one route would leave the other forked.
    const spy = vi.spyOn(EXPANDABLE_FIELD_TYPES, 'has');
    try {
      paramToField(p({ type: 'lookup', referenceTo: 'accounts' }));
      expect(spy.mock.calls.map(([k]) => k)).toContain('lookup');
    } finally {
      spy.mockRestore();
    }
  });

  // Behaviour equivalence with the literal this replaced, stated as the literal
  // itself rather than as prose: the retired inline rule matched exactly these
  // three widget keys.
  const RETIRED_INLINE_MEMBERS = ['lookup', 'master_detail', 'user'];

  it('still hands the reference config to every member of the literal it replaced', () => {
    for (const type of RETIRED_INLINE_MEMBERS) {
      expect(
        paramToField(p({ type, referenceTo: 'accounts', displayField: 'name' })),
        `'${type}' lost its reference config in the convergence`,
      ).toMatchObject({ type, reference_to: 'accounts', display_field: 'name' });
    }
    expect(RETIRED_INLINE_MEMBERS.filter((t) => !EXPANDABLE_FIELD_TYPES.has(t))).toEqual([]);
  });

  it('adds exactly one member, and that member is unreachable on this surface', () => {
    // Why converging cost no behaviour change: the shared set is one member
    // wider, and that member can never BE a widget key here — `tree` is absent
    // from `fields`' widget map and `mapFieldTypeToFormType` sends it to
    // `field:lookup`, so every key tested by the rule (always
    // `resolveParamWidgetType` output) arrives as `lookup`. If someone
    // registers a real `tree` widget this flips and `tree` starts matching the
    // rule here — a behaviour change that would otherwise arrive silently.
    const added = [...EXPANDABLE_FIELD_TYPES].filter((t) => !RETIRED_INLINE_MEMBERS.includes(t));
    expect(added).toEqual(['tree']);
    expect(resolveParamWidgetType('tree')).toBe('lookup');
  });

  it('holds every core member under the normalization this surface applies', () => {
    // The shared set is defined over SCHEMA types; this surface tests WIDGET
    // keys (`resolveParamWidgetType` output). Reading one with the other is
    // only safe while the family is closed under that resolution — every member
    // resolves to a member. A future core member resolving to `text` here would
    // be a schema-declared reference field silently rendered as a plain input
    // with no target, so it fails loudly instead.
    for (const type of EXPANDABLE_FIELD_TYPES) {
      const widgetKey = resolveParamWidgetType(type);
      expect(
        EXPANDABLE_FIELD_TYPES.has(widgetKey),
        `core member '${type}' resolves to '${widgetKey}', which is outside the family`,
      ).toBe(true);
    }
  });

  it('keeps the target-required rule SEPARATE from the reference-bearing rule', () => {
    // The two rules are different sets over overlapping types and must not be
    // folded together: `user` is reference-bearing but defaults its target to
    // `sys_user`, so it must never degrade for want of `referenceTo`; `lookup`
    // and `master_detail` must. Merging them would either strip the person
    // picker or stop degrading targetless record pickers.
    expect(paramToField(p({ type: 'user' }))).toMatchObject({ type: 'user' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(paramToField(p({ type: 'master_detail' }))).toMatchObject({ type: 'text' });
    } finally {
      warn.mockRestore();
    }
  });
});
