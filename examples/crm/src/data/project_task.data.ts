export const ProjectTaskData = {
  object: 'project_task',
  mode: 'upsert',
  records: [
    { _id: "t1", name: "Requirements Gathering", start_date: new Date("2024-02-01"), end_date: new Date("2024-02-14"), progress: 100, estimated_hours: 40, actual_hours: 38, status: 'completed', color: '#10b981', priority: 'high', manager: "1", assignee: "2" },
    { _id: "t2", name: "Architecture Design", start_date: new Date("2024-02-15"), end_date: new Date("2024-03-01"), progress: 100, estimated_hours: 60, actual_hours: 55, status: 'completed', color: '#3b82f6', priority: 'high', dependencies: 't1', manager: "1", assignee: "1" },
    { _id: "t3", name: "Frontend Development", start_date: new Date("2024-03-02"), end_date: new Date("2024-04-15"), progress: 75, estimated_hours: 120, actual_hours: 90, status: 'in_progress', color: '#8b5cf6', priority: 'high', dependencies: 't2', manager: "2", assignee: "2" },
    { _id: "t4", name: "Backend API Integration", start_date: new Date("2024-03-02"), end_date: new Date("2024-04-10"), progress: 80, estimated_hours: 100, actual_hours: 80, status: 'in_progress', color: '#6366f1', priority: 'high', dependencies: 't2', manager: "2", assignee: "1" },
    { _id: "t5", name: "QA & Testing", start_date: new Date("2024-04-16"), end_date: new Date("2024-05-01"), progress: 0, estimated_hours: 50, status: 'planned', color: '#f59e0b', priority: 'medium', dependencies: 't3,t4', manager: "1" },
    { _id: "t6", name: "UAT", start_date: new Date("2024-05-02"), end_date: new Date("2024-05-15"), progress: 0, estimated_hours: 30, status: 'planned', color: '#f43f5e', priority: 'medium', dependencies: 't5', manager: "1" },
    { _id: "t7", name: "Go Live & Launch", start_date: new Date("2024-05-20"), end_date: new Date("2024-05-20"), progress: 0, estimated_hours: 8, status: 'planned', color: '#ef4444', priority: 'critical', dependencies: 't6', manager: "1" },
  ]
};
