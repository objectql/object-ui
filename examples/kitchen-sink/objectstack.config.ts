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
      name: 'analytics_app',
      label: 'Analytics',
      icon: 'bar-chart-2',
      navigation: [
        {
          id: 'nav_dash',
          type: 'dashboard',
          dashboardName: 'sales_dashboard',
          label: 'Sales Overview'
        },
        {
          id: 'nav_help',
          type: 'page',
          pageName: 'help_page',
          label: 'Help & Resources'
        }
      ]
    })
  ],
  dashboards: [
    {
      name: 'sales_dashboard',
      label: 'Sales Overview',
      description: 'Quarterly sales performance',
      widgets: [
        {
          title: 'Sales by Region',
          type: 'bar',
          layout: { x: 0, y: 1, w: 2, h: 2 },
          options: {
            height: 300,
            xField: 'name',
            yField: 'value',
            data: [
              { name: 'North', value: 4000 },
              { name: 'South', value: 3000 },
              { name: 'East', value: 2000 },
              { name: 'West', value: 2780 },
            ]
          }
        },
        {
            title: 'Revenue',
            type: 'bar', // Using bar as placeholder for stats since 'card' might not be valid
            layout: { x: 0, y: 0, w: 1, h: 1 },
            options: {
                data: [{ name: 'Rev', value: 1200000 }],
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
      type: 'app',
      regions: [
        {
          name: 'main',
          components: [
            {
              type: 'container',
              properties: {
                className: 'prose max-w-none p-6 text-foreground bg-card rounded-lg border shadow-sm',
                children: [
                    { type: 'text', properties: { value: '# Application Guide', className: 'text-3xl font-bold mb-4 block' } },
                    { type: 'text', properties: { value: 'Welcome to the ObjectStack Console.', className: 'mb-4 block' } },
                    { type: 'text', properties: { value: '## Features', className: 'text-xl font-bold mb-2 block' } },
                    { type: 'text', properties: { value: '- Dynamic Object CRUD\n- Server-Driven Dashboards\n- Flexible Page Layouts', className: 'whitespace-pre-line block' } },
                    { type: 'text', properties: { value: '## Getting Started', className: 'text-xl font-bold mb-2 block mt-6' } },
                    { type: 'text', properties: { value: 'Navigate using the sidebar to explore different apps and objects.', className: 'mb-4 block' } }
                ]
               }
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
    description: 'Kitchen Sink Example App',
    data: []
  }
});
