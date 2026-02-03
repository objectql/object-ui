import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Templates/Reports',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const ReportViewer: Story = {
  render: renderStory,
  args: {
    type: 'report-viewer',
    report: {
      type: 'report',
      title: 'Quarterly Sales Report',
      description: 'Sales performance analysis for Q1 2024',
      fields: [
        { name: 'region', label: 'Region', type: 'string' },
        { name: 'revenue', label: 'Revenue', type: 'number', aggregation: 'sum', showInSummary: true },
        { name: 'units', label: 'Units Sold', type: 'number', aggregation: 'sum', showInSummary: true }
      ],
      sections: [
        {
          type: 'header',
          title: 'Executive Summary'
        },
        {
          type: 'summary',
          title: 'Key Metrics'
        },
        {
          type: 'chart',
          title: 'Revenue by Region',
          chart: {
            type: 'chart',
            chartType: 'bar',
            data: [
              { region: 'North', revenue: 45000 },
              { region: 'South', revenue: 32000 },
              { region: 'East', revenue: 38000 },
              { region: 'West', revenue: 41000 },
            ],
            xAxisKey: 'region',
            series: [{ dataKey: 'revenue' }],
            config: {
              revenue: { label: 'Revenue', color: '#3b82f6' }
            }
          }
        },
        {
          type: 'table',
          title: 'Detailed Breakdown',
          columns: [
            { name: 'region', label: 'Region' },
            { name: 'revenue', label: 'Revenue' },
            { name: 'units', label: 'Units Sold' }
          ]
        }
      ],
      showExportButtons: true
    },
    data: [
      { region: 'North', revenue: 45000, units: 1200 },
      { region: 'South', revenue: 32000, units: 850 },
      { region: 'East', revenue: 38000, units: 1050 },
      { region: 'West', revenue: 41000, units: 1100 },
    ],
    showToolbar: true,
    allowExport: true,
    allowPrint: true
  } as any,
};

export const ReportViewerMinimal: Story = {
  render: renderStory,
  args: {
    type: 'report-viewer',
    report: {
      type: 'report',
      title: 'Simple Report',
      description: 'Basic report without sections',
      fields: [
        { name: 'product', label: 'Product' },
        { name: 'sales', label: 'Sales' },
      ],
    },
    data: [
      { product: 'Widget A', sales: 1200 },
      { product: 'Widget B', sales: 850 },
      { product: 'Widget C', sales: 1450 },
    ],
    showToolbar: false,
  } as any,
};

export const ReportBuilder: Story = {
  render: renderStory,
  args: {
    type: 'report-builder',
    availableFields: [
      { name: 'revenue', label: 'Revenue', type: 'number' },
      { name: 'units', label: 'Units Sold', type: 'number' },
      { name: 'region', label: 'Region', type: 'string' },
      { name: 'product', label: 'Product', type: 'string' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'customer', label: 'Customer', type: 'string' }
    ],
    showPreview: true,
    onSave: 'handleSaveReport',
    onCancel: 'handleCancel'
  } as any,
};

export const ReportBuilderWithInitialConfig: Story = {
  render: renderStory,
  args: {
    type: 'report-builder',
    report: {
      type: 'report',
      title: 'Monthly Sales Report',
      description: 'Sales performance tracking by region',
      fields: [
        { name: 'revenue', label: 'Revenue', type: 'number', aggregation: 'sum', showInSummary: true },
        { name: 'units', label: 'Units Sold', type: 'number', aggregation: 'count', showInSummary: true },
        { name: 'region', label: 'Region', type: 'string' }
      ],
      filters: [
        { field: 'date', operator: 'greater_than', value: '2024-01-01' }
      ],
      groupBy: [
        { field: 'region', sort: 'asc' }
      ],
      sections: [
        { type: 'header', title: 'Executive Summary' },
        { type: 'summary', title: 'Key Metrics' },
        { type: 'table', title: 'Detailed Data' }
      ],
      showExportButtons: true,
      defaultExportFormat: 'pdf'
    },
    availableFields: [
      { name: 'revenue', label: 'Revenue', type: 'number' },
      { name: 'units', label: 'Units Sold', type: 'number' },
      { name: 'region', label: 'Region', type: 'string' },
      { name: 'product', label: 'Product', type: 'string' },
      { name: 'date', label: 'Date', type: 'date' }
    ],
    showPreview: true,
  } as any,
};
