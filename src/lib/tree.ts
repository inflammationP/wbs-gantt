import { Project, Task, TaskLog, TaskStatus } from '../types'
import { completedOn, taskProgress } from './progress'
import { todayISO } from './dates'

export interface EffState {
  start: string | null
  end: string | null
  progress: number | null
  status: TaskStatus
}

/**
 * The order two siblings sit in, whoever their parent is.
 *
 * Exported because this is the one definition of "which of these two comes
 * first", and three places ask it: the tree itself, the Gantt's roots (which put
 * the project ahead of everything and are otherwise exactly this), and Manage's
 * flat task list. Two of those used to be near-copies of the third, and a
 * near-copy that drops the `id` tiebreak disagrees the moment two tasks share a
 * start date and a name — which is precisely when the order starts to matter.
 */
export function compareSiblings(a: Task, b: Task): number {
  return (
    // The hand-set order first, *above* the to-do key, so a to-do dropped among
    // scheduled work stays where it was dropped. The two used to be the other way
    // round and it read as a rule — "to-dos come last" — that no drop could
    // overrule: the order key was never reached between a to-do and a task, so
    // dragging one up left it and every row around it looking as if the drag had
    // simply been refused.
    byOrder(a, b) ||
    // With nothing arranged, to-dos still sink: they have no start date to sort
    // by, and unscheduled work belongs after the scheduled work. `? 1 : 0`
    // rather than `Number(...)` because legacy records are `undefined` until
    // `normalize` backfills them, and a NaN comparator makes Array.sort's order
    // implementation-defined. This is also the key that keeps an untouched board
    // reading exactly as it did before any of this existed.
    (a.isTodo ? 1 : 0) - (b.isTodo ? 1 : 0) ||
    (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  )
}

/**
 * The hand-set order, when there are two of them to compare.
 *
 * Only meaningful between tasks that have both been placed by hand. A task with
 * no `order` has never been dragged, so it has no opinion about where it sits,
 * and falling through to the keys below is what leaves an untouched board
 * arranged exactly as it was. `moveTasks` renumbers a whole sibling list on
 * every drop, so a group is either wholly ordered or not ordered at all; the
 * mixed case reaches here only from a hand-edited import, where the date sort is
 * a fair answer.
 *
 * Deliberately not `(a.order ?? Infinity) - (b.order ?? Infinity)`: two
 * `undefined`s subtract to `NaN`, and a `NaN` comparator leaves `Array.sort`'s
 * order implementation-defined — the same trap the `? 1 : 0` above is written
 * the long way round to avoid.
 */
function byOrder(a: Task, b: Task): number {
  return a.order != null && b.order != null && a.order !== b.order ? a.order - b.order : 0
}

export function buildChildrenMap(tasks: Task[]): Map<string | null, Task[]> {
  const m = new Map<string | null, Task[]>()
  for (const t of tasks) {
    const k = t.parentId
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(t)
  }
  for (const list of m.values()) list.sort(compareSiblings)
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

/**
 * The board as it would be if these tasks were put in that place.
 *
 * Pure, and shared with the Gantt's drag preview — which is the point. What the
 * rows show while the pointer is down is produced by the same function that
 * produces what they become on release, so the preview cannot promise a
 * rearrangement the drop will not make. Two implementations of "where does this
 * go" would drift, and they would drift in the worst possible place: the one
 * moment the user is trusting the screen to tell the truth about a change they
 * cannot yet see.
 *
 * A task's place is four facts at once — which parent it hangs from, which
 * project that puts it in, where it sits among its new siblings, and where it no
 * longer sits among its old ones — and writing fewer than four leaves the board
 * in a state nobody could have asked for. The project is the one that bites:
 * leave it stale and the task is filed under a parent in another project, which
 * looks fine until the project filter is turned on and the row disappears from
 * the tree altogether.
 *
 * The unit is a subtree, because every parent is a container: moving one carries
 * its contents, and a task already inside another task that is moving is not
 * moved twice — it travels with its parent. `beforeId` is the sibling to land in
 * front of, or null for the end; the whole destination list is renumbered rather
 * than a gap being hunted for, because `order` is only ever read relative to its
 * own list.
 *
 * Returns null when the move is impossible — a container asked to hold itself, a
 * to-do asked to hold anything, an empty set of ids — and the caller does
 * nothing. `updatedAt` is deliberately not stamped: this is also the preview.
 */
export function placeTasks(
  tasks: Task[],
  ids: string[],
  parentId: string | null,
  beforeId: string | null,
  projectId: string,
): Task[] | null {
  // Deduplicated because `roots` becomes a run of rows in the destination list,
  // and the same id twice would put it there twice.
  const moving = [...new Set(ids)].filter((id) => tasks.some((t) => t.id === id))
  // What each moving task would carry, so a task inside another moving task is
  // recognised as cargo rather than as a second thing to place.
  const cargo = new Set<string>()
  for (const id of moving) for (const d of collectDescendants(tasks, id)) cargo.add(d)
  const roots = moving.filter((id) => !cargo.has(id))
  if (roots.length === 0) return null
  // The container cannot be one of the things being put inside it.
  if (parentId && (roots.includes(parentId) || cargo.has(parentId))) return null
  // A to-do is a holding pen, not a container — the same rule the dialog's
  // parent picker and the row's own "+" button already follow.
  const parent = parentId ? tasks.find((t) => t.id === parentId) : undefined
  if (parentId && (!parent || parent.isTodo)) return null

  const staying = new Set(roots)
  // Every task the move relocates: the roots plus everything hanging under them.
  // `cargo` already holds all of those — a task under a moving task that is
  // itself cargo is still under one of the roots.
  const whole = new Set([...roots, ...cargo])

  // The destination list as it stands, without the rows arriving in it. The
  // project belongs in the test at the top level and only there: every root task
  // in every project has `parentId === null`, so without it a task dropped
  // between two projects' roots would be numbered against both.
  const list = (
    parentId === null
      ? tasks.filter((t) => t.parentId === null && t.projectId === projectId)
      : tasks.filter((t) => t.parentId === parentId)
  )
    .filter((t) => !whole.has(t.id))
    .sort(compareSiblings)
  const arrived = roots.map((id) => tasks.find((t) => t.id === id)!)
  // `beforeId` naming something that is not in this list — a row the caller read
  // a frame ago, a sibling that moved in another window — lands at the end
  // rather than throwing the drop away.
  const at = beforeId ? list.findIndex((t) => t.id === beforeId) : -1
  const cut = at === -1 ? list.length : at
  const placed = [...list.slice(0, cut), ...arrived, ...list.slice(cut)]

  const patch = new Map<string, Partial<Task>>()
  placed.forEach((t, i) => patch.set(t.id, { order: i }))
  // The roots also change parent, project and place; the rows that were already
  // here only get renumbered, which is what `placed` just did.
  for (const id of roots) patch.set(id, { ...patch.get(id), parentId, projectId })
  // Everything below a root follows it into the new project and nothing else
  // about it changes — its own parent and its own place in that list are
  // untouched.
  for (const id of whole) if (!staying.has(id)) patch.set(id, { ...patch.get(id), projectId })

  return tasks.map((t) => {
    const p = patch.get(t.id)
    return p ? { ...t, ...p } : t
  })
}

/**
 * The names above a task, nearest parent first — the chain a list prints before
 * a row to say which branch it came from.
 *
 * `byId` is a parameter rather than a `tasks` array because both callers are
 * already walking a list of rows: building the index once per call is the
 * difference between one pass and one per row. `seen` is not decoration —
 * hand-edited data can hold a cycle, and without it this walk would not return.
 */
export function ancestorNames(
  task: { id: string; parentId: string | null },
  byId: Map<string, Task>,
): string[] {
  const out: string[] = []
  const seen = new Set([task.id])
  let p = task.parentId
  while (p != null && !seen.has(p)) {
    const parent = byId.get(p)
    if (!parent) break
    seen.add(p)
    out.push(parent.name)
    p = parent.parentId
  }
  return out
}

/**
 * The names above each row that a list has to show to keep two rows apart.
 *
 * A flat list has neither the Gantt's indentation nor its WBS column, so two
 * tasks called "联调" under different branches arrive as two rows of identical
 * text — and "which one is this" is exactly the question such a list has to
 * answer, because clicking the wrong one writes a log in the wrong place. The
 * day's task list and a parent's "still to log" list are both in that position.
 *
 * The answer is the chain of names above the row, spent from the nearest parent
 * outwards and **only as far as it takes**. Qualifying every row would put a
 * path in front of every name in a panel 320px wide; qualifying none leaves the
 * collision. So a row whose name is unique in this list gets an empty array and
 * is drawn as plain as it ever was, and a row that collides gets one more
 * ancestor each round until its group separates.
 *
 * Measured over the whole list handed in, not over the rows currently on
 * screen: a qualifier that appears and disappears as someone folds a branch is
 * worse than none, because it moves the thing being read.
 *
 * Returns the ancestor names to print before the row's own, nearest first, or an
 * empty array for a row that needs none. How they are joined is the caller's —
 * these are names, not a label.
 */
export function nameQualifiers(
  rows: { id: string; name: string; parentId: string | null }[],
  tasks: Task[],
): Map<string, string[]> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  // What each row has left to spend, nearest ancestor first.
  const chains = new Map<string, string[]>()
  for (const r of rows) chains.set(r.id, ancestorNames(r, byId))

  const spent = new Map<string, number>()
  const label = (r: { id: string; name: string }) =>
    [...(chains.get(r.id) ?? []).slice(0, spent.get(r.id) ?? 0), r.name].join('\u0000')

  // One pass per ancestor, and only the rows still colliding spend one. The
  // bound is the longest chain, which is also what makes it terminate when two
  // rows are identical all the way up — at that point there is no name left that
  // could tell them apart, and the list is showing the truth.
  const longest = Math.max(0, ...[...chains.values()].map((c) => c.length))
  for (let round = 0; round <= longest; round++) {
    const groups = new Map<string, typeof rows>()
    for (const r of rows) {
      const l = label(r)
      const g = groups.get(l)
      if (g) g.push(r)
      else groups.set(l, [r])
    }
    let spentAny = false
    for (const group of groups.values()) {
      if (group.length < 2) continue
      for (const r of group) {
        const have = spent.get(r.id) ?? 0
        if (have >= (chains.get(r.id) ?? []).length) continue
        spent.set(r.id, have + 1)
        spentAny = true
      }
    }
    if (!spentAny) break
  }

  return new Map(rows.map((r) => [r.id, (chains.get(r.id) ?? []).slice(0, spent.get(r.id) ?? 0)]))
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
  // Past its end date and unfinished. Used to be gated on `strictProgress`,
  // because a plain task's window elapsing *was* its completion — the calendar
  // finished it, so it could never be late. A plain task now advances only when
  // ticked off, so it can run out of window like any other. The `progress >= 100`
  // line above still settles the finished case first.
  if (task.type !== 'long-term' && task.endDate != null && today > task.endDate) return 'delayed'
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
      const status = deriveTaskStatus(t, progress, todayISO())
      // A finished task ends the day it finished, not the day it was meant to.
      // The bar is drawn from this, so a task done on the 8th of a window
      // running to the 20th was carrying twelve days of work it had already
      // handed in — and the parents rolled up from it were stretched to match,
      // since their span is read off their children's ends.
      //
      // Derived, not written into `endDate`: the plan is not the record. Every
      // consumer that means "how long was this meant to take" still reads the
      // stored field — the pause arithmetic, `countableDays`, the deadline the
      // Calendar marks — and a task taken back off `completed` gets its window
      // back, because nothing was overwritten.
      //
      // No floor is needed against a finish before the start: `completedOn`
      // cannot name one, because `taskProgress` reads "not started" on such a
      // day and that is not 100. The bar has one place this cannot go wrong, and
      // it is not here.
      const done = status === 'completed' ? completedOn(t, logs) : null
      r = {
        start: t.startDate,
        end: t.type === 'long-term' ? null : (done ?? t.endDate),
        progress,
        status,
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

/**
 * Auto-set each phase parent's dates to the span of its children.
 *
 * **Both ends, and the start is the half that was missing.** A phase parent is a
 * container: it has no window of its own, and `effectiveStates` has always
 * derived both ends from its children. Only the end was ever written back — so a
 * parent's stored `startDate` stayed wherever it was first put, and since
 * `TaskBar` draws the *stored* window rather than the derived one, dragging a
 * subtask to the right moved the subtask's bar while the parent's left edge
 * stayed put. That is the whole of the "a parent seems to have a minimum length"
 * report: not a clamp anywhere, just a stored date nobody was updating.
 *
 * No special case is needed for a parent whose children are all to-dos. Such a
 * parent is outside the roll-up (`effectiveStates` counts only the timed
 * children), so `eff.start` and `eff.end` fall back to the task's own dates and
 * this writes back exactly what it read — which is why `TaskDialog` leaves those
 * two fields editable in that one case.
 */
export function syncParentDates(tasks: Task[], logs: TaskLog[]): Task[] {
  const eff = effectiveStates(tasks, logs)
  let changed = false
  const next = tasks.map((t) => {
    // A to-do holds no dates at all — writing a derived one onto it would make
    // it half-scheduled.
    if (t.type === 'long-term' || t.isTodo || !hasChildren(tasks, t.id)) return t
    const e = eff.get(t.id)
    if (!e || (e.start === t.startDate && e.end === t.endDate)) return t
    changed = true
    return { ...t, startDate: e.start, endDate: e.end }
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
  /**
   * Set on the first to-do of an open folder — see `visitGroup`. The folder's
   * line is not drawn once it is open, and this is the mark that says which rows
   * below belong to it, and folds them again.
   */
  todoGroup?: { id: string; count: number }
}

// A folder-like header collecting the to-do children of one task. Synthesized by
// `buildRows` rather than stored as a task, so it can never be orphaned,
// renamed or re-parented, and it stays out of WBS numbering, statistics, project
// counts and export/import.
export interface RowTodoGroup {
  kind: 'todoGroup'
  id: string // see `todoGroupId` — doubles as the expand/collapse key
  parentId: string | null
  /**
   * Which project's to-dos these are.
   *
   * Carried for two reasons rather than for symmetry with the task rows. It is
   * half of the folder's key — root-level to-dos in one project used to share
   * `todogroup:root` with every other project's, so folding one folded them all.
   * And it is what a drop on this row has to hand `moveTasks`: the row is not a
   * task, so there is nothing else on it to ask.
   */
  projectId: string
  depth: number
  // How many character cells the WBS number beside this row would take, so the
  // placeholder drawn in that column is exactly as wide as the real numbers.
  wbsCells: number
  todoIds: string[]
}

/**
 * A project's line, the outermost container in the tree.
 *
 * A row `buildRows` synthesizes rather than a task, for the same reason the
 * to-do folder is one: a project is a place tasks sit, not work, and giving it a
 * row of its own is how that becomes visible — and foldable — without inventing
 * a `Task` behind it that the roll-ups would then have to know to ignore.
 *
 * It does not indent anything. A project is drawn as a band across the row, the
 * way a rule is, so the tasks under it keep the depths, the indent and the font
 * sizes they have always had.
 */
export interface RowProject {
  kind: 'project'
  id: string // see `projectRowId` — doubles as the expand/collapse key
  project: Project
  depth: 0
}

export type Row = RowTask | RowTodoGroup | RowProject

export const projectRowId = (projectId: string) => `project:${projectId}`

// The parent plus the project, because neither alone identifies a folder: two
// projects each have their own set of root-level to-dos, and one parent can hold
// none of the keys the other does.
export const todoGroupId = (parentId: string | null, projectId: string) =>
  `todogroup:${parentId ?? 'root'}:${projectId}`

// Every folder key implied by the current tasks: each parent with two or more
// to-do children, in each project. Used by expand/collapse all, which can't
// discover these ids by walking tasks alone.
//
// Counted over the whole sibling list rather than over the runs `buildRows`
// folds, which makes this a superset of the keys that are actually drawn: to-dos
// with a task between them are two runs of one and draw no folder at all, yet
// still count here. That is the safe direction — an unread key in `expanded`
// costs nothing, while a missing one would leave an open folder that
// "collapse all" could not close.
//
// A lone to-do has no folder — `buildRows` draws it as a plain row — so its
// parent has no key here either. The two have to agree on what a folder is, and
// they do it by asking the same question of the same count; the id is built by
// calling `todoGroupId` rather than by spelling the format out again, so they
// cannot come to disagree about that either.
export function todoGroupIds(tasks: Task[]): string[] {
  const counts = new Map<string, { parentId: string | null; projectId: string; n: number }>()
  for (const t of tasks) {
    if (!t.isTodo) continue
    const k = `${t.parentId ?? 'root'}\u0000${t.projectId}`
    const hit = counts.get(k)
    if (hit) hit.n++
    else counts.set(k, { parentId: t.parentId, projectId: t.projectId, n: 1 })
  }
  return [...counts.values()]
    .filter((c) => c.n > 1)
    .map((c) => todoGroupId(c.parentId, c.projectId))
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
    // Projects are grouped by the order the projects are listed in; `compareSiblings`
    // is everything else, and is the same function the project's own child lists
    // are sorted by, so a root and a subtask are ordered by one rule and not two.
    // The project key has to stay outside it, or the to-do key inside would sort
    // across projects and merge them into one run of rows.
    return pa - pb || compareSiblings(a, b)
  })

  const rows: Row[] = []

  const visit = (t: Task, depth: number, group?: { id: string; count: number }) => {
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
      todoGroup: group,
    })
    if (expanded[t.id] === false) return
    visitKids(t.id, t.projectId, depth + 1, kids)
  }

  /**
   * An unbroken run of one parent's to-do children, as rows.
   *
   * A folder is drawn only when it has something to fold away. A lone to-do is
   * an ordinary row: a folder line for it would spend a whole row saying "one",
   * and — being collapsed by default — would hide that row behind it.
   *
   * With two or more the folder gets a line of its own while it is closed. Open,
   * that line goes away rather than repeating what the rows under it already
   * say, and the folder's mark moves onto the first to-do's row instead
   * (`RowTask.todoGroup`). Which is also why the to-dos sit at the folder's own
   * depth once it is open: the line they used to hang from is the one that has
   * been taken away.
   */
  const visitGroup = (parentId: string | null, projectId: string, depth: number, todoKids: Task[]) => {
    if (todoKids.length === 0) return
    const gid = todoGroupId(parentId, projectId)
    if (todoKids.length === 1) {
      visit(todoKids[0], depth)
      return
    }
    // Folders are collapsed by default (tasks are expanded by default), so the
    // test is for an explicit `true` rather than the usual `!== false`.
    if (expanded[gid] !== true) {
      // The placeholder stands in for the WBS numbers of the rows inside, so
      // measure it off those — not off the row depth, which is inflated by every
      // folder above it and would run away from the real numbers.
      let wbsCells = 0
      for (const k of todoKids) wbsCells = Math.max(wbsCells, (wbs.get(k.id) ?? '').length)
      rows.push({ kind: 'todoGroup', id: gid, parentId, projectId, depth, wbsCells, todoIds: todoKids.map((k) => k.id) })
      return
    }
    const group = { id: gid, count: todoKids.length }
    todoKids.forEach((k, i) => visit(k, depth, i === 0 ? group : undefined))
  }

  /**
   * A parent's children in order, each unbroken run of to-dos handed to
   * `visitGroup` as a unit.
   *
   * A run is what a folder line can stand for — one collapsed line in place of
   * the rows beneath it. It used to be all of a parent's to-dos at once, and
   * that was the same thing only because they sank to the end of their list
   * whatever the sort key said. A to-do that has been given a place of its own
   * breaks that rule, which is the whole point of giving it one: with a task
   * between two to-dos, the folder would have to be drawn either before both or
   * after both, and either way it would stand where nothing is.
   *
   * A run of one is an ordinary row, so splitting a folder up costs nothing
   * visible — the rows are simply where they were put.
   */
  const visitKids = (parentId: string | null, projectId: string, depth: number, kids: Task[]) => {
    for (let i = 0; i < kids.length; ) {
      if (!kids[i].isTodo) {
        visit(kids[i], depth)
        i++
        continue
      }
      let j = i
      while (j < kids.length && kids[j].isTodo) j++
      visitGroup(parentId, projectId, depth, kids.slice(i, j))
      i = j
    }
  }

  /**
   * One project's roots, under that project's line.
   *
   * A project with nothing on it gets no line: a header standing over no rows
   * is a row spent saying "empty", and the projects list on the left is where
   * an empty project is a thing you can see.
   *
   * The tasks keep depth 0. The project's line is a band across the top of its
   * group rather than a step in the hierarchy — indenting everything under it
   * would have shrunk every name one size and pushed the whole tree right, to
   * say something the band already says.
   */
  const visitRoots = (project: Project | null, projectId: string, list: Task[]) => {
    if (list.length === 0) return
    if (project) {
      rows.push({ kind: 'project', id: projectRowId(project.id), project, depth: 0 })
      // Expanded by default, like tasks and unlike the to-do folders, so this
      // is an explicit `false` that folds it.
      if (expanded[projectRowId(project.id)] === false) return
    }
    visitKids(null, projectId, 0, list)
  }

  // The roots per project, not the tasks per project: `byProj` above holds every
  // task and is only good for numbering. Handing its lists to `visitRoots` would
  // draw each child once under its parent and again as a root of its own.
  const rootsByProject = new Map<string, Task[]>()
  for (const r of roots) {
    const list = rootsByProject.get(r.projectId)
    if (list) list.push(r)
    else rootsByProject.set(r.projectId, [r])
  }

  for (const p of projects) visitRoots(p, p.id, rootsByProject.get(p.id) ?? [])
  // Roots whose project is not in the list — a hand-edited import, or a board
  // written by a build whose project was deleted since. They have no line to
  // hang under, so they stand at the top after every project, which is where
  // the `?? 999` in the sort above already put them.
  for (const [pid, list] of rootsByProject) {
    if (!projects.some((p) => p.id === pid)) visitRoots(null, pid, list)
  }
  return rows
}
