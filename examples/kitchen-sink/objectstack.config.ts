import { defineStack } from '@objectstack/spec';
import { App } from '@objectstack/spec/ui';
import { KitchenSinkObject } from './src/objects/kitchen_sink.object';
import { AccountObject } from './src/objects/account.object';

export default defineStack({
  objects: [
    KitchenSinkObject,
    AccountObject
  ],
  apps: [
    App.create({
      name: 'kitchen_sink_app',
      label: 'Kitchen Sink',
      icon: 'layout',
      navigation: [
        {
          id: 'nav_kitchen',
          type: 'object',
          objectName: 'kitchen_sink',
          label: 'Components'
        },
        {
          id: 'nav_account',
          type: 'object',
          objectName: 'account',
          label: 'Reference Accounts'
        }
      ]
    }),
    {
      name: 'analytics',
      label: 'Analytics',
      icon: 'activity', 
      description: 'Business Intelligence Simulation',
      navigation: [
          {
              id: 'group_dashboards',
              type: 'group',
              label: 'Dashboards', 
              children: [
                  { id: 'nav_sales_dashboard', type: 'dashboard', dashboardName: 'sales_dashboard', label: 'Sales Overview' }
              ]
          },
          {
              id: 'group_pages',
              type: 'group',
              label: 'Pages',
              children: [
                  { id: 'nav_help_page', type: 'page', pageName: 'help_page', label: 'Help Guide' }
              ]
          }
      ]
    }
  ],
  dashboards: [
    {
      name: 'sales_dashboard',
      label: 'Sales Overview',
      description: 'Quarterly sales performance',
      columns: 4,
      widgets: [
          {
              id: 'w1',
              title: 'Total Revenue',
              layout: { x: 0, y: 0, w: 1, h: 1 },
              component: {
                  type: 'card', 
                  className: 'h-full flex flex-col justify-center items-center',
                  children: [
                      { type: 'text', content: '$1.2M', className: 'text-2xl font-bold' },
                      { type: 'text', content: '+12% from last month', className: 'text-xs text-green-500' }
                  ]
              }
          },
          {
              id: 'w2',
              title: 'Active Users',
              layout: { x: 1, y: 0, w: 1, h: 1 },
              component: {
                  type: 'card', 
                  className: 'h-full flex flex-col justify-center items-center',
                  children: [
                      { type: 'text', content: '3,450', className: 'text-2xl font-bold' },
                      { type: 'text', content: '+5% new users', className: 'text-xs text-blue-500' }
                  ]
              }
          },
          {
              id: 'w3',
              title: 'Sales by Region',
              layout: { x: 0, y: 1, w: 2, h: 2 },
              component: {
                  type: 'chart',
                  chartType: 'bar',
                  height: 300,
                  data: [
                      { name: 'North', value: 4000 },
                      { name: 'South', value: 3000 },
                      { name: 'East', value: 2000 },
                      { name: 'West', value: 2780 },
                  ],
                  xField: 'name',
                  yField: 'value'
              }
          }
      ]
    }
  ],
  pages: [
    {
      name: 'help_page',
      label: 'Help Guide',
      type: 'utility',
      regions: [
        {
          name: 'main',
          components: [
            {
              type: 'container',
              properties: {
                className: 'prose max-w-none p-6 text-foreground bg-card rounded-lg border shadow-sm',
              },
              children: [
                  { type: 'text', properties: { content: '# Application Guide', className: 'text-3xl font-bold mb-4 block' } },
                  { type: 'text', properties: { content: 'Welcome to the ObjectStack Console.', className: 'mb-4 block' } },
                  { type: 'text', properties: { content: '## Features', className: 'text-xl font-bold mb-2 block' } },
                  { type: 'text', properties: { content: '- Dynamic Object CRUD\n- Server-Driven Dashboards\n- Flexible Page Layouts', className: 'whitespace-pre-line block' } },
                  { type: 'text', properties: { content: '## Getting Started', className: 'text-xl font-bold mb-2 block mt-6' } },
                  { type: 'text', properties: { content: 'Navigate using the sidebar to explore different apps and objects.', className: 'mb-4 block' } }
              ]
            }
          ]
        }
      ]
    }
  ],
  manifest: {
    id: 'com.example.kitchen-sink',
    version: '1.0.0',
    type: 'app',
    name: 'Kitchen Sink',
    description: 'Component Testing App',
    data: [
      {
        object: 'account',
        mode: 'upsert',
        records: [
          { _id: "1", name: "TechCorp" },
          { _id: "2", name: "Software Inc" }
        ]
      },
      {
        object: 'kitchen_sink',
        mode: 'upsert',
        records: [
          {
            _id: "1001",
            name: "Full Feature Test",
            description: "This record has every field populated.",
            amount: 42,
            active: true,
            status: "active",
            start_date: "2024-01-01",
            priority: 5,
            metadata: { complexity: "high" },
            tags: ["test", "demo"]
          },
          {
            _id: "1002",
            name: "Empty Test",
            description: null,
            amount: null,
            active: false,
            status: "pending"
          }
        ]
      }
    ]
  }
});
