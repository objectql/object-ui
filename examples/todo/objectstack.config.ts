import { defineStack } from '@objectstack/spec';
import { App } from '@objectstack/spec/ui';
import { TodoTask } from './src/domains/todo/task.object';

// Helper to create dates relative to today
const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

export default defineStack({
  objects: [TodoTask],
  apps: [
    App.create({
      name: 'todo_app',
      label: 'Task Tracker',
      icon: 'check-square',
      description: 'Manage tasks, track progress, and collaborate with your team',
      branding: {
        primaryColor: '#10B981',
      },
      navigation: [
        {
          id: 'nav_task_dashboard',
          type: 'dashboard',
          dashboardName: 'task_dashboard',
          label: 'Dashboard',
          icon: 'layout-dashboard',
        },
        {
          id: 'nav_todo_task',
          type: 'object',
          objectName: 'todo_task',
          label: 'All Tasks',
          icon: 'list-todo',
        },
        {
          id: 'nav_todo_board',
          type: 'object',
          objectName: 'todo_task',
          viewName: 'board',
          label: 'Task Board',
          icon: 'kanban-square',
        },
        {
          id: 'nav_todo_calendar',
          type: 'object',
          objectName: 'todo_task',
          viewName: 'calendar',
          label: 'Calendar',
          icon: 'calendar',
        },
        {
          id: 'nav_todo_help',
          type: 'page',
          pageName: 'todo_help',
          label: 'Help',
          icon: 'help-circle',
        },
      ],
    }),
  ],
  dashboards: [
    {
      name: 'task_dashboard',
      label: 'Task Overview',
      widgets: [
        {
          type: 'metric',
          layout: { x: 0, y: 0, w: 1, h: 1 },
          options: {
            label: 'Total Tasks',
            value: '12',
            icon: 'ListTodo',
          },
        },
        {
          type: 'metric',
          layout: { x: 1, y: 0, w: 1, h: 1 },
          options: {
            label: 'In Progress',
            value: '4',
            trend: { value: 2, direction: 'up', label: 'this week' },
            icon: 'Clock',
          },
        },
        {
          type: 'metric',
          layout: { x: 2, y: 0, w: 1, h: 1 },
          options: {
            label: 'Completed',
            value: '3',
            trend: { value: 25, direction: 'up', label: 'completion rate' },
            icon: 'CheckCircle2',
          },
        },
        {
          type: 'metric',
          layout: { x: 3, y: 0, w: 1, h: 1 },
          options: {
            label: 'Overdue',
            value: '2',
            trend: { value: 1, direction: 'down', label: 'vs last week' },
            icon: 'AlertTriangle',
          },
        },
        {
          title: 'Tasks by Status',
          type: 'donut',
          layout: { x: 0, y: 1, w: 2, h: 2 },
          options: {
            xField: 'status',
            yField: 'count',
          },
          // @ts-ignore
          data: {
            provider: 'value',
            items: [
              { status: 'Backlog', count: 2 },
              { status: 'Todo', count: 2 },
              { status: 'In Progress', count: 4 },
              { status: 'Review', count: 1 },
              { status: 'Done', count: 3 },
            ],
          },
        },
        {
          title: 'Tasks by Category',
          type: 'bar',
          layout: { x: 2, y: 1, w: 2, h: 2 },
          options: {
            xField: 'category',
            yField: 'count',
          },
          // @ts-ignore
          data: {
            provider: 'value',
            items: [
              { category: 'Feature', count: 4 },
              { category: 'Bug', count: 3 },
              { category: 'Documentation', count: 2 },
              { category: 'Design', count: 1 },
              { category: 'Chore', count: 2 },
            ],
          },
        },
      ],
    },
  ],
  pages: [
    {
      name: 'todo_help',
      label: 'Help',
      type: 'app',
      regions: [
        {
          name: 'main',
          components: [
            {
              type: 'container',
              properties: {
                className: 'prose max-w-3xl mx-auto p-8 text-foreground',
                children: [
                  { type: 'text', properties: { value: '# Task Tracker Guide', className: 'text-3xl font-bold mb-6 block' } },
                  { type: 'text', properties: { value: 'Your task management workspace for tracking work across your team.', className: 'text-muted-foreground mb-6 block' } },
                  { type: 'text', properties: { value: '## Views', className: 'text-xl font-semibold mb-3 block' } },
                  { type: 'text', properties: { value: '- **All Tasks** — Grid view with sorting, filtering, and search\n- **Board** — Kanban board grouped by status (drag-and-drop)\n- **Calendar** — Tasks displayed by due date\n- **Active** — Filtered view showing non-completed tasks', className: 'whitespace-pre-line mb-6 block' } },
                  { type: 'text', properties: { value: '## Workflow', className: 'text-xl font-semibold mb-3 block' } },
                  { type: 'text', properties: { value: 'Tasks flow through stages: **Backlog** → **Todo** → **In Progress** → **Review** → **Done**. Use the Board view to drag tasks between columns.', className: 'mb-4 block' } },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
  manifest: {
    id: 'com.example.todo',
    version: '1.0.0',
    type: 'app',
    name: 'Task Tracker',
    description: 'Task management with Kanban boards and calendar views',
    data: [
      {
        object: 'todo_task',
        mode: 'upsert',
        records: [
          { subject: 'Redesign login page', status: 'In Progress', priority: 'High', assignee: 'Alice Chen', category: 'Feature', due_date: daysFromNow(2), is_completed: false, estimated_hours: 8 },
          { subject: 'Fix payment gateway timeout', status: 'In Progress', priority: 'Critical', assignee: 'Bob Smith', category: 'Bug', due_date: daysFromNow(1), is_completed: false, estimated_hours: 4 },
          { subject: 'Write API documentation', status: 'Todo', priority: 'Medium', assignee: 'Alice Chen', category: 'Documentation', due_date: daysFromNow(5), is_completed: false, estimated_hours: 6 },
          { subject: 'Update user onboarding flow', status: 'Review', priority: 'High', assignee: 'Charlie Park', category: 'Design', due_date: daysFromNow(0), is_completed: false, estimated_hours: 12 },
          { subject: 'Migrate database to v3', status: 'In Progress', priority: 'High', assignee: 'Bob Smith', category: 'Chore', due_date: daysFromNow(3), is_completed: false, estimated_hours: 16 },
          { subject: 'Add dark mode support', status: 'Todo', priority: 'Medium', assignee: 'Alice Chen', category: 'Feature', due_date: daysFromNow(7), is_completed: false, estimated_hours: 10 },
          { subject: 'Fix mobile responsive layout', status: 'In Progress', priority: 'High', assignee: 'Charlie Park', category: 'Bug', due_date: daysFromNow(-1), is_completed: false, estimated_hours: 5 },
          { subject: 'Create release notes for v2.0', status: 'Backlog', priority: 'Low', assignee: 'Alice Chen', category: 'Documentation', due_date: daysFromNow(14), is_completed: false, estimated_hours: 3 },
          { subject: 'Implement search autocomplete', status: 'Backlog', priority: 'Medium', assignee: 'Bob Smith', category: 'Feature', due_date: daysFromNow(10), is_completed: false, estimated_hours: 8 },
          { subject: 'Set up CI/CD pipeline', status: 'Done', priority: 'Medium', assignee: 'Bob Smith', category: 'Chore', due_date: daysFromNow(-5), is_completed: true, estimated_hours: 6 },
          { subject: 'Design dashboard widgets', status: 'Done', priority: 'Low', assignee: 'Charlie Park', category: 'Design', due_date: daysFromNow(-3), is_completed: true, estimated_hours: 8 },
          { subject: 'Optimize image loading', status: 'Done', priority: 'Medium', assignee: 'Alice Chen', category: 'Feature', due_date: daysFromNow(-2), is_completed: true, estimated_hours: 4 },
        ],
      },
    ],
  },
});

