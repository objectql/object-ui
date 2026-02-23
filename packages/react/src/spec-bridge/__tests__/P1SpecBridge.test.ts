/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P1 SpecBridge Protocol Alignment Tests
 * Tests for the enhanced bridge transformations: ListView, FormView, Dashboard, Page
 */
import { describe, it, expect } from 'vitest';
import { SpecBridge } from '../SpecBridge';

describe('P1 SpecBridge Protocol Alignment', () => {
  // ========================================================================
  // P1.1 ListView Bridge Enhancements
  // ========================================================================
  describe('P1.1 ListView bridge enhancements', () => {
    it('should pass through rowActions and bulkActions', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'accounts',
        columns: [{ field: 'name', label: 'Name' }],
        rowActions: ['edit', 'delete', 'clone'],
        bulkActions: ['delete', 'assign'],
      });

      expect(node.rowActions).toEqual(['edit', 'delete', 'clone']);
      expect(node.bulkActions).toEqual(['delete', 'assign']);
    });

    it('should pass through virtualScroll', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'large_dataset',
        virtualScroll: true,
      });

      expect(node.virtualScroll).toBe(true);
    });

    it('should pass through conditionalFormatting', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'styled',
        conditionalFormatting: [
          { condition: '${data.amount > 10000}', style: { backgroundColor: '#fee2e2' } },
        ],
      });

      expect(node.conditionalFormatting).toHaveLength(1);
      expect(node.conditionalFormatting[0].condition).toBe('${data.amount > 10000}');
    });

    it('should pass through inlineEdit', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'editable',
        inlineEdit: true,
      });

      expect(node.inlineEdit).toBe(true);
    });

    it('should pass through exportOptions', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'exportable',
        exportOptions: {
          formats: ['csv', 'xlsx'],
          maxRecords: 10000,
        },
      });

      expect(node.exportOptions).toBeDefined();
      expect(node.exportOptions.formats).toEqual(['csv', 'xlsx']);
    });

    it('should pass through emptyState', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'empty',
        emptyState: { title: 'No Data', message: 'Add records to get started', icon: 'Database' },
      });

      expect(node.emptyState).toBeDefined();
      expect(node.emptyState.title).toBe('No Data');
    });

    it('should pass through showRecordCount and allowPrinting', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'full_featured',
        showRecordCount: true,
        allowPrinting: true,
      });

      expect(node.showRecordCount).toBe(true);
      expect(node.allowPrinting).toBe(true);
    });

    it('should pass through userActions', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'actions_test',
        userActions: { sort: true, search: true, filter: false },
      });

      expect(node.userActions).toBeDefined();
      expect(node.userActions.sort).toBe(true);
      expect(node.userActions.filter).toBe(false);
    });

    it('should pass through aria properties', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'accessible',
        aria: { ariaLabel: 'Accounts List', role: 'grid' },
      });

      expect(node.aria).toBeDefined();
      expect(node.aria.ariaLabel).toBe('Accounts List');
    });

    it('should pass through hiddenFields and fieldOrder', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'ordered',
        hiddenFields: ['internal_id', 'sys_created_at'],
        fieldOrder: ['name', 'email', 'status'],
      });

      expect(node.hiddenFields).toEqual(['internal_id', 'sys_created_at']);
      expect(node.fieldOrder).toEqual(['name', 'email', 'status']);
    });

    it('should map short rowHeight to compact density', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'density_test',
        rowHeight: 'short',
      });

      expect(node.density).toBe('compact');
    });

    it('should map extra_tall rowHeight to spacious density', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'density_test',
        rowHeight: 'extra_tall',
      });

      expect(node.density).toBe('spacious');
    });

    it('should map tall rowHeight to spacious density', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'density_test',
        rowHeight: 'tall',
      });

      expect(node.density).toBe('spacious');
    });

    it('should pass through filterableFields', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'filterable',
        filterableFields: ['status', 'priority', 'assignee'],
      });

      expect(node.filterableFields).toEqual(['status', 'priority', 'assignee']);
    });

    it('should pass through resizable, striped, bordered', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'styled',
        resizable: true,
        striped: true,
        bordered: true,
      });

      expect(node.resizable).toBe(true);
      expect(node.striped).toBe(true);
      expect(node.bordered).toBe(true);
    });

    it('should pass through view-type configs (kanban, calendar, gantt, gallery, timeline)', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'multi_view',
        kanban: { groupField: 'status' },
        calendar: { startDateField: 'date' },
        gantt: { startDateField: 'start', endDateField: 'end' },
        gallery: { coverField: 'photo', cardSize: 'medium' },
        timeline: { startDateField: 'created', titleField: 'name' },
      });

      expect(node.kanban).toEqual({ groupField: 'status' });
      expect(node.calendar).toEqual({ startDateField: 'date' });
      expect(node.gantt).toEqual({ startDateField: 'start', endDateField: 'end' });
      expect(node.gallery).toEqual({ coverField: 'photo', cardSize: 'medium' });
      expect(node.timeline).toEqual({ startDateField: 'created', titleField: 'name' });
    });

    it('should pass through navigation config', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'navigable',
        navigation: { mode: 'drawer', width: '400px' },
      });

      expect(node.navigation).toEqual({ mode: 'drawer', width: '400px' });
    });
  });

  // ========================================================================
  // P1.2 FormView Bridge Enhancements
  // ========================================================================
  describe('P1.2 FormView bridge enhancements', () => {
    it('should map formType from spec type', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({
        type: 'tabbed',
        sections: [
          { label: 'Tab 1', fields: [{ field: 'name' }] },
          { label: 'Tab 2', fields: [{ field: 'email' }] },
        ],
      });

      expect(node.formType).toBe('tabbed');
    });

    it('should map wizard formType', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({
        type: 'wizard',
        sections: [
          { label: 'Step 1', fields: [{ field: 'name' }] },
          { label: 'Step 2', fields: [{ field: 'email' }] },
        ],
      });

      expect(node.formType).toBe('wizard');
    });

    it('should map modal formType', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({ type: 'modal' });
      expect(node.formType).toBe('modal');
    });

    it('should map split formType', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({ type: 'split' });
      expect(node.formType).toBe('split');
    });

    it('should map drawer formType', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({ type: 'drawer' });
      expect(node.formType).toBe('drawer');
    });

    it('should not set formType for unknown types', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({ type: 'unknown_type' });
      expect(node.formType).toBeUndefined();
    });

    it('should map FormSection with columns', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({
        sections: [
          {
            label: 'Contact Info',
            columns: 2,
            collapsible: true,
            collapsed: false,
            fields: [
              { field: 'name', label: 'Full Name', required: true },
              { field: 'email', label: 'Email', placeholder: 'user@example.com' },
            ],
          },
        ],
      });

      const sections = node.sections as any[];
      expect(sections).toHaveLength(1);
      expect(sections[0].label).toBe('Contact Info');
      expect(sections[0].columns).toBe(2);
      expect(sections[0].collapsible).toBe(true);
      expect(sections[0].fields).toHaveLength(2);
    });

    it('should map FormField properties: widget, dependsOn, visibleOn, colSpan', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({
        sections: [
          {
            fields: [
              {
                field: 'sub_industry',
                label: 'Sub-Industry',
                widget: 'industry-picker',
                dependsOn: ['industry'],
                visibleOn: '${data.industry != null}',
                colSpan: 2,
              },
            ],
          },
        ],
      });

      const field = (node.sections as any[])[0].fields[0];
      expect(field.widget).toBe('industry-picker');
      expect(field.dependsOn).toEqual(['industry']);
      expect(field.visibleOn).toBe('${data.industry != null}');
      expect(field.colSpan).toBe(2);
    });

    it('should pass through aria properties', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformFormView({
        type: 'simple',
        aria: { ariaLabel: 'Create Account Form' },
      });

      expect(node.aria).toBeDefined();
      expect(node.aria.ariaLabel).toBe('Create Account Form');
    });
  });

  // ========================================================================
  // P1.3 Dashboard Bridge Enhancements
  // ========================================================================
  describe('P1.3 Dashboard bridge enhancements', () => {
    it('should map widget data binding properties', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'sales',
        widgets: [
          {
            title: 'Revenue',
            type: 'bar-chart',
            object: 'Opportunity',
            filter: [['stage', '=', 'Closed Won']],
            categoryField: 'region',
            valueField: 'amount',
            aggregate: 'sum',
          },
        ],
      });

      const widgetGrid = (node.body as any[]).find((b: any) => b.type === 'widget-grid');
      const widgets = widgetGrid.body as any[];
      expect(widgets[0].object).toBe('Opportunity');
      expect(widgets[0].categoryField).toBe('region');
      expect(widgets[0].valueField).toBe('amount');
      expect(widgets[0].aggregate).toBe('sum');
    });

    it('should map widget color variants', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'colored',
        widgets: [
          { title: 'Success', type: 'metric', colorVariant: 'success' },
          { title: 'Danger', type: 'metric', colorVariant: 'danger' },
        ],
      });

      const widgetGrid = (node.body as any[]).find((b: any) => b.type === 'widget-grid');
      const widgets = widgetGrid.body as any[];
      expect(widgets[0].colorVariant).toBe('success');
      expect(widgets[1].colorVariant).toBe('danger');
    });

    it('should map widget measures (pivot/matrix)', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'pivot',
        widgets: [
          {
            title: 'Matrix',
            type: 'pivot',
            measures: [
              { valueField: 'amount', aggregate: 'sum', label: 'Total', format: '$0,0' },
            ],
          },
        ],
      });

      const widgetGrid = (node.body as any[]).find((b: any) => b.type === 'widget-grid');
      const widgets = widgetGrid.body as any[];
      expect(widgets[0].measures).toHaveLength(1);
      expect(widgets[0].measures[0].label).toBe('Total');
    });

    it('should map globalFilters with optionsFrom', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'filtered',
        widgets: [],
        globalFilters: [
          {
            field: 'region',
            label: 'Region',
            type: 'select',
            optionsFrom: {
              object: 'Region',
              valueField: 'id',
              labelField: 'name',
            },
            targetWidgets: ['widget-0'],
          },
        ],
      });

      const filterBar = (node.body as any[]).find((b: any) => b.type === 'filter-bar');
      expect(filterBar).toBeDefined();
      expect(filterBar.filters[0].field).toBe('region');
      expect(filterBar.filters[0].optionsFrom.object).toBe('Region');
      expect(filterBar.filters[0].targetWidgets).toEqual(['widget-0']);
    });

    it('should map dateRange filter', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'dated',
        widgets: [],
        dateRange: {
          field: 'created_at',
          defaultRange: 'last_30_days',
          allowCustomRange: true,
        },
      });

      const dateFilter = (node.body as any[]).find((b: any) => b.type === 'date-range-filter');
      expect(dateFilter).toBeDefined();
      expect(dateFilter.field).toBe('created_at');
      expect(dateFilter.defaultRange).toBe('last_30_days');
      expect(dateFilter.allowCustomRange).toBe(true);
    });

    it('should map DashboardHeader with actions', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'with_header',
        widgets: [],
        header: {
          showTitle: true,
          actions: [
            { label: 'Refresh', actionType: 'refresh', icon: 'RefreshCw' },
          ],
        },
      });

      const header = (node.body as any[]).find((b: any) => b.type === 'dashboard-header');
      expect(header).toBeDefined();
      expect(header.showTitle).toBe(true);
      expect(header.actions).toHaveLength(1);
    });

    it('should pass through dashboard description and refreshInterval', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'auto_refresh',
        label: 'Live Dashboard',
        description: 'Real-time sales data',
        refreshInterval: 30,
        widgets: [],
      });

      expect(node.description).toBe('Real-time sales data');
      expect(node.refreshInterval).toBe(30);
    });

    it('should pass through dashboard aria', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'accessible',
        widgets: [],
        aria: { ariaLabel: 'Sales Dashboard', role: 'region' },
      });

      expect(node.aria).toBeDefined();
      expect(node.aria.ariaLabel).toBe('Sales Dashboard');
    });

    it('should map widget action properties', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformDashboard({
        name: 'clickable',
        widgets: [
          {
            title: 'Open Deals',
            type: 'metric',
            actionUrl: '/opportunities?status=open',
            actionType: 'navigate',
            actionIcon: 'ArrowRight',
          },
        ],
      });

      const widgetGrid = (node.body as any[]).find((b: any) => b.type === 'widget-grid');
      const widgets = widgetGrid.body as any[];
      expect(widgets[0].actionUrl).toBe('/opportunities?status=open');
      expect(widgets[0].actionType).toBe('navigate');
      expect(widgets[0].actionIcon).toBe('ArrowRight');
    });
  });

  // ========================================================================
  // P1.4 Page Bridge Enhancements
  // ========================================================================
  describe('P1.4 Page bridge enhancements', () => {
    it('should map expanded page types', () => {
      const bridge = new SpecBridge();
      const pageTypes = [
        'record', 'home', 'app', 'utility',
        'dashboard', 'grid', 'list', 'gallery',
        'kanban', 'calendar', 'timeline', 'form',
        'record_detail', 'record_review', 'overview', 'blank',
      ];

      pageTypes.forEach((pageType) => {
        const node = bridge.transformPage({
          name: `${pageType}_page`,
          type: pageType,
        });
        expect(node.pageType).toBe(pageType);
      });
    });

    it('should map blank page layout', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformPage({
        name: 'blank_page',
        type: 'blank',
        blankLayout: {
          columns: 12,
          rowHeight: 60,
          gap: 8,
          items: [
            { componentId: 'header', x: 0, y: 0, width: 12, height: 2 },
            { componentId: 'chart', x: 0, y: 2, width: 6, height: 4 },
          ],
        },
      });

      expect(node.blankLayout).toBeDefined();
      expect(node.blankLayout.columns).toBe(12);
      expect(node.blankLayout.items).toHaveLength(2);
    });

    it('should map page variables with source', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformPage({
        name: 'record_page',
        type: 'record',
        variables: [
          { name: 'recordId', type: 'record_id', source: 'url_param' },
          { name: 'tab', type: 'string', defaultValue: 'details' },
        ],
      });

      expect(node.variables).toHaveLength(2);
      expect(node.variables[0].name).toBe('recordId');
      expect(node.variables[0].type).toBe('record_id');
      expect(node.variables[0].source).toBe('url_param');
    });

    it('should map event handlers on page components', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformPage({
        name: 'interactive',
        regions: [
          {
            name: 'main',
            components: [
              {
                type: 'element:button',
                id: 'save-btn',
                label: 'Save',
                events: {
                  onClick: '${actions.save()}',
                  onHover: '${actions.highlight()}',
                },
              },
            ],
          },
        ],
      });

      const region = (node.body as any[])[0];
      const component = region.body[0];
      expect(component.events).toBeDefined();
      expect(component.events.onClick).toBe('${actions.save()}');
    });

    it('should map responsive config on page components', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformPage({
        name: 'responsive',
        regions: [
          {
            name: 'main',
            components: [
              {
                type: 'element:text',
                id: 'heading',
                responsive: {
                  sm: { hidden: true },
                  md: { hidden: false },
                },
              },
            ],
          },
        ],
      });

      const region = (node.body as any[])[0];
      const component = region.body[0];
      expect(component.responsive).toBeDefined();
      expect(component.responsive.sm.hidden).toBe(true);
    });

    it('should pass through page description and icon', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformPage({
        name: 'detailed',
        label: 'Home',
        description: 'Main landing page',
        icon: 'Home',
      });

      expect(node.description).toBe('Main landing page');
      expect(node.icon).toBe('Home');
    });

    it('should pass through page aria', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformPage({
        name: 'accessible',
        aria: { ariaLabel: 'Home Page', role: 'main' },
      });

      expect(node.aria).toBeDefined();
      expect(node.aria.ariaLabel).toBe('Home Page');
    });

    it('should map region width', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformPage({
        name: 'sidebar_page',
        regions: [
          { name: 'sidebar', width: 'small', components: [] },
          { name: 'main', width: 'large', components: [] },
        ],
      });

      const regions = node.body as any[];
      expect(regions[0].width).toBe('small');
      expect(regions[1].width).toBe('large');
    });
  });
});
