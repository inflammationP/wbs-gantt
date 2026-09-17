export type TaskStatus = 'todo' | 'not-started' | 'in-progress' | 'completed' | 'paused' | 'delayed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskType = 'phase' | 'long-term'
export type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type AppView = 'gantt' | 'today' | 'calendar' | 'logs' | 'manage' | 'settings'

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

/**
 * A chore — the short, day-sized thing you handle today or tomorrow.
 *
 * Deliberately its own collection rather than a `Task` with a flag. Nothing on
 * the Gantt side reads `chores`, so a chore cannot leak into the tree, the
 * roll-ups, the timeline's range or a project's progress: the isolation is
 * structural instead of a check every one of those places has to remember.
 *
 * `date` is the day it was *put* on and is never rewritten. Carrying unfinished
 * work forward is done by reading (`date <= today`), not by writing, so a chore
 * that has slipped three days still says so, and the day it was originally
 * meant for stays readable. `completedDate` is the other half of that: without
 * it the heatmap would have to credit the day a chore was *assigned*, so
 * finishing Monday's chore on Tuesday would turn Monday green retroactively.
 */
export interface Chore {
  id: string
  title: string
  note: string // one line, may be empty
  date: string // yyyy-MM-dd, the day it was put on; never rewritten
  done: boolean
  completedDate: string | null // yyyy-MM-dd, null while open. The heatmap reads this
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
