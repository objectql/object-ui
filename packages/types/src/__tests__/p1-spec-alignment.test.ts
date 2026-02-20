/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P1 Spec Protocol Alignment Tests
 * Tests for all P1 sub-items: ListView, FormView, Dashboard, Page, Record Components, i18n/ARIA
 */
import { describe, it, expect } from 'vitest';
import type {
  // P1.1 ListView types
  ListViewSchema,
  ObjectGridSchema,
  // P1.2 FormView types
  ObjectFormSchema,
  ObjectFormSection,
  // P1.3 Dashboard types
  DashboardWidgetSchema,
  DashboardSchema,
  // P1.4 Page types
  PageType,
  PageVariable,
  PageSchema,
  // P1.5 Record component types
  RecordDetailsComponentProps,
  RecordHighlightsComponentProps,
  RecordRelatedListComponentProps,
  RecordActivityComponentProps,
  RecordChatterComponentProps,
  RecordPathComponentProps,
} from '../index';

// ============================================================================
// P1.1 ListView Spec Alignment
// ============================================================================
describe('P1.1 ListView Spec Alignment', () => {
  it('should accept rowActions and bulkActions as string arrays', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'Account',
      rowActions: ['edit', 'delete', 'clone'],
      bulkActions: ['delete', 'assign', 'export'],
    };
    expect(schema.rowActions).toHaveLength(3);
    expect(schema.bulkActions).toHaveLength(3);
  });

  it('should accept virtualScroll boolean', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'Account',
      virtualScroll: true,
    };
    expect(schema.virtualScroll).toBe(true);
  });

  it('should accept showRecordCount and allowPrinting', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'Account',
      showRecordCount: true,
      allowPrinting: true,
    };
    expect(schema.showRecordCount).toBe(true);
    expect(schema.allowPrinting).toBe(true);
  });

  it('should accept userActions configuration', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'Account',
      userActions: {
        sort: true,
        search: true,
        filter: true,
        rowHeight: false,
        addRecordForm: true,
        buttons: ['custom_action_1'],
      },
    };
    expect(schema.userActions?.sort).toBe(true);
    expect(schema.userActions?.buttons).toEqual(['custom_action_1']);
  });

  it('should accept appearance configuration', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'Account',
      appearance: {
        showDescription: true,
        allowedVisualizations: ['grid', 'kanban'],
      },
    };
    expect(schema.appearance?.showDescription).toBe(true);
    expect(schema.appearance?.allowedVisualizations).toHaveLength(2);
  });

  it('should accept tabs configuration', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'Account',
      tabs: [
        { name: 'all', label: 'All Records', isDefault: true },
        { name: 'mine', label: 'My Records', filter: ['owner', '=', 'current_user'] },
      ],
    };
    expect(schema.tabs).toHaveLength(2);
    expect(schema.tabs![0].isDefault).toBe(true);
  });

  it('should accept addRecord configuration', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'Account',
      addRecord: {
        enabled: true,
        position: 'top',
        mode: 'inline',
        formView: 'quick_create',
      },
    };
    expect(schema.addRecord?.enabled).toBe(true);
    expect(schema.addRecord?.mode).toBe('inline');
  });

  it('should accept ObjectGridSchema with spec-aligned conditionalFormatting and emptyState', () => {
    const schema: ObjectGridSchema = {
      type: 'object-grid',
      objectName: 'Account',
      conditionalFormatting: [
        { condition: '${data.amount > 10000}', style: { backgroundColor: '#fee2e2' } },
      ],
      emptyState: { title: 'No Records', message: 'Create your first account', icon: 'Database' },
      virtualScroll: true,
      rowSpecActions: ['edit', 'delete'],
      bulkSpecActions: ['delete', 'export'],
    };
    expect(schema.conditionalFormatting).toHaveLength(1);
    expect(schema.emptyState?.title).toBe('No Records');
    expect(schema.virtualScroll).toBe(true);
    expect(schema.rowSpecActions).toEqual(['edit', 'delete']);
  });
});

// ============================================================================
// P1.2 FormView Spec Alignment
// ============================================================================
describe('P1.2 FormView Spec Alignment', () => {
  it('should accept all formType variants', () => {
    const formTypes: Array<ObjectFormSchema['formType']> = [
      'simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal',
    ];
    formTypes.forEach((formType) => {
      const schema: ObjectFormSchema = {
        type: 'object-form',
        objectName: 'Account',
        mode: 'create',
        formType,
      };
      expect(schema.formType).toBe(formType);
    });
  });

  it('should accept FormSection with 1-4 column layout', () => {
    const columns: Array<ObjectFormSection['columns']> = [1, 2, 3, 4];
    columns.forEach((col) => {
      const section: ObjectFormSection = {
        label: 'Basic Info',
        columns: col,
        fields: ['name', 'email'],
        collapsible: true,
        collapsed: false,
      };
      expect(section.columns).toBe(col);
    });
  });

  it('should accept FormField properties: widget, dependsOn, visibleOn, colSpan', () => {
    const schema: ObjectFormSchema = {
      type: 'object-form',
      objectName: 'Account',
      mode: 'edit',
      customFields: [
        {
          name: 'industry',
          label: 'Industry',
          type: 'select',
          widget: 'industry-picker',
        },
        {
          name: 'sub_industry',
          label: 'Sub-Industry',
          type: 'select',
          dependsOn: ['industry'],
          visibleOn: '${data.industry != null}',
          colSpan: 2,
        },
      ],
    };
    expect(schema.customFields).toHaveLength(2);
    expect(schema.customFields![1].dependsOn).toEqual(['industry']);
    expect(schema.customFields![1].visibleOn).toBe('${data.industry != null}');
    expect(schema.customFields![1].colSpan).toBe(2);
  });
});

// ============================================================================
// P1.3 Dashboard Spec Alignment
// ============================================================================
describe('P1.3 Dashboard Spec Alignment', () => {
  it('should accept widget data binding properties', () => {
    const widget: DashboardWidgetSchema = {
      type: 'bar-chart',
      title: 'Revenue by Region',
      object: 'Opportunity',
      filter: [['stage', '=', 'Closed Won']],
      categoryField: 'region',
      valueField: 'amount',
      aggregate: 'sum',
    };
    expect(widget.object).toBe('Opportunity');
    expect(widget.categoryField).toBe('region');
    expect(widget.valueField).toBe('amount');
    expect(widget.aggregate).toBe('sum');
  });

  it('should accept widget color variants', () => {
    const variants: Array<DashboardWidgetSchema['colorVariant']> = [
      'default', 'blue', 'teal', 'orange', 'purple', 'success', 'warning', 'danger',
    ];
    variants.forEach((variant) => {
      const widget: DashboardWidgetSchema = {
        type: 'metric',
        title: 'Test',
        colorVariant: variant,
      };
      expect(widget.colorVariant).toBe(variant);
    });
  });

  it('should accept widget measures (pivot/matrix)', () => {
    const widget: DashboardWidgetSchema = {
      type: 'pivot',
      title: 'Sales Matrix',
      measures: [
        { valueField: 'amount', aggregate: 'sum', label: 'Total Sales', format: '$0,0' },
        { valueField: 'count', aggregate: 'count', label: 'Deal Count' },
      ],
    };
    expect(widget.measures).toHaveLength(2);
    expect(widget.measures![0].label).toBe('Total Sales');
  });

  it('should accept globalFilters with optionsFrom', () => {
    const dashboard: DashboardSchema = {
      type: 'dashboard',
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
          targetWidgets: ['widget-0', 'widget-1'],
        },
      ],
    };
    expect(dashboard.globalFilters).toHaveLength(1);
    expect(dashboard.globalFilters![0].optionsFrom?.object).toBe('Region');
  });

  it('should accept date range filter', () => {
    const dashboard: DashboardSchema = {
      type: 'dashboard',
      widgets: [],
      dateRange: {
        field: 'created_at',
        defaultRange: 'last_30_days',
        allowCustomRange: true,
      },
    };
    expect(dashboard.dateRange?.defaultRange).toBe('last_30_days');
    expect(dashboard.dateRange?.allowCustomRange).toBe(true);
  });

  it('should accept DashboardHeader with actions', () => {
    const dashboard: DashboardSchema = {
      type: 'dashboard',
      widgets: [],
      header: {
        showTitle: true,
        showDescription: false,
        actions: [
          { label: 'Refresh', actionType: 'refresh', icon: 'RefreshCw' },
          { label: 'Export', actionUrl: '/api/export', icon: 'Download' },
        ],
      },
    };
    expect(dashboard.header?.showTitle).toBe(true);
    expect(dashboard.header?.actions).toHaveLength(2);
  });

  it('should accept widget ARIA properties', () => {
    const widget: DashboardWidgetSchema = {
      type: 'metric',
      title: 'Revenue',
      aria: {
        ariaLabel: 'Total Revenue Widget',
        role: 'figure',
      },
    };
    expect(widget.aria?.ariaLabel).toBe('Total Revenue Widget');
  });
});

// ============================================================================
// P1.4 Page Composition Spec Alignment
// ============================================================================
describe('P1.4 Page Composition Spec Alignment', () => {
  it('should accept all 16 page types', () => {
    const allTypes: PageType[] = [
      'record', 'home', 'app', 'utility',
      'dashboard', 'grid', 'list', 'gallery',
      'kanban', 'calendar', 'timeline', 'form',
      'record_detail', 'record_review', 'overview', 'blank',
    ];
    allTypes.forEach((type) => {
      const page: PageSchema = {
        type: 'page',
        pageType: type,
      };
      expect(page.pageType).toBe(type);
    });
  });

  it('should accept record_id in PageVariable type', () => {
    const variable: PageVariable = {
      name: 'recordId',
      type: 'record_id',
      source: 'url_param',
    };
    expect(variable.type).toBe('record_id');
    expect(variable.source).toBe('url_param');
  });

  it('should accept blank page layout', () => {
    const page: PageSchema = {
      type: 'page',
      pageType: 'blank',
      blankLayout: {
        columns: 12,
        rowHeight: 60,
        gap: 8,
        items: [
          { componentId: 'header-1', x: 0, y: 0, width: 12, height: 2 },
          { componentId: 'chart-1', x: 0, y: 2, width: 6, height: 4 },
          { componentId: 'metric-1', x: 6, y: 2, width: 6, height: 4 },
        ],
      },
    };
    expect(page.blankLayout?.columns).toBe(12);
    expect(page.blankLayout?.items).toHaveLength(3);
    expect(page.blankLayout?.items![0].componentId).toBe('header-1');
  });

  it('should accept page ARIA properties', () => {
    const page: PageSchema = {
      type: 'page',
      aria: {
        ariaLabel: 'Account Details Page',
        role: 'main',
      },
    };
    expect(page.aria?.ariaLabel).toBe('Account Details Page');
  });
});

// ============================================================================
// P1.5 Record Components
// ============================================================================
describe('P1.5 Record Components', () => {
  it('should define RecordDetailsComponentProps', () => {
    const props: RecordDetailsComponentProps = {
      columns: 2,
      layout: 'stacked',
      sections: [
        { label: 'Basic Info', fields: ['name', 'email', 'phone'], collapsible: true },
        { label: 'Address', fields: ['street', 'city', 'state'], collapsed: true },
      ],
      fields: ['name', 'email'],
      aria: { ariaLabel: 'Account Details' },
    };
    expect(props.columns).toBe(2);
    expect(props.sections).toHaveLength(2);
    expect(props.layout).toBe('stacked');
  });

  it('should define RecordHighlightsComponentProps', () => {
    const props: RecordHighlightsComponentProps = {
      fields: ['name', 'status', 'owner', 'amount'],
      layout: 'horizontal',
      aria: { ariaLabel: 'Key Highlights' },
    };
    expect(props.fields).toHaveLength(4);
    expect(props.layout).toBe('horizontal');
  });

  it('should define RecordRelatedListComponentProps', () => {
    const props: RecordRelatedListComponentProps = {
      objectName: 'Contact',
      relationshipField: 'account_id',
      columns: ['name', 'email', 'phone'],
      sort: [{ field: 'name', order: 'asc' }],
      limit: 5,
      filter: [['active', '=', true]],
      title: 'Related Contacts',
      showViewAll: true,
      actions: ['new', 'edit'],
      aria: { ariaLabel: 'Related Contacts List' },
    };
    expect(props.objectName).toBe('Contact');
    expect(props.relationshipField).toBe('account_id');
    expect(props.columns).toHaveLength(3);
  });

  it('should define RecordActivityComponentProps', () => {
    const props: RecordActivityComponentProps = {
      types: ['comment', 'email', 'task', 'event'],
      filterMode: 'all',
      showFilterToggle: true,
      limit: 20,
      showCompleted: false,
      unifiedTimeline: true,
      showCommentInput: true,
      enableMentions: true,
      enableReactions: true,
      enableThreading: true,
      showSubscriptionToggle: true,
      aria: { ariaLabel: 'Activity Timeline' },
    };
    expect(props.types).toHaveLength(4);
    expect(props.enableMentions).toBe(true);
    expect(props.unifiedTimeline).toBe(true);
  });

  it('should define RecordChatterComponentProps with feed', () => {
    const props: RecordChatterComponentProps = {
      position: 'right',
      width: '350px',
      collapsible: true,
      defaultCollapsed: false,
      feed: {
        types: ['comment'],
        showCommentInput: true,
        enableMentions: true,
        enableThreading: true,
      },
      aria: { ariaLabel: 'Record Discussion' },
    };
    expect(props.position).toBe('right');
    expect(props.feed?.enableMentions).toBe(true);
  });

  it('should define RecordPathComponentProps', () => {
    const props: RecordPathComponentProps = {
      statusField: 'stage',
      stages: [
        { value: 'prospecting', label: 'Prospecting' },
        { value: 'qualification', label: 'Qualification' },
        { value: 'proposal', label: 'Proposal' },
        { value: 'closed_won', label: 'Closed Won' },
      ],
      aria: { ariaLabel: 'Opportunity Stage Path' },
    };
    expect(props.statusField).toBe('stage');
    expect(props.stages).toHaveLength(4);
    expect(props.stages[0].value).toBe('prospecting');
  });
});

// ============================================================================
// P1.6 i18n & ARIA Protocol Alignment
// ============================================================================
describe('P1.6 i18n & ARIA Protocol Alignment', () => {
  it('should accept ARIA props on ListViewSchema', () => {
    const schema: ListViewSchema = {
      type: 'list-view',
      objectName: 'Account',
      aria: {
        label: 'Accounts List',
        describedBy: 'accounts-description',
        live: 'polite',
      },
    };
    expect(schema.aria?.label).toBe('Accounts List');
    expect(schema.aria?.live).toBe('polite');
  });

  it('should accept ARIA props on DashboardSchema', () => {
    const schema: DashboardSchema = {
      type: 'dashboard',
      widgets: [],
      aria: {
        ariaLabel: 'Sales Dashboard',
        role: 'region',
      },
    };
    expect(schema.aria?.ariaLabel).toBe('Sales Dashboard');
  });

  it('should accept ARIA props on PageSchema', () => {
    const schema: PageSchema = {
      type: 'page',
      aria: {
        ariaLabel: 'Home Page',
        ariaDescribedBy: 'home-description',
        role: 'main',
      },
    };
    expect(schema.aria?.ariaLabel).toBe('Home Page');
  });
});
