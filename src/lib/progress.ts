import { Task, TaskLog } from '../types'
import { addDays, diffDays, toDate, toISO } from './dates'

/**
 * What `isPausedOnDay` needs to know: anything that can be suspended.
 *
 * Structural rather than `Task`, because a habit pauses by the same rules and
 * the question is identical. Widening the parameter costs nothing at the call
 * sites — every one of them passes a `Task`, which still satisfies this — and
 * it beats a second copy in `lib/habits.ts` that would have to be kept in step
 * with the half-open interval below.
 */
export interface Pausable {
  paused: boolean
  pauseDate: string | null
  pauses: { pauseDate: string; resumeDate: string }[]
}

/**
 * Whether something was paused on `day`.
 *
 * Lives here rather than in `dayTasks.ts` because the denominator below needs
 * it, and `dayTasks` already imports this module — the other direction would be
 * a cycle (`progress` → `dayTasks` → `tree` → `progress`). This module reads
 * nothing but the subject's own fields, so it is the end of the chain.
 *
 * Has to be day-accurate: `pauses` holds past pause/resume pairs, while
 * `paused` + `pauseDate` describe only the pause that is still open.
 */
export function isPausedOnDay(task: Pausable, day: string): boolean {
  if (task.pauses.some((p) => p.pauseDate <= day && day < p.resumeDate)) return true
  return task.paused && task.pauseDate != null && task.pauseDate <= day
}

/**
 * How many days of a window count for progress: every day from `start` to `end`
 * inclusive that the task was not paused on.
 *
 * The pause correction is what keeps a paused task able to finish. `resumeTask`
 * pushes the end date out by however long the pause lasted, so the window grows
 * by exactly those days — count them and the task is capped below 100% forever,
 * with no day left on which it could have been advanced.
 */
function countableDays(task: Task, start: string, end: string): number {
  let n = 0
  for (let d = toDate(start), last = toDate(end); d <= last; d = addDays(d, 1)) {
    if (!isPausedOnDay(task, toISO(d))) n++
  }
  return n
}

/**
 * Progress for a task that keeps no log: the share of its window's days the user
 * has ticked off.
 *
 * Days you did not tick do not count — that is the whole difference from what
 * this used to be, where the calendar advanced the number on your behalf. The
 * count stops at `onDate`, so asking what was true yesterday cannot be answered
 * by a tick made today: `dayTasks.progressBefore` asks exactly that question,
 * one day at a time.
 */
function tickProgress(task: Task, onDate: Date): number {
  const start = task.startDate
  const end = task.endDate
  if (start == null || end == null) return 0
  const upto = toISO(onDate)
  const ticked = new Set((task.confirmedDays ?? []).filter((d) => d >= start && d <= end && d <= upto))
  return Math.min(100, Math.round((ticked.size / Math.max(1, countableDays(task, start, end))) * 100))
}

// Effective progress for a single task, or null for long-term goals (no progress).
export function taskProgress(task: Task, logs: TaskLog[], onDate: Date): number | null {
  if (task.type === 'long-term') return null
  // A to-do has no schedule, so it has no progress. Its historical logs are
  // deliberately kept (they stay readable) — they just no longer feed this.
  if (task.isTodo) return null
  // Not started yet → no progress (renders as "—").
  if (task.startDate != null && diffDays(toDate(task.startDate), onDate) < 0) return null
  if (!task.strictProgress) return tickProgress(task, onDate)
  const own = logs
    .filter((l) => l.taskId === task.id)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (own.length === 0) return 0
  // The latest log that *states* a target wins — searched back through the list
  // rather than read off the last row. A log carrying no target states nothing
  // and must not erase a number an earlier one wrote: reading only the last row
  // let a blank log drop a stated 50% to "logged days ÷ window days".
  for (let i = own.length - 1; i >= 0; i--) {
    const stated = own[i].targetProgress
    if (stated != null) return Math.max(0, Math.min(100, stated))
  }
  // Auto-accumulate: each distinct logged day counts as one slice of the total.
  // Every log written since the progress fields became mandatory carries a
  // target, so this branch is only ever reached by logs written before that —
  // keeping it is what stops those tasks from reading 0% (and, once their window
  // filled up, from coming back to owe a log every day forever).
  if (task.startDate == null || task.endDate == null) return 0
  const totalDays = Math.max(1, countableDays(task, task.startDate, task.endDate))
  const loggedDays = new Set(own.map((l) => l.date)).size
  return Math.min(100, Math.round((loggedDays / totalDays) * 100))
}

// Average progress over the given tasks, ignoring long-term goals (which have none).
export function averageProgress(tasks: Task[], logs: TaskLog[]): number {
  const ps = tasks.map((t) => taskProgress(t, logs, new Date())).filter((p): p is number => p != null)
  return ps.length ? Math.round(ps.reduce((s, p) => s + p, 0) / ps.length) : 0
}
