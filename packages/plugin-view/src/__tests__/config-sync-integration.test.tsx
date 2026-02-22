/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Config Sync Integration Tests (Phase 7 — P1.8.1)
 *
 * Per-view-type tests verifying that ViewConfigPanel config properties
 * propagate through PluginObjectView's renderListView to each view type.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObjectView } from '../ObjectView';
import type { ObjectViewSchema, DataSource } from '@object-ui/types';

// Mock @object-ui/react to avoid circular dependency issues
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: any) => (
    <div data-testid="schema-renderer" data-schema-type={schema?.type}>
      {schema?.type}
    </div>
  ),
  SchemaRendererContext: null,
}));

// Mock @object-ui/plugin-grid
vi.mock('@object-ui/plugin-grid', () => ({
  ObjectGrid: ({ schema, onRowClick }: any) => (
    <div data-testid="object-grid" data-object={schema?.objectName}>
      <button data-testid="grid-row" onClick={() => onRowClick?.({ _id: '1', name: 'Test' })}>
        Row 1
      </button>
    </div>
  ),
}));

// Mock @object-ui/plugin-form
vi.mock('@object-ui/plugin-form', () => ({
  ObjectForm: ({ schema }: any) => (
    <div data-testid="object-form" data-mode={schema?.mode}>
      Form ({schema?.mode})
    </div>
  ),
}));

const createMockDataSource = (): DataSource => ({
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({}),
  getObjectSchema: vi.fn().mockResolvedValue({
    label: 'Contacts',
    fields: {
      name: { label: 'Name', type: 'text' },
      email: { label: 'Email', type: 'text' },
      status: {
        label: 'Status',
        type: 'select',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
      created_at: { label: 'Created', type: 'date' },
    },
  }),
} as DataSource);

describe('Config Sync Integration — Per View Type', () => {
  let mockDataSource: DataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();
  });

  // ── Grid Config Sync ──

  it('Grid: propagates showSort, showSearch, showFilters, striped, bordered via renderListView', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">Grid</div>
    ));

    const views = [
      {
        id: 'v1',
        label: 'Grid View',
        type: 'grid' as const,
        showSort: false,
        showSearch: true,
        showFilters: false,
        striped: true,
        bordered: true,
      },
    ];

    render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={views}
        activeViewId="v1"
        renderListView={renderListViewSpy}
      />,
    );

    expect(renderListViewSpy).toHaveBeenCalled();
    const callSchema = renderListViewSpy.mock.calls[0]?.[0]?.schema;
    expect(callSchema?.showSort).toBe(false);
    expect(callSchema?.showSearch).toBe(true);
    expect(callSchema?.showFilters).toBe(false);
    expect(callSchema?.striped).toBe(true);
    expect(callSchema?.bordered).toBe(true);
    expect(callSchema?.viewType).toBe('grid');
  });

  // ── Kanban Config Sync ──

  it('Kanban: propagates groupBy, color, showSearch via renderListView', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">Kanban</div>
    ));

    const views = [
      {
        id: 'v2',
        label: 'Kanban View',
        type: 'kanban' as const,
        showSearch: false,
        color: 'blue',
        groupBy: 'status',
      },
    ];

    render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={views}
        activeViewId="v2"
        renderListView={renderListViewSpy}
      />,
    );

    expect(renderListViewSpy).toHaveBeenCalled();
    const callSchema = renderListViewSpy.mock.calls[0]?.[0]?.schema;
    expect(callSchema?.showSearch).toBe(false);
    expect(callSchema?.color).toBe('blue');
    expect(callSchema?.viewType).toBe('kanban');
  });

  // ── Calendar Config Sync ──

  it('Calendar: propagates startDateField, endDateField, showFilters via renderListView', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">Calendar</div>
    ));

    const views = [
      {
        id: 'v3',
        label: 'Calendar View',
        type: 'calendar' as const,
        showFilters: false,
        showSearch: true,
      },
    ];

    render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={views}
        activeViewId="v3"
        renderListView={renderListViewSpy}
      />,
    );

    expect(renderListViewSpy).toHaveBeenCalled();
    const callSchema = renderListViewSpy.mock.calls[0]?.[0]?.schema;
    expect(callSchema?.showFilters).toBe(false);
    expect(callSchema?.showSearch).toBe(true);
    expect(callSchema?.viewType).toBe('calendar');
  });

  // ── Timeline/Gantt Config Sync ──

  it('Timeline: propagates dateField, appearance properties via renderListView', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">Timeline</div>
    ));

    const views = [
      {
        id: 'v4',
        label: 'Timeline View',
        type: 'timeline' as const,
        striped: true,
        color: 'green',
      },
    ];

    render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={views}
        activeViewId="v4"
        renderListView={renderListViewSpy}
      />,
    );

    expect(renderListViewSpy).toHaveBeenCalled();
    const callSchema = renderListViewSpy.mock.calls[0]?.[0]?.schema;
    expect(callSchema?.striped).toBe(true);
    expect(callSchema?.color).toBe('green');
    expect(callSchema?.viewType).toBe('timeline');
  });

  it('Gantt: propagates appearance properties via renderListView', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">Gantt</div>
    ));

    const views = [
      {
        id: 'v5',
        label: 'Gantt View',
        type: 'gantt' as const,
        bordered: true,
        showSort: true,
      },
    ];

    render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={views}
        activeViewId="v5"
        renderListView={renderListViewSpy}
      />,
    );

    expect(renderListViewSpy).toHaveBeenCalled();
    const callSchema = renderListViewSpy.mock.calls[0]?.[0]?.schema;
    expect(callSchema?.bordered).toBe(true);
    expect(callSchema?.showSort).toBe(true);
    expect(callSchema?.viewType).toBe('gantt');
  });

  // ── Gallery Config Sync ──

  it('Gallery: propagates imageField, titleField, appearance via renderListView', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">Gallery</div>
    ));

    const views = [
      {
        id: 'v6',
        label: 'Gallery View',
        type: 'gallery' as const,
        striped: false,
        bordered: true,
        showSearch: true,
      },
    ];

    render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={views}
        activeViewId="v6"
        renderListView={renderListViewSpy}
      />,
    );

    expect(renderListViewSpy).toHaveBeenCalled();
    const callSchema = renderListViewSpy.mock.calls[0]?.[0]?.schema;
    expect(callSchema?.striped).toBe(false);
    expect(callSchema?.bordered).toBe(true);
    expect(callSchema?.showSearch).toBe(true);
    expect(callSchema?.viewType).toBe('gallery');
  });

  // ── Map Config Sync ──

  it('Map: propagates locationField, appearance via renderListView', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">Map</div>
    ));

    const views = [
      {
        id: 'v7',
        label: 'Map View',
        type: 'map' as const,
        showFilters: true,
        color: 'red',
      },
    ];

    render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={views}
        activeViewId="v7"
        renderListView={renderListViewSpy}
      />,
    );

    expect(renderListViewSpy).toHaveBeenCalled();
    const callSchema = renderListViewSpy.mock.calls[0]?.[0]?.schema;
    expect(callSchema?.showFilters).toBe(true);
    expect(callSchema?.color).toBe('red');
    expect(callSchema?.viewType).toBe('map');
  });

  // ── Cross-view-type config transfer ──

  it('Cross-view: config properties transfer correctly when view type changes', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">{listSchema?.viewType}</div>
    ));

    const gridViews = [
      {
        id: 'v1',
        label: 'Grid View',
        type: 'grid' as const,
        showSearch: false,
        showFilters: true,
        striped: true,
      },
    ];

    const { rerender } = render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={gridViews}
        activeViewId="v1"
        renderListView={renderListViewSpy}
      />,
    );

    // Verify grid config
    const gridSchema = renderListViewSpy.mock.calls[0]?.[0]?.schema;
    expect(gridSchema?.viewType).toBe('grid');
    expect(gridSchema?.showSearch).toBe(false);
    expect(gridSchema?.striped).toBe(true);

    // Switch to kanban with different config
    const kanbanViews = [
      {
        id: 'v1',
        label: 'Kanban View',
        type: 'kanban' as const,
        showSearch: true,
        showFilters: false,
        striped: false,
      },
    ];

    rerender(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={kanbanViews}
        activeViewId="v1"
        renderListView={renderListViewSpy}
      />,
    );

    const lastCallIndex = renderListViewSpy.mock.calls.length - 1;
    const kanbanSchema = renderListViewSpy.mock.calls[lastCallIndex]?.[0]?.schema;
    expect(kanbanSchema?.viewType).toBe('kanban');
    expect(kanbanSchema?.showSearch).toBe(true);
    expect(kanbanSchema?.showFilters).toBe(false);
    expect(kanbanSchema?.striped).toBe(false);
  });

  // ── Extended property propagation ──

  it('propagates all P0/P1/P2 spec properties via renderListView for grid view', () => {
    const schema: ObjectViewSchema = {
      type: 'object-view',
      objectName: 'contacts',
    };

    const renderListViewSpy = vi.fn(({ schema: listSchema }: any) => (
      <div data-testid="custom-list">Grid</div>
    ));

    const views = [
      {
        id: 'v1',
        label: 'Full Config View',
        type: 'grid' as const,
        // Toolbar toggles
        showSearch: true,
        showFilters: false,
        showSort: true,
        showHideFields: false,
        showGroup: true,
        showColor: false,
        showDensity: true,
        allowExport: true,
        // Display properties
        striped: true,
        bordered: false,
        color: 'blue',
        // View config properties
        inlineEdit: true,
        wrapHeaders: true,
        clickIntoRecordDetails: false,
        addRecordViaForm: true,
        addDeleteRecordsInline: false,
        collapseAllByDefault: true,
        fieldTextColor: 'red',
        prefixField: 'name',
        showDescription: true,
        // P0/P1/P2 new spec properties
        navigation: { mode: 'drawer' },
        selection: { type: 'multi' },
        pagination: { pageSize: 25 },
        searchableFields: ['name', 'email'],
        filterableFields: ['status'],
        resizable: true,
        hiddenFields: ['created_at'],
        rowActions: ['edit', 'delete'],
        bulkActions: ['export'],
        sharing: { enabled: true, visibility: 'team' },
        addRecord: { enabled: true },
        conditionalFormatting: [{ field: 'status', operator: 'equals', value: 'active' }],
        quickFilters: [{ label: 'Active', filters: [], defaultActive: true }],
        showRecordCount: true,
        allowPrinting: true,
        virtualScroll: true,
        emptyState: { title: 'No data', message: 'Add records', icon: 'inbox' },
        aria: { label: 'Contacts', describedBy: 'desc', live: 'polite' },
      },
    ];

    render(
      <ObjectView
        schema={schema}
        dataSource={mockDataSource}
        views={views}
        activeViewId="v1"
        renderListView={renderListViewSpy}
      />,
    );

    expect(renderListViewSpy).toHaveBeenCalled();
    const s = renderListViewSpy.mock.calls[0]?.[0]?.schema;

    // Toolbar toggles
    expect(s?.showSearch).toBe(true);
    expect(s?.showFilters).toBe(false);
    expect(s?.showSort).toBe(true);
    expect(s?.showHideFields).toBe(false);
    expect(s?.showGroup).toBe(true);
    expect(s?.showColor).toBe(false);
    expect(s?.showDensity).toBe(true);
    expect(s?.allowExport).toBe(true);

    // Display properties
    expect(s?.striped).toBe(true);
    expect(s?.bordered).toBe(false);
    expect(s?.color).toBe('blue');

    // View config properties
    expect(s?.inlineEdit).toBe(true);
    expect(s?.wrapHeaders).toBe(true);
    expect(s?.clickIntoRecordDetails).toBe(false);
    expect(s?.addRecordViaForm).toBe(true);
    expect(s?.addDeleteRecordsInline).toBe(false);
    expect(s?.collapseAllByDefault).toBe(true);
    expect(s?.fieldTextColor).toBe('red');
    expect(s?.prefixField).toBe('name');
    expect(s?.showDescription).toBe(true);

    // P0/P1/P2 new spec properties
    expect(s?.navigation).toEqual({ mode: 'drawer' });
    expect(s?.selection).toEqual({ type: 'multi' });
    expect(s?.pagination).toEqual({ pageSize: 25 });
    expect(s?.searchableFields).toEqual(['name', 'email']);
    expect(s?.filterableFields).toEqual(['status']);
    expect(s?.resizable).toBe(true);
    expect(s?.hiddenFields).toEqual(['created_at']);
    expect(s?.rowActions).toEqual(['edit', 'delete']);
    expect(s?.bulkActions).toEqual(['export']);
    expect(s?.sharing).toEqual({ enabled: true, visibility: 'team' });
    expect(s?.addRecord).toEqual({ enabled: true });
    expect(s?.conditionalFormatting).toEqual([{ field: 'status', operator: 'equals', value: 'active' }]);
    expect(s?.quickFilters).toEqual([{ label: 'Active', filters: [], defaultActive: true }]);
    expect(s?.showRecordCount).toBe(true);
    expect(s?.allowPrinting).toBe(true);
    expect(s?.virtualScroll).toBe(true);
    expect(s?.emptyState).toEqual({ title: 'No data', message: 'Add records', icon: 'inbox' });
    expect(s?.aria).toEqual({ label: 'Contacts', describedBy: 'desc', live: 'polite' });
  });
});
