import { ObjectSchema, Field } from '@objectstack/spec/data';

export const TodoTask = ObjectSchema.create({
  name: 'todo_task',
  label: 'Todo Task',
  icon: 'check-circle-2',
  titleFormat: '{subject}',
  compactLayout: ['subject', 'due_date', 'priority', 'is_completed'],
  enable: {
    apiEnabled: true,
    trackHistory: true,
    feeds: true,            // Enable social feed, comments, and mentions
    activities: true,       // Enable tasks and events tracking
    mru: true,              // Track Most Recently Used
  },
  fields: {
    subject: Field.text({ required: true }),
    due_date: Field.date(),
    is_completed: Field.boolean({ defaultValue: false }),
    priority: Field.rating(3, { 
      label: 'Priority',
      description: 'Task priority (1-3 stars)',
    }),
    category_color: Field.color({
      label: 'Category Color',
      colorFormat: 'hex',
      presetColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
    }),
    code_snippet: Field.code('javascript', {
      label: 'Code Snippet',
      description: 'Optional code to implement',
      lineNumbers: true,
    }),
    notes: Field.richtext({
      label: 'Notes',
      description: 'Rich text notes with formatting',
    }),
  },
  list_views: {
    all: {
      label: 'All Tasks',
      columns: ['subject', 'due_date', 'priority', 'is_completed']
    },
    calendar: {
      label: 'Calendar',
      type: 'calendar',
      startDateField: 'due_date',
      titleField: 'subject'
    },
    board: {
      label: 'Board',
      type: 'kanban',
      groupBy: 'priority'
    }
  }
});
