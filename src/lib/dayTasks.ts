import { Project, Task, TaskLog, TaskStatus } from '../types'
import { buildChildrenMap, computeWbs, deriveStatus, deriveTaskStatus } from './tree'
import { taskProgress } from './progress'
import { addDays, toDate } from './dates'

export interface DayEffState {
  progress: number | null
  status: TaskStatus
}

export interface StrictLogRate {
  done: number
  total: number
  pct: number
}

export interface DayRow {
  task: Task
  wbs: string
  depth: number
  progress: number | null
  status: TaskStatus
  strict: boolean
  active: boolean
  hasLog: boolean
  pausedToday: boolean
  completedBefore: boolean
  overdue: boolean
}

export interface DaySummary {
  strict: DayRow[]
  nonStrict: DayRow[]
  ring: StrictLogRate
  logCount: number
}

// Urgency first — this is a "what do I handle today" list, not a tree.
const STATUS_RANK: Record<TaskStatus, number> = {
  delayed: 0,
  'in-progress': 1,
  'not-started': 2,
  paused: 3,
  completed: 4,
  todo: 5,
}

// Logs are stored as a current value, not a history: `taskProgress` takes a
// task's latest log and counts every distinct day it has ever been logged. Any
// question about a specific day therefore has to clip the log list first and
// hand the clipped array to everything downstream.
export function logsUpTo(logs: TaskLog[], day: string): TaskLog[] {
  return logs.filter((l) => l.date <= day)
}

/** Task ids carrying a log dated exactly `day`. */
export function loggedOnDay(logs: TaskLog[], day: string): Set<string> {
  const ids = new Set<string>()
  for (const l of logs) if (l.date === day) ids.add(l.taskId)
  return ids
}

/**
 * Whether a task's schedule covers `day`. Deliberately reads the raw dates:
 * `effectiveStates` hardcodes *today* internally, so it cannot answer anything
 * about a past day, and a parent's end date has already been synced into
 * `task.endDate` by `syncParentEnds`.
 */
export function activeOnDay(task: Task, day: string): boolean {
  if (task.isTodo || task.startDate == null) return false
  if (task.startDate > day) return false
  // A null end means open-ended (a long-term goal, or a parent whose end is not
  // resolved yet) — not "never active".
  return task.endDate == null || day <= task.endDate
}

/**
 * Whether a task was paused on `day`. Has to be day-accurate: `pauses` holds
 * past pause/resume pairs, while `paused` + `pauseDate` describe only the
 * pause that is still open.
 */
export function isPausedOnDay(task: Task, day: string): boolean {
  if (task.pauses.some((p) => p.pauseDate <= day && day < p.resumeDate)) return true
  return task.paused && task.pauseDate != null && task.pauseDate <= day
}

/** `strictProgress` is inert on parents — only leaves ever feed `taskProgress`. */
function isStrictLeaf(task: Task, children: Map<string | null, Task[]>): boolean {
  return (
    !task.isTodo &&
    task.type === 'phase' &&
    task.strictProgress &&
    (children.get(task.id) ?? []).length === 0
  )
}

/**
 * Progress and status as of `day`, mirroring `effectiveStates` but with the day
 * as a parameter instead of the hardcoded present. Without this every past day
 * would render today's numbers.
 */
export function dayStates(tasks: Task[], logs: TaskLog[], day: string): Map<string, DayEffState> {
  const clipped = logsUpTo(logs, day)
  const children = buildChildrenMap(tasks)
  const cache = new Map<string, DayEffState>()
  const derive = (t: Task): DayEffState => {
    const hit = cache.get(t.id)
    if (hit) return hit
    const kids = children.get(t.id) ?? []
    let r: DayEffState
    if (t.isTodo) {
      // A to-do never takes a date, a progress or a status from its children.
      r = { progress: null, status: 'todo' }
    } else if (kids.length === 0) {
      const progress = taskProgress(t, clipped, toDate(day))
      r = { progress, status: deriveTaskStatus(t, progress, day) }
    } else {
      const es = kids.map(derive)
      // To-do children carry no schedule, so they take no part in the roll-up.
      const timed = es.filter((e) => e.status !== 'todo')
      const ps = timed.map((e) => e.progress).filter((p): p is number => p != null)
      const progress = ps.length ? Math.round(ps.reduce((s, p) => s + p, 0) / ps.length) : null
      r =
        t.type === 'long-term'
          ? { progress: null, status: deriveTaskStatus(t, null, day) }
          : { progress, status: deriveStatus(timed.map((e) => e.status)) }
    }
    cache.set(t.id, r)
    return r
  }
  for (const t of tasks) derive(t)
  return cache
}

/** Progress as of the day *before* `day`. */
function progressBefore(task: Task, clipped: TaskLog[], day: string): number {
  return taskProgress(task, clipped, addDays(toDate(day), -1)) ?? 0
}

/**
 * How much of the day's strict work has been logged: the tasks that owed a log
 * on `day` versus the ones that got one.
 */
export function strictLogRate(tasks: Task[], logs: TaskLog[], day: string): StrictLogRate {
  const clipped = logsUpTo(logs, day)
  const logged = loggedOnDay(logs, day)
  const children = buildChildrenMap(tasks)
  let done = 0
  let total = 0
  for (const t of tasks) {
    if (!isStrictLeaf(t, children)) continue
    if (!activeOnDay(t, day)) continue
    // Paused work is not the day's work, so it owes no log.
    if (isPausedOnDay(t, day)) continue
    // A task already finished when the day started owes no log either — tested
    // against the *previous* day so the rate stays monotonic. Testing against
    // the day itself would evict a task the moment its log completed it,
    // turning 3/5 into 3/4 and reading as a regression.
    if (progressBefore(t, clipped, day) >= 100) continue
    total++
    if (logged.has(t.id)) done++
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

function depths(tasks: Task[]): Map<string, number> {
  const children = buildChildrenMap(tasks)
  const m = new Map<string, number>()
  const walk = (pid: string | null, d: number) => {
    for (const c of children.get(pid) ?? []) {
      m.set(c.id, d)
      walk(c.id, d + 1)
    }
  }
  walk(null, 0)
  return m
}

/**
 * The day's task list, split into strict and non-strict halves. Everything
 * scheduled on the day is listed — long-term goals, paused tasks and completed
 * ones included; the panel decides how to mark them.
 */
export function daySummary(tasks: Task[], logs: TaskLog[], projects: Project[], day: string): DaySummary {
  const clipped = logsUpTo(logs, day)
  const states = dayStates(tasks, logs, day)
  const children = buildChildrenMap(tasks)
  const logged = loggedOnDay(logs, day)
  const depth = depths(tasks)
  const order = new Map(projects.map((p, i) => [p.id, i]))

  // Numbering restarts per project, matching what the Gantt shows.
  const wbs = new Map<string, string>()
  const byProj = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!byProj.has(t.projectId)) byProj.set(t.projectId, [])
    byProj.get(t.projectId)!.push(t)
  }
  for (const list of byProj.values()) for (const [id, n] of computeWbs(list)) wbs.set(id, n)

  const rows: DayRow[] = []
  for (const t of tasks) {
    if (t.isTodo || t.startDate == null) continue
    const st = states.get(t.id)
    if (!st) continue
    const active = activeOnDay(t, day)
    const strict = isStrictLeaf(t, children)
    // A strict task that ran out of window without finishing drops off its own
    // schedule the next day, which would hide the most urgent work of all. It
    // is listed with an overdue badge but never counted in the ring — the ring
    // measures the day's scheduled logging, not the backlog.
    const overdue = !active && strict && st.status === 'delayed'
    if (!active && !overdue) continue
    rows.push({
      task: t,
      wbs: wbs.get(t.id) ?? '',
      depth: depth.get(t.id) ?? 0,
      progress: st.progress,
      status: st.status,
      strict,
      active,
      hasLog: logged.has(t.id),
      pausedToday: isPausedOnDay(t, day),
      completedBefore: progressBefore(t, clipped, day) >= 100,
      overdue,
    })
  }

  const cmp = (a: DayRow, b: DayRow) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    (order.get(a.task.projectId) ?? 999) - (order.get(b.task.projectId) ?? 999) ||
    a.wbs.localeCompare(b.wbs, undefined, { numeric: true }) ||
    a.task.name.localeCompare(b.task.name) ||
    a.task.id.localeCompare(b.task.id)
  rows.sort(cmp)

  let logCount = 0
  for (const l of logs) if (l.date === day) logCount++

  return {
    strict: rows.filter((r) => r.strict),
    nonStrict: rows.filter((r) => !r.strict),
    ring: strictLogRate(tasks, logs, day),
    logCount,
  }
}
