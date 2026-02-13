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
  }
});
