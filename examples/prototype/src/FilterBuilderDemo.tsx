import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';

const filterBuilderSchema = {
  type: 'div',
  className: 'min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8',
  body: [
    {
      type: 'div',
      className: 'max-w-5xl mx-auto space-y-8',
      body: [
        // Header
        {
          type: 'div',
          className: 'space-y-2',
          body: [
            {
              type: 'div',
              className: 'text-3xl font-bold tracking-tight',
              body: { type: 'text', content: 'Filter Builder Demo' }
            },
            {
              type: 'div',
              className: 'text-muted-foreground',
              body: { 
                type: 'text', 
                content: 'Airtable-like filter component with advanced field types and operators' 
              }
            }
          ]
        },

        // Example 1: User Data Filtering with Date and Select
        {
          type: 'card',
          className: 'shadow-lg',
          body: [
            {
              type: 'div',
              className: 'p-6 border-b',
              body: [
                {
                  type: 'div',
                  className: 'text-xl font-semibold',
                  body: { type: 'text', content: 'User Data Filters' }
                },
                {
                  type: 'div',
                  className: 'text-sm text-muted-foreground mt-1',
                  body: { 
                    type: 'text', 
                    content: 'Advanced filtering with date, select, and boolean fields' 
                  }
                }
              ]
            },
            {
              type: 'div',
              className: 'p-6',
              body: {
                type: 'filter-builder',
                name: 'userFilters',
                label: 'User Filters',
                fields: [
                  { value: 'name', label: 'Name', type: 'text' },
                  { value: 'email', label: 'Email', type: 'text' },
                  { value: 'age', label: 'Age', type: 'number' },
                  { 
                    value: 'status', 
                    label: 'Status', 
                    type: 'select',
                    options: [
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'pending', label: 'Pending' }
                    ]
                  },
                  { 
                    value: 'department', 
                    label: 'Department', 
                    type: 'select',
                    options: [
                      { value: 'engineering', label: 'Engineering' },
                      { value: 'sales', label: 'Sales' },
                      { value: 'marketing', label: 'Marketing' },
                      { value: 'support', label: 'Support' }
                    ]
                  },
                  { value: 'joinDate', label: 'Join Date', type: 'date' },
                  { value: 'isVerified', label: 'Is Verified', type: 'boolean' }
                ],
                value: {
                  id: 'root',
                  logic: 'and',
                  conditions: [
                    {
                      id: 'cond-1',
                      field: 'status',
                      operator: 'equals',
                      value: 'active'
                    }
                  ]
                }
              }
            }
          ]
        },
        {
          type: 'card',
          className: 'shadow-lg',
          body: [
            {
              type: 'div',
              className: 'p-6 border-b',
              body: [
                {
                  type: 'div',
                  className: 'text-xl font-semibold',
                  body: { type: 'text', content: 'Product Filters' }
                },
                {
                  type: 'div',
                  className: 'text-sm text-muted-foreground mt-1',
                  body: { 
                    type: 'text', 
                    content: 'Filter products by name, price, category, and stock' 
                  }
                }
              ]
            },
            {
              type: 'div',
              className: 'p-6',
              body: {
                type: 'filter-builder',
                name: 'productFilters',
                label: 'Product Filters',
                fields: [
                  { value: 'name', label: 'Product Name', type: 'text' },
                  { value: 'price', label: 'Price', type: 'number' },
                  { value: 'category', label: 'Category', type: 'text' },
                  { value: 'stock', label: 'Stock Quantity', type: 'number' },
                  { value: 'brand', label: 'Brand', type: 'text' },
                  { value: 'rating', label: 'Rating', type: 'number' }
                ],
                value: {
                  id: 'root',
                  logic: 'or',
                  conditions: [
                    {
                      id: 'cond-1',
                      field: 'price',
                      operator: 'lessThan',
                      value: '100'
                    },
                    {
                      id: 'cond-2',
                      field: 'category',
                      operator: 'equals',
                      value: 'Electronics'
                    }
                  ]
                }
              }
            }
          ]
        },

        // Example 3: Empty Filter Builder
        {
          type: 'card',
          className: 'shadow-lg',
          body: [
            {
              type: 'div',
              className: 'p-6 border-b',
              body: [
                {
                  type: 'div',
                  className: 'text-xl font-semibold',
                  body: { type: 'text', content: 'Order Filters' }
                },
                {
                  type: 'div',
                  className: 'text-sm text-muted-foreground mt-1',
                  body: { 
                    type: 'text', 
                    content: 'Start with an empty filter - try adding conditions!' 
                  }
                }
              ]
            },
            {
              type: 'div',
              className: 'p-6',
              body: {
                type: 'filter-builder',
                name: 'orderFilters',
                label: 'Order Filters',
                fields: [
                  { value: 'orderId', label: 'Order ID', type: 'text' },
                  { value: 'customer', label: 'Customer Name', type: 'text' },
                  { value: 'total', label: 'Total Amount', type: 'number' },
                  { value: 'status', label: 'Order Status', type: 'text' },
                  { value: 'date', label: 'Order Date', type: 'text' },
                  { value: 'shipped', label: 'Shipped', type: 'boolean' }
                ],
                value: {
                  id: 'root',
                  logic: 'and',
                  conditions: []
                }
              }
            }
          ]
        },

        // Features section
        {
          type: 'card',
          className: 'shadow-lg bg-primary/5 border-primary/20',
          body: {
            type: 'div',
            className: 'p-6',
            body: [
              {
                type: 'div',
                className: 'text-lg font-semibold mb-4',
                body: { type: 'text', content: '✨ Features' }
              },
              {
                type: 'div',
                className: 'grid md:grid-cols-2 gap-4 text-sm',
                body: [
                  {
                    type: 'div',
                    className: 'flex items-start gap-2',
                    body: [
                      { type: 'div', body: { type: 'text', content: '✓' }, className: 'text-primary font-bold' },
                      { type: 'div', body: { type: 'text', content: 'Dynamic add/remove filter conditions' } }
                    ]
                  },
                  {
                    type: 'div',
                    className: 'flex items-start gap-2',
                    body: [
                      { type: 'div', body: { type: 'text', content: '✓' }, className: 'text-primary font-bold' },
                      { type: 'div', body: { type: 'text', content: 'Field-type aware operators' } }
                    ]
                  },
                  {
                    type: 'div',
                    className: 'flex items-start gap-2',
                    body: [
                      { type: 'div', body: { type: 'text', content: '✓' }, className: 'text-primary font-bold' },
                      { type: 'div', body: { type: 'text', content: 'AND/OR logic toggling' } }
                    ]
                  },
                  {
                    type: 'div',
                    className: 'flex items-start gap-2',
                    body: [
                      { type: 'div', body: { type: 'text', content: '✓' }, className: 'text-primary font-bold' },
                      { type: 'div', body: { type: 'text', content: 'Date & Select field support' } }
                    ]
                  },
                  {
                    type: 'div',
                    className: 'flex items-start gap-2',
                    body: [
                      { type: 'div', body: { type: 'text', content: '✓' }, className: 'text-primary font-bold' },
                      { type: 'div', body: { type: 'text', content: 'Clear all filters button' } }
                    ]
                  },
                  {
                    type: 'div',
                    className: 'flex items-start gap-2',
                    body: [
                      { type: 'div', body: { type: 'text', content: '✓' }, className: 'text-primary font-bold' },
                      { type: 'div', body: { type: 'text', content: 'Tailwind CSS styled' } }
                    ]
                  },
                  {
                    type: 'div',
                    className: 'flex items-start gap-2',
                    body: [
                      { type: 'div', body: { type: 'text', content: '✓' }, className: 'text-primary font-bold' },
                      { type: 'div', body: { type: 'text', content: 'Shadcn UI components' } }
                    ]
                  },
                  {
                    type: 'div',
                    className: 'flex items-start gap-2',
                    body: [
                      { type: 'div', body: { type: 'text', content: '✓' }, className: 'text-primary font-bold' },
                      { type: 'div', body: { type: 'text', content: 'Schema-driven configuration' } }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
};

function FilterBuilderDemo() {
  return (
    <SchemaRenderer 
      schema={filterBuilderSchema}
    />
  );
}

export default FilterBuilderDemo;
