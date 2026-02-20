export const ProjectView = {
  listViews: {
    all_tasks: {
      name: 'all_tasks',
      label: 'All Tasks',
      type: 'grid' as const,
      data: { provider: 'object' as const, object: 'project_task' },
      columns: ['name', 'status', 'priority', 'start_date', 'end_date', 'progress', 'assignee'],
      sort: [{ field: 'start_date', order: 'asc' as const }],
    },
    board: {
      name: 'board',
      label: 'Board',
      type: 'kanban' as const,
      data: { provider: 'object' as const, object: 'project_task' },
      columns: ['name', 'priority', 'start_date', 'end_date'],
      kanban: {
        groupByField: 'status',
        columns: ['name', 'priority', 'start_date', 'end_date'],
      },
    },
    gantt: {
      name: 'gantt',
      label: 'Gantt',
      type: 'gantt' as const,
      data: { provider: 'object' as const, object: 'project_task' },
      columns: ['name', 'start_date', 'end_date', 'progress', 'status'],
    },
    timeline: {
      name: 'timeline',
      label: 'Timeline',
      type: 'timeline' as const,
      data: { provider: 'object' as const, object: 'project_task' },
      columns: ['name', 'start_date', 'status'],
    },
  },
  form: {
    data: { provider: 'object' as const, object: 'project_task' },
    sections: [
      {
        label: 'Task Information',
        columns: '2' as const,
        fields: ['name', 'status', 'priority', 'color', 'manager', 'assignee'],
      },
      {
        label: 'Timeline & Progress',
        columns: '2' as const,
        fields: ['start_date', 'end_date', 'progress', 'estimated_hours', 'actual_hours'],
      },
      {
        label: 'Details',
        columns: '1' as const,
        collapsible: true,
        fields: ['dependencies', 'description'],
      },
    ],
  },
};
