import { Task, TaskLog } from '../types'
import { diffDays, toDate } from './dates'

// Elapsed-days / total-days progress for a phase task as of a given date.
// A task on its start date has elapsed 0, so it starts at 0%.
export function autoProgress(task: Task, onDate: Date): number {
  if (task.type === 'long-term' || task.startDate == null || task.endDate == null) return 0
  const start = toDate(task.startDate)
  const end = toDate(task.endDate)
  const total = diffDays(start, end)
  if (total <= 0) return 0
  const elapsed = Math.max(0, Math.min(diffDays(start, onDate), total))
  return Math.round((elapsed / total) * 100)
}

// Effective progress for a single task, or null for long-term goals (no progress).
export function taskProgress(task: Task, logs: TaskLog[], onDate: Date): number | null {
  if (task.type === 'long-term') return null
  // A to-do has no schedule, so it has no progress. Its historical logs are
  // deliberately kept (they stay readable) — they just no longer feed this.
  if (task.isTodo) return null
  // Not started yet → no progress (renders as "—").
  if (task.startDate != null && diffDays(toDate(task.startDate), onDate) < 0) return null
  // While paused, freeze the calendar-based progress at the pause date.
  const effectiveDate = task.paused && task.pauseDate ? toDate(task.pauseDate) : onDate
  if (!task.strictProgress) return autoProgress(task, effectiveDate)
  const own = logs
    .filter((l) => l.taskId === task.id)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (own.length === 0) return 0
  const last = own[own.length - 1]
  // Manual override: the latest log's explicit target progress wins.
  if (last.targetProgress != null) return Math.max(0, Math.min(100, last.targetProgress))
  // Auto-accumulate: each distinct logged day counts as one slice of the total.
  if (task.startDate == null || task.endDate == null) return 0
  const totalDays = Math.max(1, diffDays(toDate(task.startDate), toDate(task.endDate)))
  const loggedDays = new Set(own.map((l) => l.date)).size
  return Math.min(100, Math.round((loggedDays / totalDays) * 100))
}

// Average progress over the given tasks, ignoring long-term goals (which have none).
export function averageProgress(tasks: Task[], logs: TaskLog[]): number {
  const ps = tasks.map((t) => taskProgress(t, logs, new Date())).filter((p): p is number => p != null)
  return ps.length ? Math.round(ps.reduce((s, p) => s + p, 0) / ps.length) : 0
}
