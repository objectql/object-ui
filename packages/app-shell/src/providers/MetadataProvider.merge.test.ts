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
    // Only the two list ViewItems. Both gates key by the same canonical
    // `<obj>.<key>` identity now (objectui#3770), so the container can no longer
    // double-list them under short keys — but it still MUST be skipped: its own
    // `list` is structurally distinct from `listViews.all`, so expanding it would
    // add a third `crm_activity.default` list tab (and force the container's
    // `formViews.default` into a `_2` rename), and the ViewItem rows are the
    // authoritative ones the runtime heals personalization onto.
    expect(Object.keys(obj.listViews).sort()).toEqual(['crm_activity.all', 'crm_activity.calendar']);
  });

  /**
   * Container gate (objectui#3770). A stack-packaged container is served
   * UNEXPANDED, so this merge asks `expandViewContainer` for each view's runtime
   * identity instead of deriving one. The previous derivation was
   * `list.name || 'list'` — a spelling no producer emits, which is why the
   * default list's translation key never resolved (the composer, the framework
   * loader and the i18n extractor all say `<object>.default`).
   */
  describe('aggregated container — identities come from the view composer', () => {
    it('keys an unnamed default list by the composer identity `<object>.default`', () => {
      const container = {
        name: 'crm_activity',
        // No `name` — the default `list` implicitly claims `<object>.default`.
        list: { label: 'All Activities', type: 'grid', columns: [{ field: 'subject' }] },
        listViews: { calendar: { type: 'calendar' } },
      };
      const [obj] = mergeViewsIntoObjects(objects, [container]);
      expect(Object.keys(obj.listViews).sort()).toEqual([
        'crm_activity.calendar',
        'crm_activity.default',
      ]);
      // The retired dialect must be gone, not merely joined by the new key.
      expect(obj.listViews.list).toBeUndefined();
      // `name` is stamped so ObjectView's `view.name || view.id` — the argument
      // `viewLabel` translates by — carries the composer identity.
      expect(obj.list.name).toBe('crm_activity.default');
      expect(obj.listViews['crm_activity.default'].isDefault).toBe(true);
      expect(obj.listViews['crm_activity.default'].columns).toEqual([{ field: 'subject' }]);
    });

    it('honors an author-supplied `list.name` as the key', () => {
      const container = {
        name: 'crm_activity',
        list: { name: 'my_list', type: 'grid', columns: [{ field: 'subject' }] },
      };
      const [obj] = mergeViewsIntoObjects(objects, [container]);
      expect(Object.keys(obj.listViews)).toEqual(['crm_activity.my_list']);
      expect(obj.list.name).toBe('crm_activity.my_list');
    });

    it('folds a `listViews` entry that merely restates `list` into ONE view', () => {
      // The composer dedups by structural signature: `listViews.all` restating
      // the default `list` collapses into `crm_activity.all`, which is then the
      // default. Deriving the id locally could not know that — it would emit a
      // second tab for the same view.
      const restated = { type: 'grid', label: 'All', columns: [{ field: 'subject' }] };
      const container = {
        name: 'crm_activity',
        list: restated,
        listViews: { all: { ...restated } },
      };
      const [obj] = mergeViewsIntoObjects(objects, [container]);
      expect(Object.keys(obj.listViews)).toEqual(['crm_activity.all']);
      expect(obj.list.name).toBe('crm_activity.all');
      expect(obj.listViews['crm_activity.all'].isDefault).toBe(true);
    });

    it('routes the container form family into formViews only', () => {
      const container = {
        name: 'crm_activity',
        list: { type: 'grid', columns: [{ field: 'subject' }] },
        formViews: { compact: { type: 'simple' } },
      };
      const [obj] = mergeViewsIntoObjects(objects, [container]);
      expect(obj.formViews['crm_activity.compact']).toBeTruthy();
      expect(obj.listViews['crm_activity.compact']).toBeUndefined();
      // …and the list family is untouched by the form entry.
      expect(Object.keys(obj.listViews)).toEqual(['crm_activity.default']);
    });
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

  it('resolves the parent from a reference_to-keyed field (ObjectUI convention)', () => {
    // Served schemas use `reference`; ObjectUI-authored / normalized defs use
    // `reference_to` — the parent resolution must accept either key.
    const out = attachInlineSubforms([
      { name: 'order', fields: { number: { type: 'text' } } },
      {
        name: 'order_line',
        fields: {
          qty: { type: 'number' },
          order: { type: 'master_detail', reference_to: 'order', inlineEdit: true },
        },
      },
    ]);
    const order = out.find((o) => o.name === 'order')!;
    expect(order.form?.subforms?.[0]).toMatchObject({
      childObject: 'order_line',
      relationshipField: 'order',
    });
  });
});
