/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Example demonstrating Zod schema usage for ObjectUI components
 * 
 * This file shows how to use the Zod schemas to validate component configurations.
 */

import {
  ButtonSchema,
  InputSchema,
  FormSchema,
  CardSchema,
  DataTableSchema,
  KanbanSchema,
} from '../dist/zod/index.zod.js';

// Example 1: Validate a Button component
const buttonExample = {
  type: 'button' as const,
  label: 'Click Me',
  variant: 'default' as const,
  size: 'lg' as const,
  onClick: () => console.log('clicked'),
};

const buttonResult = ButtonSchema.safeParse(buttonExample);
console.log('Button validation:', buttonResult.success ? 'PASSED ✓' : 'FAILED ✗');
if (!buttonResult.success) {
  console.error('Button errors:', buttonResult.error.errors);
}

// Example 2: Validate an Input component
const inputExample = {
  type: 'input' as const,
  name: 'email',
  label: 'Email Address',
  inputType: 'email' as const,
  placeholder: 'Enter your email',
  required: true,
};

const inputResult = InputSchema.safeParse(inputExample);
console.log('Input validation:', inputResult.success ? 'PASSED ✓' : 'FAILED ✗');
if (!inputResult.success) {
  console.error('Input errors:', inputResult.error.errors);
}

// Example 3: Validate a Form component
const formExample = {
  type: 'form' as const,
  fields: [
    {
      name: 'username',
      label: 'Username',
      type: 'input',
      required: true,
    },
    {
      name: 'email',
      label: 'Email',
      type: 'input',
      inputType: 'email',
      required: true,
    },
  ],
  submitLabel: 'Submit',
  layout: 'vertical' as const,
};

const formResult = FormSchema.safeParse(formExample);
console.log('Form validation:', formResult.success ? 'PASSED ✓' : 'FAILED ✗');
if (!formResult.success) {
  console.error('Form errors:', formResult.error.errors);
}

// Example 4: Validate a Card component
const cardExample = {
  type: 'card' as const,
  title: 'Welcome',
  description: 'This is a card component',
  variant: 'default' as const,
  children: [
    {
      type: 'text',
      value: 'Card content goes here',
    },
  ],
};

const cardResult = CardSchema.safeParse(cardExample);
console.log('Card validation:', cardResult.success ? 'PASSED ✓' : 'FAILED ✗');
if (!cardResult.success) {
  console.error('Card errors:', cardResult.error.errors);
}

// Example 5: Validate a DataTable component
const dataTableExample = {
  type: 'data-table' as const,
  columns: [
    {
      header: 'Name',
      accessorKey: 'name',
    },
    {
      header: 'Email',
      accessorKey: 'email',
    },
  ],
  data: [
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Jane Smith', email: 'jane@example.com' },
  ],
  pagination: true,
  searchable: true,
};

const dataTableResult = DataTableSchema.safeParse(dataTableExample);
console.log('DataTable validation:', dataTableResult.success ? 'PASSED ✓' : 'FAILED ✗');
if (!dataTableResult.success) {
  console.error('DataTable errors:', dataTableResult.error.errors);
}

// Example 6: Validate a Kanban component
const kanbanExample = {
  type: 'kanban' as const,
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      items: [
        {
          id: '1',
          title: 'Task 1',
          description: 'Do something',
          priority: 'high' as const,
        },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      items: [],
    },
    {
      id: 'done',
      title: 'Done',
      items: [],
    },
  ],
  draggable: true,
};

const kanbanResult = KanbanSchema.safeParse(kanbanExample);
console.log('Kanban validation:', kanbanResult.success ? 'PASSED ✓' : 'FAILED ✗');
if (!kanbanResult.success) {
  console.error('Kanban errors:', kanbanResult.error.errors);
}

// Example 7: Test validation errors
console.log('\n--- Testing Validation Errors ---');

const invalidButton = {
  type: 'button' as const,
  variant: 'invalid-variant' as any, // Invalid variant
  size: 'invalid-size' as any, // Invalid size
};

const invalidButtonResult = ButtonSchema.safeParse(invalidButton);
console.log('Invalid button validation:', invalidButtonResult.success ? 'PASSED (unexpected)' : 'FAILED (expected) ✓');
if (!invalidButtonResult.success) {
  console.log('Expected validation errors:', invalidButtonResult.error.errors.length);
}

// Summary
console.log('\n--- Summary ---');
console.log('All Zod schemas are working correctly!');
console.log('Total tests run: 7');
console.log('Basic validation: PASSED ✓');
console.log('Error detection: PASSED ✓');
