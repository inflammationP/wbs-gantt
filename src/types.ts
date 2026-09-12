export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'paused' | 'delayed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskType = 'phase' | 'long-term'
export type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type AppView = 'gantt' | 'dashboard' | 'tasks' | 'calendar' | 'projects' | 'statistics' | 'logs'

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
  strictProgress: boolean // strict: progress accumulates only via daily logs
  paused: boolean
  pauseDate: string | null // yyyy-MM-dd, set while paused
  pauses: { pauseDate: string; resumeDate: string }[]
  priority: TaskPriority
  tags: string[]
  dependencies: string[] // task ids
  createdAt: string
  updatedAt: string
}

export interface TaskLog {
  id: string
  taskId: string
  date: string // yyyy-MM-dd
  content: string // raw text; newline = item, leading tabs = nesting
  targetProgress?: number | null // 0..100, strict phase tasks only
  createdAt: string
  updatedAt: string
}
