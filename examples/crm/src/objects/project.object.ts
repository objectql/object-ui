import { ObjectSchema, Field } from '@objectstack/spec/data';

export const ProjectObject = ObjectSchema.create({
  name: 'project_task',
  label: 'Project Task',
  icon: 'kanban-square',
  description: 'Project tasks with scheduling, dependencies, and progress tracking',
  fields: {
    name: Field.text({ label: 'Task Name', required: true, searchable: true }),
    start_date: Field.date({ label: 'Start Date', required: true }),
    end_date: Field.date({ label: 'End Date', required: true }),
    progress: Field.percent({ label: 'Progress' }),
    estimated_hours: Field.number({ label: 'Estimated Hours', scale: 1 }),
    actual_hours: Field.number({ label: 'Actual Hours', scale: 1 }),
    status: Field.select([
      { value: 'planned', label: 'Planned', color: 'gray' },
      { value: 'in_progress', label: 'In Progress', color: 'blue' },
      { value: 'completed', label: 'Completed', color: 'green' },
      { value: 'on_hold', label: 'On Hold', color: 'yellow' },
    ], { label: 'Status' }),
    priority: Field.select([
      { value: 'critical', label: 'Critical', color: 'red' },
      { value: 'high', label: 'High', color: 'orange' },
      { value: 'medium', label: 'Medium', color: 'yellow' },
      { value: 'low', label: 'Low', color: 'green' },
    ], { label: 'Priority' }),
    manager: Field.lookup('user', { label: 'Manager' }),
    assignee: Field.lookup('user', { label: 'Assignee' }),
    description: Field.richtext({ label: 'Description' }),
    color: Field.color({ label: 'Color' }),
    dependencies: Field.text({ label: 'Dependencies' }),
  }
});
