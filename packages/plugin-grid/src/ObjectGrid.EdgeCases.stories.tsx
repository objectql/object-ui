import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import type { BaseSchema } from '@object-ui/types';
import { createStorybookDataSource } from '@storybook-config/datasource';

const meta = {
  title: 'Plugins/ObjectGrid/Edge Cases',
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

const dataSource = createStorybookDataSource();

const renderStory = (args: any) => (
  <SchemaRendererProvider dataSource={dataSource}>
    <SchemaRenderer schema={args as unknown as BaseSchema} />
  </SchemaRendererProvider>
);

// ── Empty Data ────────────────────────────────────────────────

export const EmptyData: Story = {
  name: 'Empty – No Rows',
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'Employee',
    columns: [
      { field: 'id', header: 'ID', width: 80 },
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email' },
      { field: 'department', header: 'Department' },
    ],
    data: [],
    pagination: false,
    className: 'w-full',
  } as any,
};

// ── Single Row ────────────────────────────────────────────────

export const SingleRow: Story = {
  name: 'Single Row',
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'Employee',
    columns: [
      { field: 'id', header: 'ID', width: 80 },
      { field: 'name', header: 'Name', sortable: true },
      { field: 'email', header: 'Email' },
      { field: 'department', header: 'Department' },
    ],
    data: [
      { id: 1, name: 'Alice Johnson', email: 'alice@example.com', department: 'Engineering' },
    ],
    pagination: false,
    className: 'w-full',
  } as any,
};

// ── Many Columns ──────────────────────────────────────────────

export const ManyColumns: Story = {
  name: 'Many Columns (15+)',
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'WideTable',
    columns: Array.from({ length: 18 }, (_, i) => ({
      field: `col${i + 1}`,
      header: `Column ${i + 1}`,
      sortable: i < 5,
    })),
    data: Array.from({ length: 5 }, (_, row) => {
      const record: Record<string, any> = {};
      for (let c = 1; c <= 18; c++) {
        record[`col${c}`] = `R${row + 1}-C${c}`;
      }
      return record;
    }),
    pagination: false,
    className: 'w-full',
  } as any,
};

// ── Very Long Cell Values ─────────────────────────────────────

const LONG_VALUE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

export const LongCellValues: Story = {
  name: 'Very Long Cell Values',
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'Article',
    columns: [
      { field: 'id', header: 'ID', width: 60 },
      { field: 'title', header: 'Title' },
      { field: 'abstract', header: 'Abstract' },
      { field: 'author', header: 'Author' },
    ],
    data: [
      { id: 1, title: LONG_VALUE, abstract: LONG_VALUE + ' ' + LONG_VALUE, author: 'Dr. Extremely Long Author Name The Third Junior' },
      { id: 2, title: 'Short', abstract: 'Brief.', author: 'Bob' },
      { id: 3, title: LONG_VALUE, abstract: LONG_VALUE, author: LONG_VALUE },
    ],
    pagination: false,
    className: 'w-full',
  } as any,
};

// ── Null / Undefined Values ───────────────────────────────────

export const NullAndUndefinedValues: Story = {
  name: 'Null / Undefined Cell Values',
  render: renderStory,
  args: {
    type: 'object-grid',
    objectName: 'Sparse',
    columns: [
      { field: 'id', header: 'ID', width: 60 },
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email' },
      { field: 'phone', header: 'Phone' },
      { field: 'notes', header: 'Notes' },
    ],
    data: [
      { id: 1, name: 'Alice', email: null, phone: undefined, notes: '' },
      { id: 2, name: null, email: 'bob@example.com', phone: null, notes: undefined },
      { id: 3, name: undefined, email: undefined, phone: undefined, notes: null },
      { id: 4, name: 'Dave', email: 'dave@example.com', phone: '+1-555-0100', notes: 'Complete record' },
    ],
    pagination: false,
    className: 'w-full',
  } as any,
};
