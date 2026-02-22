/**
 * Tests for Phase 2 Schema Definitions
 * Testing AppSchema, ThemeSchema, ReportSchema, BlockSchema, and Enhanced ActionSchema
 */
import { describe, it, expect } from 'vitest';
import {
  AppSchema,
  AppActionSchema,
  AppMenuItemSchema,
  ThemeSchema,
  ThemeSwitcherSchema,
  ThemePreviewSchema,
  ReportSchema,
  ReportBuilderSchema,
  ReportViewerSchema,
  BlockSchema,
  BlockLibrarySchema,
  BlockEditorSchema,
  BlockInstanceSchema,
  ActionSchema,
  ActionExecutionModeSchema,
  ActionCallbackSchema,
  ActionConditionSchema,
  CRUDSchema,
  DetailViewSchema,
  ViewSwitcherSchema,
  FilterUISchema,
  SortUISchema,
  AnyComponentSchema,
  ListViewSchema,
} from '../zod/index.zod';

describe('Phase 2: AppSchema Zod Validation', () => {
  it('should validate a complete AppSchema', () => {
    const appConfig = {
      type: 'app',
      name: 'my-crm',
      title: 'My CRM Application',
      description: 'Customer Relationship Management System',
      logo: '/logo.png',
      favicon: '/favicon.ico',
      layout: 'sidebar',
      menu: [
        {
          type: 'item',
          label: 'Dashboard',
          icon: 'LayoutDashboard',
          path: '/dashboard',
        },
        {
          type: 'group',
          label: 'Sales',
          children: [
            {
              type: 'item',
              label: 'Leads',
              icon: 'Users',
              path: '/leads',
            },
            {
              type: 'item',
              label: 'Opportunities',
              icon: 'Target',
              path: '/opportunities',
            },
          ],
        },
      ],
      actions: [
        {
          type: 'user',
          label: 'John Doe',
          avatar: '/avatar.jpg',
          description: 'john@example.com',
          items: [
            { type: 'item', label: 'Profile', path: '/profile' },
            { type: 'item', label: 'Settings', path: '/settings' },
            { type: 'separator' },
            { type: 'item', label: 'Logout', path: '/logout' },
          ],
        },
      ],
    };

    const result = AppSchema.safeParse(appConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('app');
      expect(result.data.layout).toBe('sidebar');
      expect(result.data.menu).toHaveLength(2);
    }
  });

  it('should validate minimal AppSchema', () => {
    const minimal = {
      type: 'app',
    };

    const result = AppSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should reject invalid layout value', () => {
    const invalid = {
      type: 'app',
      layout: 'invalid-layout',
    };

    const result = AppSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('Phase 2: ThemeSchema Zod Validation', () => {
  it('should validate a complete ThemeSchema', () => {
    const theme = {
      type: 'theme',
      mode: 'dark',
      activeTheme: 'professional',
      themes: [
        {
          name: 'professional',
          label: 'Professional',
          mode: 'auto',
          colors: {
            primary: '#3b82f6',
            secondary: '#64748b',
            background: '#ffffff',
            text: '#0f172a',
          },
          typography: {
            fontFamily: { base: 'Inter, sans-serif' },
            fontSize: { base: '1rem' },
            lineHeight: { normal: '1.5' },
          },
          borderRadius: {
            base: '0.5rem',
            lg: '1rem',
          },
        },
      ],
      allowSwitching: true,
      persistPreference: true,
      storageKey: 'app-theme',
    };

    const result = ThemeSchema.safeParse(theme);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('dark');
      expect(result.data.themes).toHaveLength(1);
    }
  });

  it('should validate ThemeSwitcherSchema', () => {
    const switcher = {
      type: 'theme-switcher',
      variant: 'dropdown',
      showMode: true,
      showThemes: true,
      lightIcon: 'Sun',
      darkIcon: 'Moon',
    };

    const result = ThemeSwitcherSchema.safeParse(switcher);
    expect(result.success).toBe(true);
  });
});

describe('Phase 2: ReportSchema Zod Validation', () => {
  it('should validate a complete ReportSchema', () => {
    const report = {
      type: 'report',
      title: 'Monthly Sales Report',
      description: 'Sales performance for the month',
      fields: [
        {
          name: 'total_sales',
          label: 'Total Sales',
          type: 'number',
          aggregation: 'sum',
          format: 'currency',
        },
        {
          name: 'customer_count',
          label: 'Customers',
          type: 'number',
          aggregation: 'count',
        },
      ],
      filters: [
        {
          field: 'date',
          operator: 'between',
          values: ['2024-01-01', '2024-01-31'],
        },
      ],
      groupBy: [
        {
          field: 'region',
          label: 'Region',
          sort: 'asc',
        },
      ],
      sections: [
        {
          type: 'summary',
          title: 'Summary',
        },
        {
          type: 'chart',
          title: 'Sales Trend',
        },
        {
          type: 'table',
          title: 'Detailed Data',
        },
      ],
      schedule: {
        enabled: true,
        frequency: 'monthly',
        dayOfMonth: 1,
        time: '09:00',
        recipients: ['manager@example.com'],
        formats: ['pdf', 'excel'],
      },
      showExportButtons: true,
      showPrintButton: true,
    };

    const result = ReportSchema.safeParse(report);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fields).toHaveLength(2);
      expect(result.data.schedule?.frequency).toBe('monthly');
    }
  });

  it('should validate ReportBuilderSchema', () => {
    const builder = {
      type: 'report-builder',
      showPreview: true,
      onSave: 'handleSave',
      onCancel: 'handleCancel',
    };

    const result = ReportBuilderSchema.safeParse(builder);
    expect(result.success).toBe(true);
  });
});

describe('Phase 2: BlockSchema Zod Validation', () => {
  it('should validate a complete BlockSchema', () => {
    const block = {
      type: 'block',
      meta: {
        name: 'hero-section',
        label: 'Hero Section',
        description: 'A customizable hero section with image and text',
        category: 'Marketing',
        icon: 'Layout',
        tags: ['hero', 'landing', 'marketing'],
        author: 'ObjectUI Team',
        version: '1.0.0',
      },
      variables: [
        {
          name: 'title',
          label: 'Title',
          type: 'string',
          defaultValue: 'Welcome',
          required: true,
        },
        {
          name: 'subtitle',
          label: 'Subtitle',
          type: 'string',
          defaultValue: 'Get started today',
        },
        {
          name: 'showButton',
          label: 'Show Button',
          type: 'boolean',
          defaultValue: true,
        },
      ],
      slots: [
        {
          name: 'content',
          label: 'Content',
          description: 'Main content area',
          required: false,
        },
      ],
      template: {
        type: 'div',
        className: 'hero',
        children: [
          {
            type: 'text',
            value: '${title}',
          },
        ],
      },
      editable: true,
    };

    const result = BlockSchema.safeParse(block);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta?.name).toBe('hero-section');
      expect(result.data.variables).toHaveLength(3);
      expect(result.data.slots).toHaveLength(1);
    }
  });

  it('should validate BlockLibrarySchema', () => {
    const library = {
      type: 'block-library',
      category: 'Marketing',
      searchQuery: 'hero',
      showPremium: true,
      loading: false,
    };

    const result = BlockLibrarySchema.safeParse(library);
    expect(result.success).toBe(true);
  });
});

describe('Phase 2: Enhanced ActionSchema Zod Validation', () => {
  it('should validate ajax action type', () => {
    const ajaxAction = {
      type: 'action',
      label: 'Load Data',
      actionType: 'ajax',
      api: '/api/data',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer token',
      },
      onSuccess: {
        type: 'toast',
        message: 'Data loaded successfully',
      },
      onFailure: {
        type: 'message',
        message: 'Failed to load data',
      },
    };

    const result = ActionSchema.safeParse(ajaxAction);
    expect(result.success).toBe(true);
  });

  it('should validate confirm action type', () => {
    const confirmAction = {
      type: 'action',
      label: 'Delete Record',
      actionType: 'confirm',
      confirm: {
        title: 'Confirm Deletion',
        message: 'Are you sure you want to delete this record?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmVariant: 'destructive',
      },
      api: '/api/records/123',
      method: 'DELETE',
    };

    const result = ActionSchema.safeParse(confirmAction);
    expect(result.success).toBe(true);
  });

  it('should validate dialog action type', () => {
    const dialogAction = {
      type: 'action',
      label: 'Edit Details',
      actionType: 'dialog',
      dialog: {
        title: 'Edit Record',
        size: 'lg',
        content: {
          type: 'form',
          fields: [],
        },
      },
    };

    const result = ActionSchema.safeParse(dialogAction);
    expect(result.success).toBe(true);
  });

  it('should validate action chaining', () => {
    const chainedAction = {
      type: 'action',
      label: 'Process Order',
      actionType: 'ajax',
      api: '/api/orders/process',
      method: 'POST',
      chain: [
        {
          type: 'action',
          label: 'Send Email',
          actionType: 'ajax',
          api: '/api/emails/send',
          method: 'POST',
        },
        {
          type: 'action',
          label: 'Update Inventory',
          actionType: 'ajax',
          api: '/api/inventory/update',
          method: 'PUT',
        },
      ],
      chainMode: 'sequential',
    };

    const result = ActionSchema.safeParse(chainedAction);
    expect(result.success).toBe(true);
  });

  it('should validate conditional action execution', () => {
    const conditionalAction = {
      type: 'action',
      label: 'Approve',
      actionType: 'button',
      condition: {
        expression: '${data.amount > 1000}',
        then: {
          type: 'action',
          label: 'Require Manager Approval',
          actionType: 'confirm',
        },
        else: {
          type: 'action',
          label: 'Auto Approve',
          actionType: 'ajax',
        },
      },
    };

    const result = ActionSchema.safeParse(conditionalAction);
    expect(result.success).toBe(true);
  });

  it('should validate action with tracking', () => {
    const trackedAction = {
      type: 'action',
      label: 'Download Report',
      actionType: 'ajax',
      api: '/api/reports/download',
      tracking: {
        enabled: true,
        event: 'report_downloaded',
        metadata: {
          reportType: 'sales',
          format: 'pdf',
        },
      },
    };

    const result = ActionSchema.safeParse(trackedAction);
    expect(result.success).toBe(true);
  });

  it('should validate action with retry configuration', () => {
    const retryAction = {
      type: 'action',
      label: 'Submit',
      actionType: 'ajax',
      api: '/api/submit',
      timeout: 30000,
      retry: {
        maxAttempts: 3,
        delay: 1000,
      },
    };

    const result = ActionSchema.safeParse(retryAction);
    expect(result.success).toBe(true);
  });
});

describe('Phase 2: View Schemas Zod Validation', () => {
  it('should validate DetailViewSchema', () => {
    const detailView = {
      type: 'detail-view',
      title: 'Customer Details',
      api: '/api/customers/123',
      layout: 'grid',
      columns: 2,
      sections: [
        {
          title: 'Basic Information',
          fields: [
            {
              name: 'name',
              label: 'Name',
              type: 'text',
            },
            {
              name: 'email',
              label: 'Email',
              type: 'text',
            },
          ],
        },
      ],
      tabs: [
        {
          key: 'orders',
          label: 'Orders',
          content: {
            type: 'table',
            columns: [],
          },
        },
      ],
      showBack: true,
      showEdit: true,
      showDelete: false,
    };

    const result = DetailViewSchema.safeParse(detailView);
    expect(result.success).toBe(true);
  });

  it('should validate ViewSwitcherSchema', () => {
    const viewSwitcher = {
      type: 'view-switcher',
      views: [
        {
          type: 'list',
          label: 'List View',
          icon: 'List',
        },
        {
          type: 'grid',
          label: 'Grid View',
          icon: 'Grid',
        },
        {
          type: 'kanban',
          label: 'Kanban',
          icon: 'Kanban',
        },
      ],
      defaultView: 'list',
      variant: 'tabs',
      position: 'top',
      persistPreference: true,
      storageKey: 'view-preference',
    };

    const result = ViewSwitcherSchema.safeParse(viewSwitcher);
    expect(result.success).toBe(true);
  });

  it('should validate FilterUISchema', () => {
    const filterUI = {
      type: 'filter-ui',
      filters: [
        {
          field: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
        },
        {
          field: 'created_at',
          label: 'Created Date',
          type: 'date-range',
        },
      ],
      showClear: true,
      showApply: true,
      layout: 'popover',
    };

    const result = FilterUISchema.safeParse(filterUI);
    expect(result.success).toBe(true);
  });

  it('should validate SortUISchema', () => {
    const sortUI = {
      type: 'sort-ui',
      fields: [
        {
          field: 'name',
          label: 'Name',
        },
        {
          field: 'created_at',
          label: 'Created Date',
        },
      ],
      sort: [
        {
          field: 'created_at',
          direction: 'desc',
        },
      ],
      multiple: false,
      variant: 'dropdown',
    };

    const result = SortUISchema.safeParse(sortUI);
    expect(result.success).toBe(true);
  });
});

describe('Phase 2: AnyComponentSchema Union Type', () => {
  it('should validate any Phase 2 schema through union type', () => {
    const schemas = [
      { type: 'app', name: 'test-app' },
      { type: 'theme', mode: 'light' },
      { type: 'report', title: 'Test Report' },
      { type: 'block', meta: { name: 'test-block' } },
      { type: 'action', label: 'Test Action' },
      { type: 'detail-view', title: 'Test Detail' },
      { type: 'view-switcher', views: [] },
    ];

    schemas.forEach((schema) => {
      const result = AnyComponentSchema.safeParse(schema);
      expect(result.success).toBe(true);
    });
  });
});

describe('ListViewSchema userFilters Zod Validation', () => {
  it('should validate dropdown mode userFilters', () => {
    const schema = {
      type: 'list-view',
      objectName: 'accounts',
      userFilters: {
        element: 'dropdown',
        fields: [
          {
            field: 'status',
            label: 'Status',
            type: 'multi-select',
            showCount: true,
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive', color: '#dc2626' },
            ],
            defaultValues: ['active'],
          },
        ],
      },
    };
    const result = ListViewSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('should validate tabs mode userFilters', () => {
    const schema = {
      type: 'list-view',
      objectName: 'accounts',
      userFilters: {
        element: 'tabs',
        showAllRecords: true,
        allowAddTab: true,
        tabs: [
          { id: 'tab-1', label: 'Active', filters: [['status', '=', 'active']], default: true },
          { id: 'tab-2', label: 'My Items', filters: [['owner', '=', '$currentUser']] },
        ],
      },
    };
    const result = ListViewSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('should validate toggle mode userFilters', () => {
    const schema = {
      type: 'list-view',
      objectName: 'accounts',
      userFilters: {
        element: 'toggle',
        fields: [
          { field: 'is_active', label: 'Active Only' },
          { field: 'is_vip', label: 'VIP', defaultValues: [true] },
        ],
      },
    };
    const result = ListViewSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('should reject invalid element type', () => {
    const schema = {
      type: 'list-view',
      objectName: 'accounts',
      userFilters: {
        element: 'invalid',
      },
    };
    const result = ListViewSchema.safeParse(schema);
    expect(result.success).toBe(false);
  });

  it('should validate ListViewSchema without userFilters (backward compat)', () => {
    const schema = {
      type: 'list-view',
      objectName: 'accounts',
      fields: ['name', 'email'],
    };
    const result = ListViewSchema.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('should validate ListViewSchema with showSearch/showSort/showFilters/striped/bordered/color', () => {
    const schema = {
      type: 'list-view',
      objectName: 'accounts',
      fields: ['name', 'email'],
      showSearch: true,
      showSort: false,
      showFilters: true,
      striped: true,
      bordered: false,
      color: 'status',
    };
    const result = ListViewSchema.safeParse(schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.showSearch).toBe(true);
      expect(result.data.showSort).toBe(false);
      expect(result.data.showFilters).toBe(true);
      expect(result.data.striped).toBe(true);
      expect(result.data.bordered).toBe(false);
      expect(result.data.color).toBe('status');
    }
  });
});
