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
import { bridgePage } from '../bridges/page';
import { bridgeDashboard } from '../bridges/dashboard';
import type { BridgeFn } from '../types';

describe('SpecBridge', () => {
  describe('class orchestration', () => {
    it('registers built-in bridges on construction', () => {
      const bridge = new SpecBridge();
      // All four built-in types should work without error
      expect(() => bridge.transform('list', {})).not.toThrow();
      expect(() => bridge.transform('form', {})).not.toThrow();
      expect(() => bridge.transform('page', {})).not.toThrow();
      expect(() => bridge.transform('dashboard', {})).not.toThrow();
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
      expect(node.columns[0].accessorKey).toBe('name');
      expect(node.columns[0].header).toBe('Account Name');
      expect(node.columns[0].width).toBe(200);
      expect(node.columns[0].sortable).toBe(true);
      expect(node.columns[1].accessorKey).toBe('industry');
      expect(node.data).toEqual({ provider: 'object', object: 'Account' });
      expect(node.selection).toEqual({ mode: 'multiple' });
      expect(node.pagination).toEqual({ pageSize: 25 });
    });

    it('uses field name as header fallback', () => {
      const node = bridgeListView(
        { columns: [{ field: 'email' }] },
        {},
      );
      expect(node.columns[0].header).toBe('email');
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
              link: { href: '/status' },
              action: { type: 'navigate' },
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
      expect(col.link).toEqual({ href: '/status' });
      expect(col.action).toEqual({ type: 'navigate' });
    });

    it('maps rowHeight to density', () => {
      const compact = bridgeListView({ rowHeight: 'compact' }, {});
      expect(compact.density).toBe('compact');

      const comfortable = bridgeListView({ rowHeight: 'comfortable' }, {});
      expect(comfortable.density).toBe('comfortable');

      const spacious = bridgeListView({ rowHeight: 'spacious' }, {});
      expect(spacious.density).toBe('spacious');

      const small = bridgeListView({ rowHeight: 'small' }, {});
      expect(small.density).toBe('compact');
    });

    it('includes optional list properties', () => {
      const node = bridgeListView(
        {
          sort: { field: 'name', direction: 'asc' },
          filter: { status: 'active' },
          grouping: { field: 'region' },
          rowColor: { field: 'priority' },
          searchableFields: ['name', 'email'],
          quickFilters: [{ field: 'status', values: ['active'] }],
        },
        {},
      );

      expect(node.sort).toEqual({ field: 'name', direction: 'asc' });
      expect(node.filter).toEqual({ status: 'active' });
      expect(node.grouping).toEqual({ field: 'region' });
      expect(node.rowColor).toEqual({ field: 'priority' });
      expect(node.searchableFields).toEqual(['name', 'email']);
      expect(node.quickFilters).toHaveLength(1);
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

    it('passes groups through', () => {
      const node = bridgeFormView(
        { groups: [{ name: 'g1', label: 'Group 1' }] },
        {},
      );
      expect(node.groups).toEqual([{ name: 'g1', label: 'Group 1' }]);
    });
  });

  describe('bridgePage', () => {
    it('transforms a basic page spec', () => {
      const spec = {
        name: 'account_detail',
        label: 'Account Detail',
        type: 'detail',
        variables: { accountId: '123' },
        regions: [
          {
            name: 'main',
            components: [
              {
                type: 'ui.heading',
                id: 'title',
                label: 'Account Details',
                properties: { level: 2 },
              },
              {
                type: 'ui.card',
                id: 'info-card',
                className: 'mt-4',
              },
            ],
          },
        ],
      };

      const bridge = new SpecBridge();
      const node = bridge.transformPage(spec);

      expect(node.type).toBe('page');
      expect(node.id).toBe('account_detail');
      expect(node.label).toBe('Account Detail');
      expect(node.pageType).toBe('detail');
      expect(node.variables).toEqual({ accountId: '123' });
      expect(Array.isArray(node.body)).toBe(true);

      const regions = node.body as any[];
      expect(regions).toHaveLength(1);
      expect(regions[0].type).toBe('page-region');
      expect(regions[0].id).toBe('main');

      const components = regions[0].body as any[];
      expect(components).toHaveLength(2);
      expect(components[0].type).toBe('ui.heading');
      expect(components[0].level).toBe(2);
      expect(components[1].className).toBe('mt-4');
    });

    it('maps component properties and events', () => {
      const node = bridgePage(
        {
          regions: [
            {
              components: [
                {
                  type: 'ui.button',
                  id: 'save-btn',
                  label: 'Save',
                  events: { onClick: 'save' },
                  visibility: '${canEdit}',
                  dataSource: { provider: 'api', read: '/api/data' },
                  responsive: { sm: 'hidden' },
                  aria: { label: 'Save record' },
                },
              ],
            },
          ],
        },
        {},
      );

      const regions = node.body as any[];
      const comp = regions[0].body[0];
      expect(comp.type).toBe('ui.button');
      expect(comp.label).toBe('Save');
      expect(comp.events).toEqual({ onClick: 'save' });
      expect(comp.visibility).toBe('${canEdit}');
      expect(comp.dataSource).toEqual({ provider: 'api', read: '/api/data' });
      expect(comp.responsive).toEqual({ sm: 'hidden' });
      expect(comp.aria).toEqual({ label: 'Save record' });
    });

    it('includes template and object when present', () => {
      const node = bridgePage(
        { template: 'two-column', object: 'Account' },
        {},
      );
      expect(node.template).toBe('two-column');
      expect(node.object).toBe('Account');
    });

    it('handles empty regions gracefully', () => {
      const node = bridgePage({}, {});
      expect(node.type).toBe('page');
      expect(node.body).toEqual([]);
    });
  });

  describe('bridgeDashboard', () => {
    it('transforms a basic dashboard spec', () => {
      const spec = {
        name: 'sales_dashboard',
        label: 'Sales Dashboard',
        widgets: [
          {
            title: 'Revenue',
            type: 'bar-chart',
            object: 'Opportunity',
            categoryField: 'stage',
            valueField: 'amount',
            aggregate: 'sum',
          },
          {
            title: 'Pipeline',
            type: 'metric',
            object: 'Opportunity',
            valueField: 'count',
          },
        ],
        header: { title: 'Sales Overview' },
        globalFilters: [
          { field: 'region', type: 'select' },
        ],
      };

      const bridge = new SpecBridge();
      const node = bridge.transformDashboard(spec);

      expect(node.type).toBe('dashboard');
      expect(node.id).toBe('sales_dashboard');
      expect(node.label).toBe('Sales Dashboard');

      const body = node.body as any[];
      // header + filter-bar + widget-grid
      expect(body).toHaveLength(3);
      expect(body[0].type).toBe('dashboard-header');
      expect(body[0].title).toBe('Sales Overview');
      expect(body[1].type).toBe('filter-bar');
      expect(body[1].filters).toHaveLength(1);

      const widgetGrid = body[2];
      expect(widgetGrid.type).toBe('widget-grid');
      const widgets = widgetGrid.body as any[];
      expect(widgets).toHaveLength(2);
      expect(widgets[0].type).toBe('bar-chart');
      expect(widgets[0].title).toBe('Revenue');
      expect(widgets[0].categoryField).toBe('stage');
      expect(widgets[0].valueField).toBe('amount');
      expect(widgets[0].aggregate).toBe('sum');
      expect(widgets[1].type).toBe('metric');
    });

    it('maps widget properties correctly', () => {
      const node = bridgeDashboard(
        {
          widgets: [
            {
              title: 'Chart',
              description: 'A chart',
              type: 'line-chart',
              chartConfig: { smooth: true },
              colorVariant: 'blue',
              object: 'Deal',
              filter: { status: 'won' },
              categoryField: 'month',
              valueField: 'revenue',
              aggregate: 'avg',
              measures: [{ field: 'revenue', agg: 'sum' }],
              layout: { x: 0, y: 0, w: 6, h: 4 },
            },
          ],
        },
        {},
      );

      const widgetGrid = (node.body as any[])[0];
      const widget = widgetGrid.body[0];
      expect(widget.title).toBe('Chart');
      expect(widget.description).toBe('A chart');
      expect(widget.chartConfig).toEqual({ smooth: true });
      expect(widget.colorVariant).toBe('blue');
      expect(widget.object).toBe('Deal');
      expect(widget.filter).toEqual({ status: 'won' });
      expect(widget.measures).toHaveLength(1);
      expect(widget.layout).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    });

    it('omits header and filters when not present', () => {
      const node = bridgeDashboard({ widgets: [] }, {});
      const body = node.body as any[];
      // Only widget-grid
      expect(body).toHaveLength(1);
      expect(body[0].type).toBe('widget-grid');
    });

    it('assigns sequential widget ids', () => {
      const node = bridgeDashboard(
        {
          widgets: [
            { title: 'A', type: 'metric' },
            { title: 'B', type: 'metric' },
            { title: 'C', type: 'metric' },
          ],
        },
        {},
      );

      const widgetGrid = (node.body as any[])[0];
      const widgets = widgetGrid.body as any[];
      expect(widgets[0].id).toBe('widget-0');
      expect(widgets[1].id).toBe('widget-1');
      expect(widgets[2].id).toBe('widget-2');
    });

    it('defaults widget type to chart', () => {
      const node = bridgeDashboard(
        { widgets: [{ title: 'Untitled' }] },
        {},
      );
      const widgetGrid = (node.body as any[])[0];
      expect(widgetGrid.body[0].type).toBe('chart');
    });
  });
});
