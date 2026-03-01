import { defineStack } from '@objectstack/spec';
import { ObjectSchema, Field } from '@objectstack/spec/data';
import { App } from '@objectstack/spec/ui';

/**
 * Task Object Definition — uses ObjectSchema.create + Field.* for spec compliance
 */
export const TaskObject = ObjectSchema.create({
  name: 'task',
  label: 'Task',
  description: 'Task management object',
  icon: 'check-square',
  titleFormat: '{subject}',
  enable: {
    apiEnabled: true,
    trackHistory: false,
    feeds: false,
    activities: false,
    mru: true,
  },
  fields: {
    subject: Field.text({ label: 'Subject', required: true }),
    priority: Field.number({ label: 'Priority', defaultValue: 5 }),
    is_completed: Field.boolean({ label: 'Completed', defaultValue: false }),
    created_at: Field.datetime({ label: 'Created At', readonly: true }),
  },
});

/**
 * Task Actions — complete, toggle, and delete operations
 */
export const TaskActions = [
  {
    name: 'task_complete',
    label: 'Mark Complete',
    icon: 'check-circle-2',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const, 'list_toolbar' as const],
    visible: 'is_completed === false',
    bulkEnabled: true,
    refreshAfter: true,
    successMessage: 'Task completed',
  },
  {
    name: 'task_reopen',
    label: 'Reopen Task',
    icon: 'rotate-ccw',
    type: 'api' as const,
    locations: ['record_header' as const, 'list_item' as const],
    visible: 'is_completed === true',
    refreshAfter: true,
    successMessage: 'Task reopened',
  },
  {
    name: 'task_delete',
    label: 'Delete Task',
    icon: 'trash-2',
    type: 'api' as const,
    locations: ['record_more' as const, 'list_toolbar' as const],
    variant: 'danger' as const,
    bulkEnabled: true,
    confirmText: 'Are you sure you want to delete this task?',
    refreshAfter: true,
    successMessage: 'Task deleted',
  },
];

/**
 * App Configuration — Standard ObjectStackDefinition format
 */
export default defineStack({
  objects: [
    TaskObject
  ],
  views: [
    {
      listViews: {
        all_tasks: {
          name: 'all_tasks',
          label: 'All Tasks',
          type: 'grid' as const,
          data: { provider: 'object' as const, object: 'task' },
          columns: ['subject', 'priority', 'is_completed', 'created_at'],
          sort: [{ field: 'created_at', order: 'desc' as const }],
        },
      },
    },
  ],
  actions: [
    ...TaskActions,
  ],
  apps: [
    App.create({
      name: 'task_app',
      label: 'Task Management',
      description: 'MSW + React CRUD Example with ObjectStack',
      icon: 'check-square',
      branding: {
        primaryColor: '#3b82f6',
        logo: '/assets/logo.png',
      },
      navigation: [
        {
          id: 'group_tasks',
          type: 'group',
          label: 'Tasks',
          icon: 'list-todo',
          children: [
            {
              id: 'nav_tasks',
              type: 'object',
              objectName: 'task',
              label: 'My Tasks',
              icon: 'check-circle-2'
            }
          ]
        }
      ]
    })
  ],
  manifest: {
    id: 'com.example.msw-todo',
    version: '1.0.0',
    type: 'app',
    name: 'Task Management',
    description: 'MSW + React CRUD Example with ObjectStack',
  },
});
