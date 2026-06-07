// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { mergeViewsIntoObjects } from './MetadataProvider';

/**
 * `mergeViewsIntoObjects` folds the `view` metadata type into object
 * definitions. The backend returns BOTH expanded first-class ViewItems
 * (`{ name: '<obj>.<key>', object, viewKind, config }`, ADR-0017) AND the
 * legacy aggregated container — these tests pin the routing so FORM-family
 * views stay out of the list-view switcher (`objectDef.listViews`).
 */
describe('mergeViewsIntoObjects', () => {
  const objects = [{ name: 'crm_activity', fields: {} }];

  // The crm_activity view set, as the framework expands it (examples/app-crm).
  const listAll = {
    name: 'crm_activity.all',
    object: 'crm_activity',
    viewKind: 'list',
    isDefault: true,
    label: 'All Activities',
    config: { type: 'grid', data: { object: 'crm_activity' }, columns: [{ field: 'subject' }] },
  };
  const listCalendar = {
    name: 'crm_activity.calendar',
    object: 'crm_activity',
    viewKind: 'list',
    label: 'Activity Calendar',
    config: { type: 'calendar', data: { object: 'crm_activity' }, calendar: { startDateField: 'due_date' } },
  };
  const formDefault = {
    name: 'crm_activity.default',
    object: 'crm_activity',
    viewKind: 'form',
    label: 'Activity',
    config: { type: 'simple', sections: [{ label: 'Details', fields: [{ field: 'subject' }] }] },
  };

  it('routes form-family ViewItems into formViews, not listViews', () => {
    const [obj] = mergeViewsIntoObjects(objects, [listAll, listCalendar, formDefault]);
    // List-family views populate the switcher…
    expect(Object.keys(obj.listViews).sort()).toEqual(['crm_activity.all', 'crm_activity.calendar']);
    // …and the form view is NOT among them (the original bug).
    expect(obj.listViews['crm_activity.default']).toBeUndefined();
    // Form view is available separately for the record-form renderer.
    expect(obj.formViews['crm_activity.default']).toBeTruthy();
  });

  it('flattens `config` to the renderer shape and preserves type/label/isDefault', () => {
    const [obj] = mergeViewsIntoObjects(objects, [listAll, listCalendar, formDefault]);
    const calendar = obj.listViews['crm_activity.calendar'];
    expect(calendar.type).toBe('calendar'); // type comes from config, not defaulted to grid
    expect(calendar.calendar.startDateField).toBe('due_date');
    expect(calendar.label).toBe('Activity Calendar');
    // The default list becomes the promoted primary, with a `name` that matches
    // its listViews key so ObjectView's primary-promotion dedups instead of
    // appending a duplicate tab.
    expect(obj.list.name).toBe('crm_activity.all');
    expect(obj.listViews['crm_activity.all'].isDefault).toBe(true);
  });

  it('skips the legacy aggregated container when expanded ViewItems exist', () => {
    const container = {
      name: 'crm_activity',
      list: { type: 'grid', columns: [{ field: 'subject' }] },
      listViews: { all: { type: 'grid' } },
      formViews: { default: { type: 'simple' } },
    };
    const [obj] = mergeViewsIntoObjects(objects, [listAll, listCalendar, formDefault, container]);
    // Only the canonical `<obj>.<key>` ids — the container's short `all`/`list`
    // keys must NOT also appear (no double-listing).
    expect(Object.keys(obj.listViews).sort()).toEqual(['crm_activity.all', 'crm_activity.calendar']);
  });

  it('still consumes the legacy container for objects without ViewItems', () => {
    const container = {
      name: 'crm_activity',
      list: { name: 'list', type: 'grid' },
      listViews: { all: { type: 'grid' } },
      formViews: { default: { type: 'simple' } },
    };
    const [obj] = mergeViewsIntoObjects(objects, [container]);
    expect(Object.keys(obj.listViews).sort()).toEqual(['all', 'list']);
    expect(obj.formViews.default).toBeTruthy();
    expect(obj.formViews.list).toBeUndefined();
  });
});

import { attachInlineSubforms } from './MetadataProvider';

describe('attachInlineSubforms — relationship-level inlineEdit', () => {
  const objects = [
    { name: 'invoice', fields: { number: { type: 'text' } } },
    {
      name: 'invoice_line',
      fields: {
        amount: { type: 'number' },
        invoice: { type: 'master_detail', reference: 'invoice', inlineEdit: true, inlineTitle: 'Lines' },
      },
    },
    {
      name: 'comment',
      // master_detail but NOT inlineEdit → must NOT be inlined
      fields: { body: { type: 'text' }, invoice: { type: 'master_detail', reference: 'invoice' } },
    },
  ];

  it('merges inlineEdit children into the parent form as subforms', () => {
    const out = attachInlineSubforms(objects);
    const invoice = out.find((o) => o.name === 'invoice')!;
    expect(invoice.form?.subforms).toHaveLength(1);
    expect(invoice.form?.subforms?.[0]).toMatchObject({
      childObject: 'invoice_line',
      relationshipField: 'invoice',
      title: 'Lines',
    });
    // The resolved inline-edit mode is attached too.
    expect(['grid', 'form']).toContain(invoice.form?.subforms?.[0]?.inlineMode);
  });

  it('does not inline master_detail children without inlineEdit', () => {
    const out = attachInlineSubforms(objects);
    const invoice = out.find((o) => o.name === 'invoice')!;
    const children = (invoice.form?.subforms ?? []).map((s: any) => s.childObject);
    expect(children).not.toContain('comment');
  });

  it('lets an explicit form.subforms entry override the derived one', () => {
    const withExplicit = objects.map((o) =>
      o.name === 'invoice'
        ? { ...o, form: { type: 'simple', subforms: [{ childObject: 'invoice_line', columns: [{ field: 'amount' }] }] } }
        : o,
    );
    const out = attachInlineSubforms(withExplicit);
    const invoice = out.find((o) => o.name === 'invoice')!;
    // single entry for invoice_line, and it's the explicit one (has columns)
    const lineSubforms = invoice.form.subforms.filter((s: any) => s.childObject === 'invoice_line');
    expect(lineSubforms).toHaveLength(1);
    expect(lineSubforms[0].columns).toBeTruthy();
  });

  it('returns objects unchanged when no inlineEdit relationships exist', () => {
    const plain = [{ name: 'a', fields: { x: { type: 'text' } } }];
    expect(attachInlineSubforms(plain)).toBe(plain);
  });
});
