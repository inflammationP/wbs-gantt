export type TaskStatus = 'todo' | 'not-started' | 'in-progress' | 'completed' | 'paused' | 'delayed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskType = 'phase' | 'long-term'
export type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type AppView = 'gantt' | 'calendar' | 'logs' | 'manage' | 'settings'

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
  // A to-do is unscheduled work parked for later: no dates, no priority, no
  // strict flag, no progress. `isTodo` is authoritative — nothing derives a
  // date, a progress or a rolled-up status onto a task carrying it.
  isTodo: boolean
  startDate: string | null // yyyy-MM-dd (null for long-term goals and to-dos)
  endDate: string | null // yyyy-MM-dd inclusive (null for long-term goals and to-dos)
  strictProgress: boolean // strict: progress accumulates only via daily logs
  paused: boolean
  pauseDate: string | null // yyyy-MM-dd, set while paused
  pauses: { pauseDate: string; resumeDate: string }[]
  priority: TaskPriority | null // null only for to-dos
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
