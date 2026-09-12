import { Project, Task, TaskLog, TaskStatus } from '../types'
import { taskProgress } from './progress'
import { todayISO } from './dates'

export interface EffState {
  start: string | null
  end: string | null
  progress: number | null
  status: TaskStatus
}

export function buildChildrenMap(tasks: Task[]): Map<string | null, Task[]> {
  const m = new Map<string | null, Task[]>()
  for (const t of tasks) {
    const k = t.parentId
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(t)
  }
  // To-dos sink to the bottom of their sibling list: they have no start date to
  // sort by, and unscheduled work belongs after the scheduled work. `? 1 : 0`
  // rather than `Number(...)` because legacy records are `undefined` until
  // `normalize` backfills them, and a NaN comparator makes Array.sort's order
  // implementation-defined.
  const cmp = (a: Task, b: Task) =>
    (a.isTodo ? 1 : 0) - (b.isTodo ? 1 : 0) ||
    (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  for (const list of m.values()) list.sort(cmp)
  return m
}

export function computeWbs(tasks: Task[]): Map<string, string> {
  const children = buildChildrenMap(tasks)
  const map = new Map<string, string>()
  const roots = children.get(null) ?? []
  roots.forEach((t, i) => assignWbs(t, `${i + 1}`, children, map))
  return map
}

function assignWbs(t: Task, prefix: string, children: Map<string | null, Task[]>, map: Map<string, string>) {
  map.set(t.id, prefix)
  const kids = children.get(t.id) ?? []
  kids.forEach((k, i) => assignWbs(k, `${prefix}.${i + 1}`, children, map))
}

export function collectDescendants(tasks: Task[], id: string): string[] {
  const children = buildChildrenMap(tasks)
  const out: string[] = []
  const walk = (pid: string) => {
    for (const c of children.get(pid) ?? []) {
      out.push(c.id)
      walk(c.id)
    }
  }
  walk(id)
  return out
}

export function hasChildren(tasks: Task[], id: string): boolean {
  return tasks.some((t) => t.parentId === id)
}

export function deriveStatus(statuses: TaskStatus[]): TaskStatus {
  // `[].every(...)` is true, so an empty list would otherwise read as completed.
  // Reachable when a parent's children are all to-dos and are excluded below.
  if (statuses.length === 0) return 'not-started'
  if (statuses.every((s) => s === 'completed')) return 'completed'
  if (statuses.some((s) => s === 'delayed')) return 'delayed'
  if (statuses.some((s) => s === 'in-progress')) return 'in-progress'
  if (statuses.some((s) => s === 'paused')) return 'paused'
  if (statuses.every((s) => s === 'not-started')) return 'not-started'
  return 'not-started'
}

// Derive a leaf task's status from its pause state, progress and dates.
export function deriveTaskStatus(task: Task, progress: number | null, today: string): TaskStatus {
  if (task.paused) return 'paused'
  // Nothing scheduled at all. Reachable for a to-do that was just restored while
  // its schedule is still being filled in — without this it would read as
  // "In progress" despite having no dates.
  if (task.startDate == null && task.endDate == null) return 'not-started'
  if (progress != null && progress >= 100) return 'completed'
  if (task.startDate != null && today < task.startDate) return 'not-started'
  if (task.type !== 'long-term' && task.strictProgress && task.endDate != null && today > task.endDate) return 'delayed'
  return 'in-progress'
}

export function effectiveStates(tasks: Task[], logs: TaskLog[]): Map<string, EffState> {
  const children = buildChildrenMap(tasks)
  const cache = new Map<string, EffState>()
  const derive = (t: Task): EffState => {
    const hit = cache.get(t.id)
    if (hit) return hit
    const kids = children.get(t.id) ?? []
    let r: EffState
    if (t.isTodo) {
      // Authoritative: a to-do never takes a date, a progress or a status from
      // its children, so a to-do parent stays a to-do. Checked before the
      // leaf/parent split for exactly that reason.
      r = { start: null, end: null, progress: null, status: 'todo' }
    } else if (kids.length === 0) {
      // Leaf: long-term goals always have a real start and an unresolved end.
      const progress = taskProgress(t, logs, new Date())
      r = {
        start: t.startDate,
        end: t.type === 'long-term' ? null : t.endDate,
        progress,
        status: deriveTaskStatus(t, progress, todayISO()),
      }
    } else {
      const es = kids.map(derive)
      // To-do children are unscheduled, so they take no part in the roll-up.
      // Including them would make `source.some(e => e.end == null)` true and
      // hand the parent a null end date, which syncParentEnds then persists —
      // stretching the parent's bar to the end of the timeline. When `timed` is
      // empty the `t.startDate` / `t.endDate` fallbacks below take over.
      const timed = es.filter((e) => e.status !== 'todo')
      const ps = timed.map((e) => e.progress).filter((p): p is number => p != null)
      const progress = ps.length ? Math.round(ps.reduce((s, p) => s + p, 0) / ps.length) : null
      const status = deriveStatus(timed.map((e) => e.status))
      if (t.type === 'long-term') {
        // Long-term goal: anchored to its own start, no resolved end, and no
        // progress. Its status follows its own dates, not its children's, so an
        // unstarted sub-goal can't mark the whole goal "not-started".
        r = { start: t.startDate, end: null, progress: null, status: deriveTaskStatus(t, null, todayISO()) }
      } else {
        const starts = timed.map((e) => e.start).filter((s): s is string => s != null)
        const start = starts.length ? starts.reduce((min, s) => (s < min ? s : min), starts[0]) : t.startDate
        // End date is driven by non-completed children only: a late-scheduled
        // child that was completed early shouldn't skew the parent's end date.
        const active = timed.filter((e) => e.status !== 'completed')
        const source = active.length ? active : timed
        const ends = source.map((e) => e.end).filter((s): s is string => s != null)
        // If any relevant child has an unresolved end, the parent's end is
        // unresolved too (never converted into Infinity or a fake date).
        const end = source.some((e) => e.end == null) ? null : (ends.length ? ends.reduce((max, s) => (s > max ? s : max), ends[0]) : t.endDate)
        r = { start, end, progress, status }
      }
    }
    cache.set(t.id, r)
    return r
  }
  for (const t of tasks) derive(t)
  return cache
}

// The task itself plus every descendant that is not already completed: the set
// a cascade to to-do sweeps up. Completed descendants are deliberately kept —
// they are finished work and stay scheduled under the new to-do.
export function todoCascadeIds(tasks: Task[], logs: TaskLog[], id: string): string[] {
  const eff = effectiveStates(tasks, logs)
  return [id, ...collectDescendants(tasks, id)].filter(
    (tid) => tid === id || eff.get(tid)?.status !== 'completed',
  )
}

// Auto-set each phase parent's endDate to its latest child's effective end date.
export function syncParentEnds(tasks: Task[], logs: TaskLog[]): Task[] {
  const eff = effectiveStates(tasks, logs)
  let changed = false
  const next = tasks.map((t) => {
    // A to-do holds no dates at all — writing a derived end onto it would make
    // it half-scheduled.
    if (t.type === 'long-term' || t.isTodo || !hasChildren(tasks, t.id)) return t
    const e = eff.get(t.id)
    if (e && e.end !== t.endDate) {
      changed = true
      return { ...t, endDate: e.end }
    }
    return t
  })
  return changed ? next : tasks
}

export interface RowTask {
  kind: 'task'
  id: string
  task: Task
  depth: number
  wbs: string
  eff: EffState
  hasKids: boolean
  isLeaf: boolean
}

// A folder-like header collecting the to-do children of one task. Synthesized by
// `buildRows` rather than stored as a task, so it can never be orphaned,
// renamed or re-parented, and it stays out of WBS numbering, statistics, project
// counts and export/import.
export interface RowTodoGroup {
  kind: 'todoGroup'
  id: string // `todogroup:<parentId>` — doubles as the expand/collapse key
  parentId: string | null
  depth: number
  // How many character cells the WBS number beside this row would take, so the
  // placeholder drawn in that column is exactly as wide as the real numbers.
  wbsCells: number
  todoIds: string[]
}

export type Row = RowTask | RowTodoGroup

export const todoGroupId = (parentId: string | null) => `todogroup:${parentId ?? 'root'}`

// Every folder key implied by the current tasks: each parent that has at least
// one to-do child, plus the synthetic root group. Used by expand/collapse all,
// which can't discover these ids by walking tasks alone.
export function todoGroupIds(tasks: Task[]): string[] {
  const parents = new Set<string | null>()
  for (const t of tasks) if (t.isTodo) parents.add(t.parentId)
  return [...parents].map(todoGroupId)
}

export function buildRows(tasks: Task[], expanded: Record<string, boolean>, projects: Project[], logs: TaskLog[]): Row[] {
  const order = new Map(projects.map((p, i) => [p.id, i]))
  const children = buildChildrenMap(tasks)
  const eff = effectiveStates(tasks, logs)

  // WBS is computed per-project so numbering restarts cleanly in multi-project view.
  const wbs = new Map<string, string>()
  const byProj = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!byProj.has(t.projectId)) byProj.set(t.projectId, [])
    byProj.get(t.projectId)!.push(t)
  }
  for (const list of byProj.values()) {
    for (const [id, n] of computeWbs(list)) wbs.set(id, n)
  }

  const roots = (children.get(null) ?? []).slice()
  roots.sort((a, b) => {
    const pa = order.get(a.projectId) ?? 999
    const pb = order.get(b.projectId) ?? 999
    return (
      // Project grouping first, then to-dos last within each project — the
      // to-do key must not be hoisted above `pa - pb` or it would merge the
      // projects together.
      pa - pb ||
      (a.isTodo ? 1 : 0) - (b.isTodo ? 1 : 0) ||
      (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
    )
  })

  const rows: Row[] = []

  const visit = (t: Task, depth: number) => {
    const kids = children.get(t.id) ?? []
    rows.push({
      kind: 'task',
      id: t.id,
      task: t,
      depth,
      wbs: wbs.get(t.id) ?? '',
      eff: eff.get(t.id)!,
      hasKids: kids.length > 0,
      isLeaf: kids.length === 0,
    })
    if (expanded[t.id] === false) return
    const todoKids = kids.filter((k) => k.isTodo)
    for (const k of kids) if (!k.isTodo) visit(k, depth + 1)
    // The folder lines up with the sibling tasks at this level, so its name sits
    // at the same x as their names; the to-dos it holds step in one further.
    visitGroup(t.id, depth + 1, todoKids)
  }

  const visitGroup = (parentId: string | null, depth: number, todoKids: Task[]) => {
    if (todoKids.length === 0) return
    const gid = todoGroupId(parentId)
    // The placeholder stands in for the WBS numbers of the rows inside, so
    // measure it off those — not off the row depth, which is inflated by every
    // folder above it and would run away from the real numbers.
    let wbsCells = 0
    for (const k of todoKids) wbsCells = Math.max(wbsCells, (wbs.get(k.id) ?? '').length)
    rows.push({ kind: 'todoGroup', id: gid, parentId, depth, wbsCells, todoIds: todoKids.map((k) => k.id) })
    // Folders are collapsed by default (tasks are expanded by default), so the
    // test is for an explicit `true` rather than the usual `!== false`.
    if (expanded[gid] === true) for (const k of todoKids) visit(k, depth + 1)
  }

  for (const r of roots) if (!r.isTodo) visit(r, 0)
  visitGroup(null, 0, roots.filter((r) => r.isTodo))
  return rows
}
