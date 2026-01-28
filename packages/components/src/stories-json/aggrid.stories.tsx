import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'JSON/Plugins/AG Grid',
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

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'aggrid',
    rowData: [
      { make: 'Tesla', model: 'Model Y', price: 64950, electric: true },
      { make: 'Ford', model: 'F-Series', price: 33850, electric: false },
      { make: 'Toyota', model: 'Corolla', price: 29600, electric: false },
      { make: 'Mercedes', model: 'EQA', price: 48890, electric: true },
      { make: 'Fiat', model: '500', price: 15774, electric: false },
      { make: 'Nissan', model: 'Juke', price: 20675, electric: false },
      { make: 'Vauxhall', model: 'Corsa', price: 18460, electric: false },
      { make: 'Volvo', model: 'XC90', price: 72835, electric: false },
      { make: 'Mercedes', model: 'GLA', price: 47825, electric: false },
      { make: 'Ford', model: 'Puma', price: 27420, electric: false },
      { make: 'Volkswagen', model: 'Golf', price: 28850, electric: false },
      { make: 'Kia', model: 'Sportage', price: 31095, electric: false }
    ],
    columnDefs: [
      { field: 'make', headerName: 'Make', sortable: true, filter: true },
      { field: 'model', headerName: 'Model', sortable: true, filter: true },
      { field: 'price', headerName: 'Price', sortable: true, filter: 'agNumberColumnFilter' },
      { field: 'electric', headerName: 'Electric', sortable: true, filter: true }
    ],
    pagination: true,
    paginationPageSize: 10,
    theme: 'quartz',
    height: 500,
    animateRows: true
  } as any,
};

export const WithPagination: Story = {
  render: renderStory,
  args: {
    type: 'aggrid',
    rowData: [
      { athlete: 'Michael Phelps', age: 23, country: 'United States', year: 2008, sport: 'Swimming', gold: 8, silver: 0, bronze: 0 },
      { athlete: 'Natalie Coughlin', age: 25, country: 'United States', year: 2008, sport: 'Swimming', gold: 1, silver: 2, bronze: 3 },
      { athlete: 'Aleksey Nemov', age: 24, country: 'Russia', year: 2000, sport: 'Gymnastics', gold: 2, silver: 1, bronze: 3 },
      { athlete: 'Alicia Coutts', age: 24, country: 'Australia', year: 2012, sport: 'Swimming', gold: 1, silver: 3, bronze: 1 },
      { athlete: 'Missy Franklin', age: 17, country: 'United States', year: 2012, sport: 'Swimming', gold: 4, silver: 0, bronze: 1 },
    ],
    columnDefs: [
      { field: 'athlete', headerName: 'Athlete' },
      { field: 'age', headerName: 'Age', width: 90 },
      { field: 'country', headerName: 'Country', width: 120 },
      { field: 'year', headerName: 'Year', width: 90 },
      { field: 'sport', headerName: 'Sport', width: 110 },
      { field: 'gold', headerName: 'Gold', width: 100 },
      { field: 'silver', headerName: 'Silver', width: 100 },
      { field: 'bronze', headerName: 'Bronze', width: 100 }
    ],
    pagination: true,
    paginationPageSize: 3,
    theme: 'quartz',
    height: 400
  } as any,
};

export const AlpineTheme: Story = {
  render: renderStory,
  args: {
    type: 'aggrid',
    rowData: [
      { product: 'Laptop', category: 'Electronics', price: 1200, stock: 15 },
      { product: 'Mouse', category: 'Electronics', price: 25, stock: 150 },
      { product: 'Keyboard', category: 'Electronics', price: 75, stock: 80 },
      { product: 'Monitor', category: 'Electronics', price: 300, stock: 45 },
      { product: 'Desk', category: 'Furniture', price: 250, stock: 20 }
    ],
    columnDefs: [
      { field: 'product', headerName: 'Product', sortable: true, filter: true },
      { field: 'category', headerName: 'Category', sortable: true, filter: true },
      { field: 'price', headerName: 'Price ($)', sortable: true, filter: 'agNumberColumnFilter' },
      { field: 'stock', headerName: 'Stock', sortable: true, filter: 'agNumberColumnFilter' }
    ],
    theme: 'alpine',
    height: 400,
    domLayout: 'autoHeight'
  } as any,
};
