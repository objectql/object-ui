export const ProjectActions = [
  {
    name: 'task_change_status',
    label: 'Change Status',
    icon: 'circle-check',
    type: 'api' as const,
    objectName: 'project_task',
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      {
        name: 'new_status', label: 'New Status', type: 'select' as const, required: true,
        options: [
          { label: 'Planned', value: 'planned' },
          { label: 'In Progress', value: 'in_progress' },
          { label: 'Completed', value: 'completed' },
          { label: 'On Hold', value: 'on_hold' },
        ],
      },
    ],
    refreshAfter: true,
    successMessage: 'Task status updated',
  },
  {
    name: 'task_assign',
    label: 'Assign User',
    icon: 'user-plus',
    type: 'api' as const,
    objectName: 'project_task',
    locations: ['record_header' as const, 'list_item' as const],
    params: [
      { name: 'assignee_id', label: 'Assignee', type: 'lookup' as const, required: true },
    ],
    refreshAfter: true,
    successMessage: 'Task assigned successfully',
  },
];
