export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'paused' | 'delayed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskType = 'phase' | 'long-term'
export type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type AppView = 'gantt' | 'dashboard' | 'tasks' | 'calendar' | 'projects' | 'statistics'

export interface Project {
  id: string
  name: string
  color: string
  description: string
}

export interface Task {
  id: string
  name: string
  description: string
  parentId: string | null
  projectId: string
  type: TaskType
  startDate: string | null // yyyy-MM-dd (null for long-term goals)
  endDate: string | null // yyyy-MM-dd inclusive (null for long-term goals)
  progress: number // 0..100
  status: TaskStatus
  priority: TaskPriority
  tags: string[]
  dependencies: string[] // task ids
  createdAt: string
  updatedAt: string
}
