import { defineStack } from '@objectstack/spec';
import { App } from '@objectstack/spec/ui';

/**
 * Task Object Definition
 */
export const TaskObject = {
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
    id: { name: 'id', label: 'ID', type: 'text', required: true },
    subject: { name: 'subject', label: 'Subject', type: 'text', required: true },
    priority: { name: 'priority', label: 'Priority', type: 'number', defaultValue: 5 },
    isCompleted: { name: 'isCompleted', label: 'Completed', type: 'boolean', defaultValue: false },
    createdAt: { name: 'createdAt', label: 'Created At', type: 'datetime' }
  }
};

/**
 * App Configuration — Standard ObjectStackDefinition format
 */
export default defineStack({
  objects: [
    TaskObject
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
