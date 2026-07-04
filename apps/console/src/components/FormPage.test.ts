// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Pure-function tests for FormPage helpers. These cover the bulk of
 * the renderer's spec-merging logic — buildSections, readPrefill,
 * normalizeColumns, normalizeOptions — without needing a DOM.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSections,
  normalizeColumns,
  normalizeOptions,
  readPrefill,
  resolveInternalForm,
} from './FormPage';

describe('normalizeColumns', () => {
  it('passes through valid numeric literals', () => {
    expect(normalizeColumns(1)).toBe(1);
    expect(normalizeColumns(2)).toBe(2);
    expect(normalizeColumns(3)).toBe(3);
    expect(normalizeColumns(4)).toBe(4);
  });

  it('parses numeric strings', () => {
    expect(normalizeColumns('1')).toBe(1);
    expect(normalizeColumns('4')).toBe(4);
  });

  it('defaults to 2 for invalid or missing values', () => {
    expect(normalizeColumns(undefined)).toBe(2);
    expect(normalizeColumns(0)).toBe(2);
    expect(normalizeColumns(5)).toBe(2);
    expect(normalizeColumns('foo')).toBe(2);
  });
});

describe('normalizeOptions', () => {
  it('returns undefined for non-arrays', () => {
    expect(normalizeOptions(undefined)).toBeUndefined();
    expect(normalizeOptions(null)).toBeUndefined();
    expect(normalizeOptions('a,b,c')).toBeUndefined();
  });

  it('maps string options to {value,label}', () => {
    expect(normalizeOptions(['new', 'qualified'])).toEqual([
      { value: 'new', label: 'new' },
      { value: 'qualified', label: 'qualified' },
    ]);
  });

  it('honors {value,label} object shape', () => {
    expect(normalizeOptions([{ value: 'n', label: 'New' }])).toEqual([
      { value: 'n', label: 'New' },
    ]);
  });

  it('falls back to {id,name} when value/label are absent', () => {
    expect(normalizeOptions([{ id: 'x', name: 'X-Ray' }])).toEqual([
      { value: 'x', label: 'X-Ray' },
    ]);
  });
});

describe('buildSections', () => {
  const objectSchema = {
    name: 'lead',
    label: 'Lead',
    fields: {
      first_name: { type: 'text', label: 'First name', required: true },
      email: { type: 'email', label: 'Email', maxLength: 200 },
      status: { type: 'select', label: 'Status', options: ['new', 'qualified'] },
    },
  };

  it('merges section fields with object schema definitions', () => {
    const sections = buildSections(
      {
        type: 'simple',
        sections: [
          {
            label: 'About you',
            columns: 2,
            fields: ['first_name', 'email'],
          },
        ],
      },
      objectSchema,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('About you');
    expect(sections[0].columns).toBe(2);
    expect(sections[0].fields).toEqual([
      expect.objectContaining({ name: 'first_name', label: 'First name', type: 'text', required: true }),
      expect.objectContaining({ name: 'email', label: 'Email', type: 'email', maxLength: 200 }),
    ]);
  });

  it('lets FormField overrides win over object defaults', () => {
    const [section] = buildSections(
      {
        type: 'simple',
        sections: [
          {
            fields: [
              { field: 'first_name', label: 'Given name', required: false, placeholder: 'Ada' },
            ],
          },
        ],
      },
      objectSchema,
    );
    expect(section.fields[0].label).toBe('Given name');
    expect(section.fields[0].required).toBe(false);
    expect(section.fields[0].placeholder).toBe('Ada');
  });

  it('normalizes object schema options through onto the renderable field', () => {
    const [section] = buildSections(
      {
        type: 'simple',
        sections: [{ fields: ['status'] }],
      },
      objectSchema,
    );
    expect(section.fields[0].options).toEqual([
      { value: 'new', label: 'new' },
      { value: 'qualified', label: 'qualified' },
    ]);
  });

  it('falls back to text type when the field is unknown', () => {
    const [section] = buildSections(
      {
        type: 'simple',
        sections: [{ fields: ['mystery'] }],
      },
      objectSchema,
    );
    expect(section.fields[0]).toMatchObject({ name: 'mystery', type: 'text' });
  });

  it('accepts legacy `groups` key as an alias for `sections`', () => {
    const sections = buildSections(
      {
        type: 'simple',
        groups: [{ fields: ['first_name'] }],
      } as any,
      objectSchema,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].fields[0].name).toBe('first_name');
  });
});

describe('readPrefill', () => {
  const fields = [
    { name: 'first_name', label: 'First name', type: 'text', required: false, readonly: false, hidden: false, colSpan: 1 as const },
    { name: 'company', label: 'Company', type: 'text', required: false, readonly: false, hidden: false, colSpan: 1 as const, defaultValue: 'Acme' },
    { name: 'phone', label: 'Phone', type: 'text', required: false, readonly: false, hidden: false, colSpan: 1 as const },
  ];

  it('applies defaultValue from the field definition', () => {
    const out = readPrefill(fields, new URLSearchParams());
    expect(out).toEqual({ company: 'Acme' });
  });

  it('overrides defaults with `prefill_<name>` query params', () => {
    const out = readPrefill(fields, new URLSearchParams('prefill_company=Initech&prefill_first_name=Ada'));
    expect(out).toEqual({ company: 'Initech', first_name: 'Ada' });
  });

  it('ignores prefill params for fields not in the form', () => {
    const out = readPrefill(fields, new URLSearchParams('prefill_unknown=zzz'));
    expect(out).toEqual({ company: 'Acme' });
  });

  it('treats empty-string values as a real prefill', () => {
    const out = readPrefill(fields, new URLSearchParams('prefill_company='));
    expect(out.company).toBe('');
  });
});

/**
 * objectui#2208 — the server's `/meta/view/:name` returns the flattened
 * ExpandedViewItem envelope `{ name, object, viewKind, label, config }`;
 * the form spec lives under `config`. Pre-fix the loader read sections off
 * the envelope itself → every internal form rendered zero fields + a bare
 * Submit that "succeeded". List views reaching the forms route (the
 * framework#2554 collision fallout) rendered the same false positive
 * instead of an actionable error.
 */
describe('resolveInternalForm', () => {
  const envelope = {
    name: 'showcase_task.tabbed',
    object: 'showcase_task',
    viewKind: 'form',
    label: 'Tabbed',
    scope: 'package',
    config: {
      type: 'tabbed',
      data: { provider: 'object', object: 'showcase_task' },
      sections: [{ name: 'overview', label: 'Overview', fields: ['title', 'status'] }],
    },
  };

  it('unwraps the ExpandedViewItem envelope: form spec comes from config', () => {
    const out = resolveInternalForm('showcase_task.tabbed', envelope);
    expect(out.form.type).toBe('tabbed');
    expect(out.form.sections).toHaveLength(1);
    expect(out.label).toBe('Tabbed');
    expect(out.object).toBe('showcase_task');
  });

  it('accepts the { item: envelope } wrapper', () => {
    const out = resolveInternalForm('showcase_task.tabbed', { item: envelope });
    expect(out.form.sections).toHaveLength(1);
    expect(out.object).toBe('showcase_task');
  });

  it('falls back to the envelope name when neither envelope nor config carry a label', () => {
    const { label: _l, ...noLabel } = envelope;
    const out = resolveInternalForm('showcase_task.tabbed', noLabel);
    expect(out.label).toBe('showcase_task.tabbed');
  });

  it('throws an actionable error for a non-form view instead of rendering an empty form', () => {
    const listView = {
      name: 'showcase_task.default',
      object: 'showcase_task',
      viewKind: 'list',
      label: 'All Tasks',
      config: { type: 'grid', data: { provider: 'object', object: 'showcase_task' }, columns: ['title'] },
    };
    expect(() => resolveInternalForm('showcase_task.default', listView)).toThrow(/list view, not a form view/);
  });

  it('throws for a flattened runtime-overlay list row that lost its viewKind (framework#2555 fallout)', () => {
    // A personalization PUT persisted the raw config at the top level; the
    // pre-heal server returns it with name/object/label but NO viewKind and
    // NO config envelope. It must not pass for a legacy bare form spec.
    const pollutedOverlay = {
      name: 'showcase_task.default',
      object: 'showcase_task',
      label: 'All Tasks',
      type: 'grid',
      data: { provider: 'object', object: 'showcase_task' },
      columns: [{ field: 'title' }],
      sort: [{ id: '29200fa8-c416-471e-9ca3-913f9308ad89', field: 'estimate_hours', order: 'desc' }],
    };
    expect(() => resolveInternalForm('showcase_task.default', pollutedOverlay)).toThrow(/grid view, not a form view/);
  });

  it('throws for a flattened list body whose viewKind sits at the top level (healed overlay row)', () => {
    const healedOverlay = {
      name: 'showcase_task.default',
      object: 'showcase_task',
      viewKind: 'list',
      label: 'All Tasks',
      type: 'grid',
      data: { provider: 'object', object: 'showcase_task' },
      columns: [{ field: 'title' }],
    };
    expect(() => resolveInternalForm('showcase_task.default', healedOverlay)).toThrow(/list view, not a form view/);
  });

  it('still accepts a bare legacy form spec (no envelope)', () => {
    const bare = {
      type: 'simple',
      label: 'Quick Edit',
      data: { provider: 'object', object: 'task' },
      sections: [{ label: 'Main', fields: ['title'] }],
    };
    const out = resolveInternalForm('task.quick', bare);
    expect(out.form).toBe(bare as any);
    expect(out.label).toBe('Quick Edit');
    // object resolved from the spec's data binding
    expect(out.object).toBe('task');
  });

  it('accepts the legacy { item: { spec } } wrapper', () => {
    const out = resolveInternalForm('task.quick', {
      item: { spec: { type: 'simple', object: 'task', sections: [] } },
    });
    expect(out.object).toBe('task');
    expect(out.form.type).toBe('simple');
  });
});
