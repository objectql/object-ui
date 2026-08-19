/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { SpecBridge } from '../SpecBridge';
import { bridgeListView } from '../bridges/list-view';
import { bridgeFormView } from '../bridges/form-view';
import type { BridgeFn } from '../types';

describe('SpecBridge', () => {
  describe('class orchestration', () => {
    it('registers built-in bridges on construction', () => {
      const bridge = new SpecBridge();
      // Both built-in types should work without error
      expect(() => bridge.transform('list', {})).not.toThrow();
      expect(() => bridge.transform('form', {})).not.toThrow();
    });

    it('throws for unknown spec types', () => {
      const bridge = new SpecBridge();
      expect(() => bridge.transform('unknown', {})).toThrow(
        'No bridge registered for spec type: unknown',
      );
    });

    it('allows custom bridge registration', () => {
      const bridge = new SpecBridge();
      const customBridge: BridgeFn = (spec) => ({
        type: 'custom-widget',
        id: spec.id,
      });
      bridge.register('custom', customBridge);

      const node = bridge.transform('custom', { id: 'my-custom' });
      expect(node.type).toBe('custom-widget');
      expect(node.id).toBe('my-custom');
    });

    it('allows overriding built-in bridges', () => {
      const bridge = new SpecBridge();
      const override: BridgeFn = () => ({ type: 'my-list' });
      bridge.register('list', override);

      const node = bridge.transformListView({});
      expect(node.type).toBe('my-list');
    });

    it('passes context to bridge functions', () => {
      const bridge = new SpecBridge({
        user: { role: 'admin' },
        variables: { theme: 'dark' },
      });
      const spy: BridgeFn = (_spec, ctx) => ({
        type: 'test',
        user: ctx.user,
        variables: ctx.variables,
      });
      bridge.register('test', spy);

      const node = bridge.transform('test', {});
      expect(node.user).toEqual({ role: 'admin' });
      expect(node.variables).toEqual({ theme: 'dark' });
    });

    it('updates context via updateContext', () => {
      const bridge = new SpecBridge({ user: { role: 'viewer' } });
      bridge.updateContext({ user: { role: 'admin' } });

      const spy: BridgeFn = (_spec, ctx) => ({
        type: 'test',
        role: ctx.user?.role,
      });
      bridge.register('ctx-test', spy);

      const node = bridge.transform('ctx-test', {});
      expect(node.role).toBe('admin');
    });
  });

  describe('bridgeListView', () => {
    it('transforms a basic list view spec', () => {
      const spec = {
        name: 'accounts_list',
        label: 'All Accounts',
        type: 'grid',
        columns: [
          { field: 'name', label: 'Account Name', width: 200, sortable: true },
          { field: 'industry', label: 'Industry', width: 150 },
        ],
        data: { provider: 'object', object: 'Account' },
        selection: { mode: 'multiple' },
        pagination: { pageSize: 25 },
      };

      const bridge = new SpecBridge();
      const node = bridge.transformListView(spec);

      expect(node.type).toBe('object-grid');
      expect(node.id).toBe('accounts_list');
      expect(node.label).toBe('All Accounts');
      expect(node.columns).toHaveLength(2);
      // The DECLARED spelling, and only it (objectui#5068). `accessorKey` /
      // `header` is the data-table adapter's vocabulary, which `ObjectGrid`
      // applies on the way OUT; a producer of `object-grid` metadata emits the
      // spec's `ListColumn` — the shape it was handed in the first place.
      expect(node.columns[0].field).toBe('name');
      expect(node.columns[0].label).toBe('Account Name');
      expect(node.columns[0].accessorKey).toBeUndefined();
      expect(node.columns[0].header).toBeUndefined();
      expect(node.columns[0].width).toBe(200);
      expect(node.columns[0].sortable).toBe(true);
      expect(node.columns[1].field).toBe('industry');
      expect(node.data).toEqual({ provider: 'object', object: 'Account' });
      expect(node.selection).toEqual({ mode: 'multiple' });
      expect(node.pagination).toEqual({ pageSize: 25 });
    });

    it('leaves a bare column bare — no label is invented (#5068)', () => {
      // This used to assert `header === 'email'`: the down-translation wrote
      // `header: col.label ?? col.field`, so "the author declared no label"
      // arrived downstream as "the author declared the machine name". That
      // synthesized value pre-empted `ObjectGrid`'s own header chain
      // (`col.label` → the object FIELD's label → the prettified name), which
      // exists precisely for a column authored as a bare `{ field }` — see the
      // localized-label comment at `ObjectGrid.tsx`'s ListColumn arm. The
      // bridge now forwards what the view declared and nothing else; the
      // rendered consequence is pinned in `@object-ui/plugin-grid`'s
      // `specBridgeColumnSpelling.test.tsx`.
      const node = bridgeListView(
        { columns: [{ field: 'email' }] },
        {},
      );
      expect(node.columns[0]).toEqual({ field: 'email' });
    });

    it('maps the spec shorthand string column to a declared field column (#5068)', () => {
      const node = bridgeListView(
        { columns: ['email'] as any },
        {},
      );
      expect(node.columns[0]).toEqual({ field: 'email' });
    });

    it('maps column properties correctly', () => {
      const node = bridgeListView(
        {
          columns: [
            {
              field: 'status',
              label: 'Status',
              align: 'center',
              hidden: false,
              resizable: true,
              wrap: true,
              type: 'badge',
              pinned: 'left',
              summary: { type: 'count' },
              // `ListColumn.link` is a BOOLEAN in @objectstack/spec and
              // `action` is the NAME of an action — not the `{ href }` /
              // `{ type }` envelopes this fixture used to author. The bridge
              // forwards both keys verbatim, so the old assertions passed on
              // any value at all and proved only pass-through (objectui#4040).
              link: true,
              action: 'navigate',
            },
          ],
        },
        {},
      );

      const col = node.columns[0];
      expect(col.align).toBe('center');
      expect(col.hidden).toBe(false);
      expect(col.resizable).toBe(true);
      expect(col.wrap).toBe(true);
      expect(col.type).toBe('badge');
      expect(col.pinned).toBe('left');
      expect(col.summary).toEqual({ type: 'count' });
      expect(col.link).toBe(true);
      expect(col.action).toBe('navigate');
    });

    // All FIVE spellings `RowHeightSchema` admits, and only those. The fixture
    // used to author `comfortable` / `spacious` / `small` as well — three values
    // no spec-valid list view can carry — and it type-checked against nothing,
    // so `mapDensity`'s branches for them read as live capability. What a caller
    // can actually hand this bridge is the enum below (objectui#4040).
    it('maps every spec rowHeight to a density', () => {
      const compact = bridgeListView({ rowHeight: 'compact' }, {});
      expect(compact.density).toBe('compact');

      const short = bridgeListView({ rowHeight: 'short' }, {});
      expect(short.density).toBe('compact');

      const medium = bridgeListView({ rowHeight: 'medium' }, {});
      expect(medium.density).toBe('comfortable');

      const tall = bridgeListView({ rowHeight: 'tall' }, {});
      expect(tall.density).toBe('spacious');

      const extraTall = bridgeListView({ rowHeight: 'extra_tall' }, {});
      expect(extraTall.density).toBe('spacious');
    });

    // The other half of that enum: `comfortable` / `spacious` / `small` /
    // `large` used to be mapped too, so four values `RowHeightSchema` does not
    // admit read as live capability. They are gone (objectui#4352) — AGENTS.md
    // #0.1, one strict contract beats N dialects — and an off-spec `rowHeight`
    // now falls through to no density at all rather than being quietly
    // rehabilitated into one.
    //
    // Routed through `SpecBridge.transformListView`, whose parameter is `any`:
    // that untyped boundary is the one a host's stored JSON actually crosses,
    // and it is the only way left to get these values into the bridge. Writing
    // them on `bridgeListView` directly no longer type-checks, which is the
    // static half of the same fix.
    it.each(['comfortable', 'spacious', 'small', 'large'])(
      'leaves density unset for the off-spec rowHeight %s',
      (rowHeight) => {
        const node = new SpecBridge().transformListView({
          name: 'off_spec_density',
          rowHeight,
        });

        expect(node.density).toBeUndefined();
        // Not merely undefined — the key is never written, so the renderer's
        // own default applies instead of an explicit `density: undefined`.
        expect('density' in node).toBe(false);
      },
    );

    // Control: a string in neither vocabulary already fell through before the
    // four keys were deleted, and still does. Green on both sides of the
    // change — it pins the fall-through itself, not the deletion.
    it('leaves density unset for a rowHeight in no vocabulary at all', () => {
      const node = new SpecBridge().transformListView({
        name: 'off_spec_density',
        rowHeight: 'gargantuan',
      });

      expect(node.density).toBeUndefined();
      expect('density' in node).toBe(false);
    });

    it('includes optional list properties', () => {
      const node = bridgeListView(
        {
          // Spec spellings throughout: `sort` is a list of `{ field, order }`
          // (not a single `{ field, direction }`), `filter` is a list of
          // `{ field, operator, value }` predicates (not a field→value map),
          // and `grouping` wraps its levels in `fields`. The bridge forwards
          // each key verbatim, so the previous fixture's dialect round-tripped
          // and the assertions passed while describing metadata that cannot be
          // authored (objectui#4040).
          sort: [{ field: 'name', order: 'asc' }],
          filter: [{ field: 'status', operator: 'equals', value: 'active' }],
          grouping: { fields: [{ field: 'region' }] },
          rowColor: { field: 'priority' },
          searchableFields: ['name', 'email'],
        },
        {},
      );

      expect(node.sort).toEqual([{ field: 'name', order: 'asc' }]);
      expect(node.filter).toEqual([
        { field: 'status', operator: 'equals', value: 'active' },
      ]);
      expect(node.grouping).toEqual({ fields: [{ field: 'region' }] });
      expect(node.rowColor).toEqual({ field: 'priority' });
      expect(node.searchableFields).toEqual(['name', 'email']);
    });

    it('handles empty spec gracefully', () => {
      const node = bridgeListView({}, {});
      expect(node.type).toBe('object-grid');
      expect(node.columns).toEqual([]);
    });
  });

  describe('bridgeFormView', () => {
    it('transforms a basic form view spec', () => {
      const spec = {
        type: 'create',
        data: { provider: 'object', object: 'Contact' },
        sections: [
          {
            label: 'Basic Info',
            columns: 2,
            fields: [
              { field: 'firstName', label: 'First Name', required: true },
              { field: 'lastName', label: 'Last Name', required: true },
              { field: 'email', label: 'Email', placeholder: 'you@example.com' },
            ],
          },
        ],
      };

      const bridge = new SpecBridge();
      const node = bridge.transformFormView(spec);

      expect(node.type).toBe('object-form');
      expect(node.id).toBe('form-create');
      expect(node.data).toEqual({ provider: 'object', object: 'Contact' });
      expect(node.sections).toHaveLength(1);
      expect(node.sections[0].label).toBe('Basic Info');
      expect(node.sections[0].columns).toBe(2);
      expect(node.sections[0].fields).toHaveLength(3);
      expect(node.sections[0].fields[0].name).toBe('firstName');
      expect(node.sections[0].fields[0].required).toBe(true);
    });

    it('maps field properties correctly', () => {
      const node = bridgeFormView(
        {
          sections: [
            {
              fields: [
                {
                  field: 'notes',
                  label: 'Notes',
                  placeholder: 'Enter notes',
                  helpText: 'Keep it brief',
                  readonly: true,
                  hidden: false,
                  colSpan: 2,
                  widget: 'textarea',
                  dependsOn: ['status'],
                  visibleOn: '${status === "active"}',
                },
              ],
            },
          ],
        },
        {},
      );

      const field = node.sections[0].fields[0];
      expect(field.name).toBe('notes');
      expect(field.label).toBe('Notes');
      expect(field.placeholder).toBe('Enter notes');
      expect(field.helpText).toBe('Keep it brief');
      expect(field.readonly).toBe(true);
      expect(field.hidden).toBe(false);
      expect(field.colSpan).toBe(2);
      expect(field.widget).toBe('textarea');
      expect(field.dependsOn).toEqual(['status']);
      expect(field.visibleOn).toBe('${status === "active"}');
    });

    it('maps section properties correctly', () => {
      const node = bridgeFormView(
        {
          sections: [
            {
              label: 'Advanced',
              collapsible: true,
              collapsed: true,
              columns: 3,
              fields: [],
            },
          ],
        },
        {},
      );

      const section = node.sections[0];
      expect(section.label).toBe('Advanced');
      expect(section.collapsible).toBe(true);
      expect(section.collapsed).toBe(true);
      expect(section.columns).toBe(3);
    });

    it('uses default id when type is not specified', () => {
      const node = bridgeFormView({}, {});
      expect(node.id).toBe('form-default');
    });

    it('uses field name as label fallback', () => {
      const node = bridgeFormView(
        { sections: [{ fields: [{ field: 'age' }] }] },
        {},
      );
      expect(node.sections[0].fields[0].label).toBe('age');
    });

    it('normalizes legacy groups into sections (#2545)', () => {
      // Spec: `groups` is a legacy alias of `sections`. The renderer only
      // consumes `sections`, so the bridge folds groups into it instead of
      // passing a dead `groups` key through.
      const node = bridgeFormView(
        { groups: [{ name: 'g1', label: 'Group 1' }] },
        {},
      );
      expect(node.groups).toBeUndefined();
      expect(node.sections).toEqual([
        { name: 'g1', label: 'Group 1', fields: [] },
      ]);
    });
  });
});
