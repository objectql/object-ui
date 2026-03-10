/**
 * Task type definition (todo_task)
 */
export interface Task {
  id: string; // Primary key (canonical)
  _id?: string; // Legacy Mongo/Mingo storage alias — prefer `id`
  subject: string;
  priority: number;
  is_completed: boolean;
  due_date?: string;
  created_at?: string;
}

export interface CreateTaskInput {
  subject: string;
  priority?: number;
  is_completed?: boolean;
}

export interface UpdateTaskInput {
  subject?: string;
  priority?: number;
  is_completed?: boolean;
}
