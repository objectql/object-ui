import { defineStack } from '@objectstack/spec';
import { App } from '@objectstack/spec/ui';
import { KitchenSinkObject } from './src/objects/kitchen_sink.object';
import { AccountObject } from './src/objects/account.object';
import { ShowcaseObject } from './src/objects/showcase.object';

// Helper to create dates relative to today
const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

export default defineStack({
  objects: [
    KitchenSinkObject,
    AccountObject,
    ShowcaseObject
  ],
  views: [
    {
      listViews: {
        all_fields: {
          name: 'all_fields',
          label: 'All Field Types',
          type: 'grid' as const,
          data: { provider: 'object' as const, object: 'kitchen_sink' },
          columns: ['name', 'category', 'amount', 'price', 'percent', 'rating', 'due_date', 'is_active', 'email'],
          sort: [{ field: 'name', order: 'asc' as const }],
        },
      },
    },
    {
      listViews: {
        all_showcase: {
          name: 'all_showcase',
          label: 'All Showcase Items',
          type: 'grid' as const,
          data: { provider: 'object' as const, object: 'showcase' },
          columns: ['title', 'category', 'status', 'priority', 'price', 'start_date', 'owner_email', 'is_featured'],
          sort: [{ field: 'title', order: 'asc' as const }],
        },
        showcase_board: {
          name: 'showcase_board',
          label: 'Status Board',
          type: 'kanban' as const,
          data: { provider: 'object' as const, object: 'showcase' },
          columns: ['title', 'priority', 'owner_email', 'start_date'],
          kanban: {
            groupByField: 'status',
            columns: ['title', 'priority', 'owner_email'],
          },
        },
      },
    },
  ],
  apps: [
    App.create({
      name: 'analytics_app',
      label: 'Showcase',
      icon: 'sparkles',
      description: 'All field types, dashboard widgets, and page layouts',
      branding: {
        primaryColor: '#8B5CF6',
      },
      navigation: [
        {
          id: 'nav_dash',
          type: 'dashboard',
          dashboardName: 'showcase_dashboard',
          label: 'Dashboard',
          icon: 'layout-dashboard',
        },
        {
          id: 'nav_kitchen_sink',
          type: 'object',
          objectName: 'kitchen_sink',
          label: 'All Field Types',
          icon: 'test-tubes',
        },
        {
          id: 'nav_showcase',
          type: 'object',
          objectName: 'showcase',
          label: 'Feature Showcase',
          icon: 'sparkles',
        },
        {
          id: 'nav_templates',
          type: 'page',
          pageName: 'template_showcase',
          label: 'Page Templates',
          icon: 'layout-template',
        },
        {
          id: 'nav_help',
          type: 'page',
          pageName: 'showcase_help',
          label: 'Help & Resources',
          icon: 'help-circle',
        },
      ],
    })
  ],
  dashboards: [
    {
      type: 'dashboard' as const,
      name: 'showcase_dashboard',
      label: 'Platform Showcase',
      description: 'Demonstrating all dashboard widget types',
      widgets: [
        // --- KPI Row ---
        {
          id: 'ks_total_records',
          title: 'Total Records',
          type: 'metric',
          object: 'kitchen_sink',
          layout: { x: 0, y: 0, w: 1, h: 1 },
          options: {
            label: 'Total Records',
            value: '5',
            icon: 'Database',
          },
        },
        {
          id: 'ks_active_items',
          title: 'Active Items',
          type: 'metric',
          object: 'kitchen_sink',
          layout: { x: 1, y: 0, w: 1, h: 1 },
          options: {
            label: 'Active Items',
            value: '4',
            trend: { value: 80, direction: 'up', label: 'active rate' },
            icon: 'Activity',
          },
        },
        {
          id: 'ks_total_value',
          title: 'Total Value',
          type: 'metric',
          object: 'kitchen_sink',
          layout: { x: 2, y: 0, w: 1, h: 1 },
          options: {
            label: 'Total Value',
            value: '$22,500',
            trend: { value: 15, direction: 'up', label: 'this quarter' },
            icon: 'DollarSign',
          },
        },
        {
          id: 'ks_avg_rating',
          title: 'Avg Rating',
          type: 'metric',
          object: 'kitchen_sink',
          layout: { x: 3, y: 0, w: 1, h: 1 },
          options: {
            label: 'Avg Rating',
            value: '4.2',
            trend: { value: 0.3, direction: 'up', label: 'improvement' },
            icon: 'Star',
          },
        },

        // --- Charts Row ---
        {
          id: 'ks_records_by_category',
          title: 'Records by Category',
          type: 'donut',
          object: 'kitchen_sink',
          categoryField: 'category',
          valueField: 'count',
          aggregate: 'count',
          layout: { x: 0, y: 1, w: 2, h: 2 },
          options: {
            xField: 'category',
            yField: 'count',
            data: {
              provider: 'value',
              items: [
                { category: 'Option A', count: 2 },
                { category: 'Option B', count: 2 },
                { category: 'Option C', count: 1 },
              ],
            },
          },
        },
        {
          id: 'ks_value_distribution',
          title: 'Value Distribution',
          type: 'bar',
          object: 'kitchen_sink',
          categoryField: 'name',
          valueField: 'amount',
          aggregate: 'sum',
          layout: { x: 2, y: 1, w: 2, h: 2 },
          options: {
            xField: 'name',
            yField: 'amount',
            data: {
              provider: 'value',
              items: [
                { name: 'Alpha', amount: 1500 },
                { name: 'Beta', amount: 3200 },
                { name: 'Gamma', amount: 800 },
                { name: 'Delta', amount: 5000 },
                { name: 'Epsilon', amount: 12000 },
              ],
            },
          },
        },

        // --- Trend Row ---
        {
          id: 'ks_monthly_trend',
          title: 'Monthly Trend',
          type: 'area',
          object: 'kitchen_sink',
          categoryField: 'month',
          valueField: 'value',
          aggregate: 'sum',
          layout: { x: 0, y: 3, w: 4, h: 2 },
          options: {
            xField: 'month',
            yField: 'value',
            data: {
              provider: 'value',
              items: [
                { month: 'Jan', value: 3200 },
                { month: 'Feb', value: 4500 },
                { month: 'Mar', value: 4100 },
                { month: 'Apr', value: 5800 },
                { month: 'May', value: 6200 },
                { month: 'Jun', value: 7500 },
              ],
            },
          },
        },
      ],
    },
  ],
  pages: [
    // Template Showcase Page — demonstrates page templates
    {
      name: 'template_showcase',
      label: 'Page Templates',
      type: 'app',
      template: 'header-sidebar-main',
      regions: [
        {
          name: 'header',
          components: [
            {
              type: 'container',
              properties: {
                className: 'bg-muted/30 rounded-lg p-6 border',
                children: [
                  { type: 'text', properties: { value: '📐 Page Template Showcase', className: 'text-2xl font-bold mb-2 block' } },
                  { type: 'text', properties: { value: 'This page uses the "header-sidebar-main" template — a full-width header with sidebar + main content below.', className: 'text-muted-foreground block' } },
                ],
              },
            },
          ],
        },
        {
          name: 'sidebar',
          width: 'medium',
          components: [
            {
              type: 'container',
              properties: {
                className: 'bg-card rounded-lg p-4 border space-y-3',
                children: [
                  { type: 'text', properties: { value: '🧭 Available Templates', className: 'font-semibold mb-3 block' } },
                  { type: 'text', properties: { value: '• **default** — Full-width single column', className: 'text-sm block' } },
                  { type: 'text', properties: { value: '• **header-sidebar-main** — Header + sidebar/main (this page)', className: 'text-sm block' } },
                  { type: 'text', properties: { value: '• **three-column** — Sidebar + main + aside', className: 'text-sm block' } },
                  { type: 'text', properties: { value: '• **dashboard** — 2-column grid layout', className: 'text-sm block' } },
                ],
              },
            },
            {
              type: 'container',
              properties: {
                className: 'bg-card rounded-lg p-4 border space-y-3 mt-4',
                children: [
                  { type: 'text', properties: { value: '🔧 New Features', className: 'font-semibold mb-3 block' } },
                  { type: 'text', properties: { value: '✅ **dependsOn** — Fields shown when parent has a value', className: 'text-sm block' } },
                  { type: 'text', properties: { value: '✅ **visibleOn** — Fields shown based on expression', className: 'text-sm block' } },
                  { type: 'text', properties: { value: '✅ **ActionParams** — Parameter dialog before actions', className: 'text-sm block' } },
                  { type: 'text', properties: { value: '✅ **Page Templates** — Predefined page layouts', className: 'text-sm block' } },
                ],
              },
            },
          ],
        },
        {
          name: 'main',
          components: [
            {
              type: 'container',
              properties: {
                className: 'space-y-6',
                children: [
                  {
                    type: 'container',
                    properties: {
                      className: 'bg-card rounded-lg p-6 border',
                      children: [
                        { type: 'text', properties: { value: '## FormField.dependsOn', className: 'text-xl font-semibold mb-3 block' } },
                        { type: 'text', properties: { value: 'Fields with `dependsOn` are only shown when the parent field has a value. For example, "Sub-Category" depends on "Category" — it only appears after a category is selected.', className: 'text-muted-foreground mb-3 block' } },
                        { type: 'text', properties: { value: '```typescript\n{ field: "sub_category", dependsOn: "category" }\n```', className: 'font-mono text-sm bg-muted/50 p-3 rounded block' } },
                      ],
                    },
                  },
                  {
                    type: 'container',
                    properties: {
                      className: 'bg-card rounded-lg p-6 border',
                      children: [
                        { type: 'text', properties: { value: '## FormField.visibleOn', className: 'text-xl font-semibold mb-3 block' } },
                        { type: 'text', properties: { value: 'Fields with `visibleOn` are shown/hidden based on a dynamic expression. For example, pricing fields only appear when status is "active" or "review".', className: 'text-muted-foreground mb-3 block' } },
                        { type: 'text', properties: { value: '```typescript\n{ field: "price", visibleOn: "${data.status === \'active\'}" }\n```', className: 'font-mono text-sm bg-muted/50 p-3 rounded block' } },
                      ],
                    },
                  },
                  {
                    type: 'container',
                    properties: {
                      className: 'bg-card rounded-lg p-6 border',
                      children: [
                        { type: 'text', properties: { value: '## ActionParam Collection', className: 'text-xl font-semibold mb-3 block' } },
                        { type: 'text', properties: { value: 'Actions can define `params` to collect from the user before execution. A dialog with form fields is shown automatically. Supports text, number, boolean, select, date, and textarea inputs.', className: 'text-muted-foreground mb-3 block' } },
                        { type: 'text', properties: { value: '```typescript\nactions: [{\n  name: "assign_owner",\n  type: "api",\n  params: [\n    { name: "owner_email", label: "Email", type: "text", required: true },\n    { name: "notify", label: "Notify", type: "boolean", defaultValue: true }\n  ]\n}]\n```', className: 'font-mono text-sm bg-muted/50 p-3 rounded block' } },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    // Help page
    {
      name: 'showcase_help',
      label: 'Help & Resources',
      type: 'app',
      regions: [
        {
          name: 'main',
          components: [
            {
              type: 'container',
              properties: {
                className: 'prose max-w-3xl mx-auto p-8 text-foreground',
                children: [
                  { type: 'text', properties: { value: '# Platform Showcase', className: 'text-3xl font-bold mb-6 block' } },
                  { type: 'text', properties: { value: 'This app demonstrates the full range of ObjectStack capabilities — all field types, dashboard widgets, page layouts, conditional forms, and action parameters.', className: 'text-muted-foreground mb-6 block' } },
                  { type: 'text', properties: { value: '## Supported Field Types', className: 'text-xl font-semibold mb-3 block' } },
                  { type: 'text', properties: { value: '- **Text** — Text, Textarea, Code, Password, Rich Text\n- **Number** — Integer, Currency, Percentage, Rating\n- **Date** — Date, DateTime\n- **Selection** — Select (single), Multi-Select\n- **Contact** — Email, URL, Phone\n- **Media** — Image, File, Avatar, Signature\n- **Special** — Boolean, Color, Location, Formula, Auto Number\n- **Relations** — Lookup (references other objects)', className: 'whitespace-pre-line mb-6 block' } },
                  { type: 'text', properties: { value: '## Dashboard Widgets', className: 'text-xl font-semibold mb-3 block' } },
                  { type: 'text', properties: { value: '- **Metric** — KPI cards with trends\n- **Bar Chart** — Categorical comparisons\n- **Donut Chart** — Proportional breakdowns\n- **Area Chart** — Time-series trends\n- **Line Chart** — Multi-series trends\n- **Table** — Tabular data summaries', className: 'whitespace-pre-line mb-6 block' } },
                  { type: 'text', properties: { value: '## New Features', className: 'text-xl font-semibold mb-3 block' } },
                  { type: 'text', properties: { value: '- **FormField.dependsOn** — Conditional field visibility based on parent field value\n- **FormField.visibleOn** — Expression-based field visibility\n- **ActionParam UI** — Parameter collection dialog before action execution\n- **Page Templates** — Predefined page layout templates (default, header-sidebar-main, three-column, dashboard)', className: 'whitespace-pre-line mb-6 block' } },
                  { type: 'text', properties: { value: '## View Types', className: 'text-xl font-semibold mb-3 block' } },
                  { type: 'text', properties: { value: '- **Grid** — Default tabular view with sort, filter, search\n- **Kanban** — Card board grouped by any select field\n- **Calendar** — Date-based event visualization\n- **Gantt** — Project timeline with dependencies\n- **Timeline** — Chronological activity stream\n- **Map** — Geographic data on interactive map\n- **Gallery** — Visual card grid layout', className: 'whitespace-pre-line block' } },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
  manifest: {
    id: 'com.example.kitchen-sink',
    version: '1.0.0',
    type: 'app',
    name: 'Platform Showcase',
    description: 'Demonstrates all field types, views, dashboard widgets, conditional forms, actions, and page templates',
    data: [
      {
        object: 'kitchen_sink',
        mode: 'upsert',
        records: [
          {
            name: 'Alpha Configuration',
            description: 'Primary system settings panel for environment management',
            amount: 1500,
            price: 29.99,
            percent: 75.5,
            rating: 4,
            due_date: daysFromNow(10),
            event_time: daysFromNow(10),
            is_active: true,
            category: 'opt_a',
            tags: ['col_red', 'col_blue'],
            email: 'alpha@example.com',
            url: 'https://alpha.example.com',
            phone: '+1-555-0101',
            color: '#3B82F6',
          },
          {
            name: 'Beta Dashboard',
            description: 'Real-time monitoring interface with live metrics',
            amount: 3200,
            price: 149.99,
            percent: 42.0,
            rating: 5,
            due_date: daysFromNow(20),
            event_time: daysFromNow(20),
            is_active: true,
            category: 'opt_b',
            tags: ['col_green'],
            email: 'beta@example.com',
            url: 'https://beta.example.com',
            phone: '+1-555-0202',
            color: '#10B981',
          },
          {
            name: 'Gamma Report Engine',
            description: 'Automated report generation and distribution system',
            amount: 800,
            price: 49.99,
            percent: 90.25,
            rating: 3,
            due_date: daysFromNow(30),
            is_active: false,
            category: 'opt_c',
            tags: ['col_red', 'col_green', 'col_blue'],
            email: 'gamma@example.com',
            url: 'https://gamma.example.com',
            phone: '+1-555-0303',
            color: '#F59E0B',
          },
          {
            name: 'Delta API Gateway',
            description: 'Central API routing with rate limiting and auth',
            amount: 5000,
            price: 299.0,
            percent: 15.8,
            rating: 5,
            due_date: daysFromNow(-5),
            event_time: daysFromNow(-5),
            is_active: true,
            category: 'opt_a',
            email: 'delta@example.com',
            url: 'https://delta.example.com',
            phone: '+1-555-0404',
            color: '#EF4444',
          },
          {
            name: 'Epsilon ML Pipeline',
            description: 'Machine learning data processing and model training flow',
            amount: 12000,
            price: 599.99,
            percent: 60.0,
            rating: 4,
            due_date: daysFromNow(45),
            is_active: true,
            category: 'opt_b',
            tags: ['col_blue'],
            email: 'epsilon@example.com',
            url: 'https://epsilon.example.com',
            phone: '+1-555-0505',
            color: '#8B5CF6',
          },
        ],
      },
      {
        object: 'showcase',
        mode: 'upsert',
        records: [
          {
            title: 'Cloud Infrastructure Setup',
            description: 'Setting up cloud infrastructure for production deployment',
            category: 'software',
            sub_category: 'web_app',
            priority: 'high',
            status: 'active',
            price: 4500,
            discount_percent: 10,
            start_date: daysFromNow(-10),
            end_date: daysFromNow(30),
            owner_email: 'alice@example.com',
            is_featured: true,
            tags: ['new', 'premium'],
          },
          {
            title: 'Server Rack Procurement',
            description: 'Purchasing new server racks for data center expansion',
            category: 'hardware',
            sub_category: 'server',
            priority: 'medium',
            status: 'review',
            price: 12000,
            discount_percent: 5,
            start_date: daysFromNow(-5),
            end_date: daysFromNow(60),
            owner_email: 'bob@example.com',
            is_featured: false,
            tags: ['popular'],
          },
          {
            title: 'Security Consulting',
            description: 'Annual security audit and consulting engagement',
            category: 'service',
            sub_category: 'consulting',
            priority: 'critical',
            status: 'active',
            price: 8000,
            start_date: daysFromNow(0),
            end_date: daysFromNow(90),
            owner_email: 'carol@example.com',
            is_featured: true,
            tags: ['premium'],
          },
          {
            title: 'Mobile App Redesign',
            description: 'Redesigning the mobile application with new UX patterns',
            category: 'software',
            sub_category: 'mobile_app',
            priority: 'high',
            status: 'draft',
            start_date: daysFromNow(15),
            owner_email: 'dave@example.com',
            is_featured: false,
            tags: ['new'],
          },
          {
            title: 'Laptop Refresh Program',
            description: 'Annual laptop replacement for engineering team',
            category: 'hardware',
            sub_category: 'laptop',
            priority: 'low',
            status: 'completed',
            price: 25000,
            discount_percent: 15,
            start_date: daysFromNow(-60),
            end_date: daysFromNow(-5),
            owner_email: 'eve@example.com',
            is_featured: false,
            tags: ['sale'],
          },
          {
            title: 'Team Training Workshop',
            description: 'Advanced TypeScript and React training for the team',
            category: 'service',
            sub_category: 'training',
            priority: 'medium',
            status: 'active',
            price: 3000,
            start_date: daysFromNow(20),
            end_date: daysFromNow(22),
            owner_email: 'frank@example.com',
            is_featured: true,
            tags: ['popular', 'new'],
          },
        ],
      },
    ],
  },
});
