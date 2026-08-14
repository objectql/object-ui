/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P1 SpecBridge Protocol Alignment Tests
 * Tests for the enhanced bridge transformations: ListView, FormView
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

    it('should pass through resizable', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'styled',
        resizable: true,
      });

      expect(node.resizable).toBe(true);
    });

    // objectstack#7176 retired `striped` / `bordered` / `virtualScroll` after
    // measuring this bridge — and every reader downstream of it — as
    // pass-through: the value was copied node-ward and no renderer ever applied
    // it. The three `pass through` cases that stood here asserted exactly that
    // dead copy. What replaces them is the inverse claim, and it is the one
    // worth pinning: the bridge must not resurrect the keys.
    //
    // The input fixture MUST carry the three keys — asserting their absence on
    // the output of a fixture that never supplied them would be green whatever
    // the bridge does. Stored view metadata authored before the retirement is
    // exactly this shape, so the case is also the realistic one. It compiles on
    // both pins because `transformListView(spec: any)` types its input as
    // `any`, so the GA `retiredKey()` tombstones cannot reject the literal.
    it('should drop the retired striped / bordered / virtualScroll keys', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'styled',
        resizable: true,
        striped: true,
        bordered: true,
        virtualScroll: true,
      });

      expect(node).not.toHaveProperty('striped');
      expect(node).not.toHaveProperty('bordered');
      expect(node).not.toHaveProperty('virtualScroll');
      // The surviving neighbour proves the fixture reached the bridge at all —
      // without it an early return would satisfy every assertion above.
      expect(node.resizable).toBe(true);
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
  // P2 Sharing / ExportOptions / Pagination Protocol Alignment
  // ========================================================================
  describe('P2 sharing/exportOptions/pagination alignment', () => {
    // #2890: `sharing` is the spec's `ViewSharing` shape on BOTH sides now, so
    // the bridge passes it through. It used to downgrade it here — inventing a
    // legacy `visibility` audience and an `enabled` flag that the renderer then
    // had to fold back into `type`.
    it('should pass spec sharing { type: personal } through unchanged', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'personal_view',
        sharing: { type: 'personal', lockedBy: 'admin@example.com' },
      });

      expect(node.sharing).toEqual({ type: 'personal', lockedBy: 'admin@example.com' });
    });

    it('should pass spec sharing { type: collaborative } through unchanged', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'collab_view',
        sharing: { type: 'collaborative' },
      });

      expect(node.sharing).toEqual({ type: 'collaborative' });
    });

    it('should preserve ObjectUI sharing format without overriding', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'objectui_view',
        sharing: { visibility: 'organization', enabled: true },
      });

      expect(node.sharing.visibility).toBe('organization');
      expect(node.sharing.enabled).toBe(true);
      expect(node.sharing.type).toBeUndefined();
    });

    it('should not override explicit visibility when type is set', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'mixed_view',
        sharing: { type: 'collaborative', visibility: 'public' },
      });

      expect(node.sharing.visibility).toBe('public');
      expect(node.sharing.type).toBe('collaborative');
    });

    // AUTHORIZED PIN MOVE (objectui#4585). This used to pin the bare array
    // reaching the node verbatim — the one shape ObjectGrid cannot read, since
    // it takes `exportOptions.formats` and `.formats` on an array is
    // `undefined`. The pin was about the bridge's output shape and never
    // rendered it, so the bridge stayed green while the view's declared formats
    // were silently replaced by the renderer's `['csv', 'json']` default. The
    // bridge now applies the spec's own parse-time lift, so the legacy spelling
    // arrives in the shape the renderer reads. Full coverage of the lift lives
    // in `ListViewExportOptionsLift.test.ts`; the end-to-end consequence is
    // pinned in plugin-grid's `specBridgeExportFormats.test.tsx`.
    it('should lift a legacy exportOptions array to the spec object form', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'export_spec',
        exportOptions: ['csv', 'xlsx'],
      });

      expect(node.exportOptions).toEqual({ formats: ['csv', 'xlsx'] });
    });

    it('should pass through exportOptions object format', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'export_obj',
        exportOptions: { formats: ['csv', 'json'], maxRecords: 5000 },
      });

      expect(node.exportOptions.formats).toEqual(['csv', 'json']);
      expect(node.exportOptions.maxRecords).toBe(5000);
    });

    it('should pass through pagination with pageSizeOptions', () => {
      const bridge = new SpecBridge();
      const node = bridge.transformListView({
        name: 'paginated',
        pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
      });

      expect(node.pagination.pageSize).toBe(25);
      expect(node.pagination.pageSizeOptions).toEqual([10, 25, 50, 100]);
    });
  });
});
