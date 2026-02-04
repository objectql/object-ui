import { ObjectSchema, Field } from '@objectstack/spec/data';

export const ProjectObject = ObjectSchema.create({
  name: 'project_task',
  label: 'Project Task',
  icon: 'kanban-square',
  fields: {
    name: Field.text({ label: 'Task Name', required: true, searchable: true }),
    start_date: Field.date({ label: 'Start Date', required: true }),
    end_date: Field.date({ label: 'End Date', required: true }),
    progress: Field.percent({ label: 'Progress' }),
    status: Field.select(['Planned', 'In Progress', 'Completed', 'On Hold'], { label: 'Status' }),
    priority: Field.select(['High', 'Medium', 'Low'], { label: 'Priority' }),
    manager: Field.lookup('user', { label: 'Manager' }),
    description: Field.textarea({ label: 'Description' }),
    color: Field.text({ label: 'Color' }), // For Gantt bar color
    dependencies: Field.text({ label: 'Dependencies' }), // Comma separated IDs
  },
  list_views: {
    all: {
      label: 'All Tasks',
      columns: ['name', 'status', 'progress', 'start_date', 'end_date', 'priority', 'manager'],
      sort: [['start_date', 'asc']]
    },
    gantt_view: {
      label: 'Gantt View',
      type: 'gantt',
      columns: ['name', 'start_date', 'end_date', 'progress'],
      // Standard Gantt configuration mapped to specific fields
      startDateField: 'start_date',
      endDateField: 'end_date',
      titleField: 'name',
      progressField: 'progress',
      dependenciesField: 'dependencies',
      colorField: 'color',
    } as any, // Cast to allow extra properties if type definition is strict
    timeline_view: {
      label: 'Timeline',
      type: 'timeline',
      dateField: 'start_date',
      titleField: 'name',
      columns: ['status', 'priority']
    } as any
  }
});
