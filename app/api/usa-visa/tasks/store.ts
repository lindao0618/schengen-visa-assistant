/** 美签任务内存存储（单例） */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface UsVisaTask {
  task_id: string
  type: 'check-photo' | 'fill-ds160' | 'submit-ds160' | 'register-ais'
  status: TaskStatus
  progress: number
  message: string
  created_at: number
  updated_at?: number
  result?: Record<string, unknown>
  error?: string
}

const tasks = new Map<string, UsVisaTask>()

export function createTask(type: UsVisaTask['type'], message = '任务已创建'): UsVisaTask {
  const task_id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const task: UsVisaTask = {
    task_id,
    type,
    status: 'pending',
    progress: 0,
    message,
    created_at: Date.now()
  }
  tasks.set(task_id, task)
  return task
}

export function updateTask(
  task_id: string,
  updates: Partial<Pick<UsVisaTask, 'status' | 'progress' | 'message' | 'result' | 'error'>>
): UsVisaTask | undefined {
  const task = tasks.get(task_id)
  if (!task) return undefined
  Object.assign(task, updates, { updated_at: Date.now() })
  return task
}

export function getTask(task_id: string): UsVisaTask | undefined {
  return tasks.get(task_id)
}

export function listTasks(limit = 50): UsVisaTask[] {
  return Array.from(tasks.values())
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .slice(0, limit)
}
