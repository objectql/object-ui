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
    },
    {
      name: 'report_page',
      label: 'Monthly Report',
      type: 'app',
      regions: [
        {
          name: 'main',
          components: [
            {
              type: 'report',
              properties: {
                title: 'Sales Performance Report',
                description: 'Monthly breakdown of sales by region',
                className: 'p-6',
                data: [
                    { region: 'North', sales: 5000, target: 4500 },
                    { region: 'South', sales: 3000, target: 3200 },
                    { region: 'East', sales: 4200, target: 4000 },
                    { region: 'West', sales: 6100, target: 5000 },
                ],
                columns: [
                    { field: 'region', headerName: 'Region' },
                    { field: 'sales', headerName: 'Sales' },
                    { field: 'target', headerName: 'Target' }
                ],
                chart: {
                    type: 'bar',
                    xAxisKey: 'region',
                    series: [{ dataKey: 'sales' }]
                }
              }
            }
          ]
        }
      ]
    },
    {
      name: 'kanban_test',
      label: 'Kanban Test',
      type: 'app',
      regions: [
        {
          name: 'main',
          components: [
            {
              type: 'kanban',
              properties: {
                objectName: 'project_task',
                groupBy: 'status',
                columns: [
                  { 
                    id: 'todo', 
                    title: 'To Do', 
                    cards: [] 
                  },
                  { 
                    id: 'in_progress', 
                    title: 'In Progress', 
                    limit: 3, 
                    cards: [] 
                  },
                  { 
                    id: 'done', 
                    title: 'Done', 
                    cards: [] 
                  }
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
