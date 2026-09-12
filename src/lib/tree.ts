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
  const cmp = (a: Task, b: Task) =>
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
    if (kids.length === 0) {
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
      const ps = es.map((e) => e.progress).filter((p): p is number => p != null)
      const progress = ps.length ? Math.round(ps.reduce((s, p) => s + p, 0) / ps.length) : null
      const status = deriveStatus(es.map((e) => e.status))
      if (t.type === 'long-term') {
        // Long-term goal: anchored to its own start, no resolved end, and no
        // progress. Its status follows its own dates, not its children's, so an
        // unstarted sub-goal can't mark the whole goal "not-started".
        r = { start: t.startDate, end: null, progress: null, status: deriveTaskStatus(t, null, todayISO()) }
      } else {
        const starts = es.map((e) => e.start).filter((s): s is string => s != null)
        const start = starts.length ? starts.reduce((min, s) => (s < min ? s : min), starts[0]) : t.startDate
        // End date is driven by non-completed children only: a late-scheduled
        // child that was completed early shouldn't skew the parent's end date.
        const active = es.filter((e) => e.status !== 'completed')
        const source = active.length ? active : es
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

// Auto-set each phase parent's endDate to its latest child's effective end date.
export function syncParentEnds(tasks: Task[], logs: TaskLog[]): Task[] {
  const eff = effectiveStates(tasks, logs)
  let changed = false
  const next = tasks.map((t) => {
    if (t.type === 'long-term' || !hasChildren(tasks, t.id)) return t
    const e = eff.get(t.id)
    if (e && e.end !== t.endDate) {
      changed = true
      return { ...t, endDate: e.end }
    }
    return t
  })
  return changed ? next : tasks
}

export interface Row {
  id: string
  task: Task
  depth: number
  wbs: string
  eff: EffState
  hasKids: boolean
  isLeaf: boolean
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
      pa - pb ||
      (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
    )
  })

  const rows: Row[] = []
  const visit = (t: Task, depth: number) => {
    const kids = children.get(t.id) ?? []
    rows.push({
      id: t.id,
      task: t,
      depth,
      wbs: wbs.get(t.id) ?? '',
      eff: eff.get(t.id)!,
      hasKids: kids.length > 0,
      isLeaf: kids.length === 0,
    })
    if (expanded[t.id] !== false) {
      for (const k of kids) visit(k, depth + 1)
    }
  }
  for (const r of roots) visit(r, 0)
  return rows
}
