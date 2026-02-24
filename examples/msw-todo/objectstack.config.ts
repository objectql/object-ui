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
