import { DaySortMode, Project, Task, TaskLog, TaskPriority, TaskStatus } from '../types'
import { ancestorNames, buildChildrenMap, collectDescendants, computeProjectWbs, deriveStatus, deriveTaskStatus, isArchived, liveTasks } from './tree'
import { isPausedOnDay, taskProgress } from './progress'
import { addDays, toDate, toISO } from './dates'

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
  /**
   * Names above this row, nearest parent first — what the list prints under it
   * to say which branch it came from. Empty for a top-level task.
   */
  parents: string[]
  progress: number | null
  status: TaskStatus
  strict: boolean
  /** The mirror of `strict`: a simplified leaf, the row a tick box belongs on. */
  plain: boolean
  active: boolean
  hasLog: boolean
  /** Whether this day is already ticked off (`plain` rows only). */
  confirmedOnDay: boolean
  /** Whether the day can still be ticked — it happened, and the task was on. */
  tickable: boolean
  pausedToday: boolean
  overdue: boolean
}

/**
 * Whether a row on the day's list is struck through: this one is done with.
 *
 * Two ways to be done with, and only one of them was being read. A log written
 * **today** strikes the row it is about, even at 35%: the ring printed over the
 * list counts exactly those logs, and a row it credited that read as untouched
 * would put the list at odds with the number above it.
 *
 * Being **finished** strikes the row whatever today's log says. The list keeps a
 * finished task only on the day it was finished, and a simplified task's day can
 * be ticked through with no log at all — so striking on today's log alone left
 * the plainest kind of finished work reading as untouched: finished, listed, and
 * owing nothing. See `DayRow.status`, which is the day's own reading of the task
 * and reads `completed` for exactly these rows.
 *
 * Here rather than in the row that draws it, so the rule can be asserted
 * (`check-day-obligations.mjs`) instead of inspected: the two halves agree by
 * construction on every row this is asked about, and a row that is wrong is one
 * line of text that looks like all the others.
 */
export function dayRowStruck(row: DayRow): boolean {
  return row.status === 'completed' || row.hasLog
}

export interface DaySummary {
  /**
   * Every row, in one order — the list the day actually renders.
   *
   * The day used to be drawn as two lists, strict and not, and the split was
   * the whole point: it put what owed a log at the top. It is now one list with
   * a mark on the rows that owe one, so the order has to be the single sort
   * below rather than strict-block-then-rest, which would look arbitrary.
   */
  all: DayRow[]
  /** The two halves of `all`, kept for the counts that are still asked for. */
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

/** Highest first. A missing priority (legacy rows) sits below `low`. */
const PRIORITY_RANK: Record<TaskPriority, number> = { top: 0, high: 1, medium: 2, low: 3 }
const priorityRank = (t: Task) => (t.priority ? PRIORITY_RANK[t.priority] : 4)

// Clip for consumers that enumerate log rows, rather than calculate progress.
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
 * about a past day, and a parent's dates have already been synced into
 * `task.startDate` / `task.endDate` by `syncParentDates`.
 */
export function activeOnDay(task: Task, day: string): boolean {
  if (task.isTodo || task.startDate == null) return false
  if (task.startDate > day) return false
  // A null end means open-ended (a long-term goal, or a parent whose end is not
  // resolved yet) — not "never active".
  return task.endDate == null || day <= task.endDate
}

// `isPausedOnDay` is re-exported rather than defined here: it is a question
// about a task's schedule, and this is where the day machinery lives, but the
// progress denominator needs it too and this module already depends on
// `progress.ts` — the other direction would be a cycle. Definition and rationale
// live there.
export { isPausedOnDay }

/**
 * A task that keeps no log and therefore carries the simplified progress: the
 * mirror of `isStrictLeaf` below. Its day is ticked off by hand instead of
 * written up, so this is the predicate for "does a tick box belong on this row".
 *
 * Same leaf rule, and for the same reason: a parent's progress is the average of
 * its children's, so a tick on one would be a number nothing reads.
 */
export function isNonStrictLeaf(task: Task, children: Map<string | null, Task[]>): boolean {
  return (
    !task.isTodo &&
    task.type === 'phase' &&
    !task.strictProgress &&
    (children.get(task.id) ?? []).length === 0
  )
}

/**
 * The tasks a log's progress field means something on. Exported because
 * `LogDialog` has to ask the same question before it offers the field — a
 * mandatory field on a task whose value nothing reads is the worst version of
 * this duplication.
 *
 * `strictProgress` is inert on parents — only leaves ever feed `taskProgress`.
 */
export function isStrictLeaf(task: Task, children: Map<string | null, Task[]>): boolean {
  return (
    !task.isTodo &&
    task.type === 'phase' &&
    task.strictProgress &&
    (children.get(task.id) ?? []).length === 0
  )
}

/**
 * Whether a strict task has come due on `day` — it has begun, and that is all.
 *
 * Deliberately *not* `activeOnDay`, which additionally asks whether the window
 * still covers the day. That upper bound is right for "what is scheduled today"
 * and wrong for "what owes a log today": a strict task that ran out of time
 * unfinished does not stop needing a log the moment its end date passes. It is
 * precisely then that it becomes the most urgent thing on the board, and a
 * backlog that stops being counted is a backlog that gets ignored.
 *
 * So the start is the only bound that survives. A task that has not begun owes
 * nothing yet, and one with no start at all is not scheduled work.
 */
function hasComeDue(task: Task, day: string): boolean {
  return task.startDate != null && task.startDate <= day
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

/**
 * Progress as of the day *before* `day` — i.e. "was this already finished when
 * the day began".
 *
 * `taskProgress` owns the date cutoff for both strict and simplified tasks.
 * Reuse its log index instead of allocating a clipped board for every leaf.
 */
function progressBefore(task: Task, clipped: TaskLog[], day: string): number {
  const before = addDays(toDate(day), -1)
  return taskProgress(task, clipped, before) ?? 0
}

/** One strict leaf that owed a log on a day, and whether it got one. */
export interface LogObligation {
  task: Task
  logged: boolean
}

/**
 * The day's chosen ids as a set, with planned containers expanded to their
 * descendants.
 *
 * `undefined` means the day has no plan and every old rule still applies —
 * distinct from an empty set, which is a planned rest day. The expansion is
 * what keeps a plan meaningful when a planned leaf later grows children: the
 * branch it became is still the work that was chosen.
 */
export function plannedIdSet(tasks: Task[], planned?: readonly string[]): Set<string> | null {
  if (planned === undefined) return null
  const set = new Set(planned)
  for (const id of planned) for (const d of collectDescendants(tasks, id)) set.add(d)
  return set
}

/**
 * The strict leaves that owed a log on `day`, and which of them got one.
 *
 * Kept separate from `strictLogRate` so that anything else asking "what is still
 * to be logged" gets the *same* answer the ring and the Calendar are drawn from.
 * A second copy of these conditions would drift, and the drift would show as a
 * list disagreeing with the ring printed beside it.
 *
 * The conditions are, in order: a strict leaf (`strictProgress` is inert on a
 * parent — its progress is the average of its children's); *come due* (which,
 * unlike `activeOnDay`, keeps an overdue task on the list — see `hasComeDue`);
 * not paused that day; not already finished when the day began; and not already
 * logged. That fourth one is why a finished task never comes back to nag.
 */
export function strictLogObligations(
  tasks: Task[],
  logs: TaskLog[],
  day: string,
  planned?: readonly string[],
): LogObligation[] {
  const clipped = logsUpTo(logs, day)
  const logged = loggedOnDay(logs, day)
  const children = buildChildrenMap(tasks)
  const plan = plannedIdSet(tasks, planned)
  const owed: LogObligation[] = []
  for (const t of tasks) {
    if (!isStrictLeaf(t, children)) continue
    // A plan narrows the day; it never resurrects work the day's window does
    // not cover. An unplanned strict task owes nothing today — and no entry is
    // written for it anywhere.
    if (plan && !plan.has(t.id)) continue
    // Filed away work owes nothing, and this is the one place the archive is
    // kept out of a *number* rather than out of a list. It is not an exception
    // to the rule that filing away changes what is shown and not what is
    // counted — it is the rule applied: the count is of what the day's list
    // owes, and the day's list no longer holds this row. Leaving it in would
    // put a permanent amber ring over a day with nothing behind it, because the
    // box that used to satisfy the obligation went into the archive too.
    if (isArchived(t)) continue
    if (!hasComeDue(t, day)) continue
    // Paused work is not the day's work, so it owes no log.
    if (isPausedOnDay(t, day)) continue
    // A task already finished when the day started owes no log either — tested
    // against the *previous* day so the rate stays monotonic. Testing against
    // the day itself would evict a task the moment its log completed it,
    // turning 3/5 into 3/4 and reading as a regression.
    if (progressBefore(t, clipped, day) >= 100) continue
    owed.push({ task: t, logged: logged.has(t.id) })
  }
  return owed
}

/**
 * Whether anything under `rootId` — itself included — is a strict leaf.
 *
 * Answers "does logging mean anything here?", which is different from "is
 * anything owed today": a branch of plain phase tasks never owes a log, and
 * telling its parent "all strict work is logged" every day would be a green
 * light that means nothing — the fastest way to teach someone to ignore it.
 * Deliberately not a "no obligations today" test either, since a branch whose
 * strict work is all finished should still read as done rather than vanish.
 */
export function hasStrictLeafUnder(tasks: Task[], rootId: string): boolean {
  const children = buildChildrenMap(tasks)
  const ids = new Set([rootId, ...collectDescendants(tasks, rootId)])
  return tasks.some((t) => ids.has(t.id) && isStrictLeaf(t, children))
}

/**
 * How much of the day's strict work has been logged: the tasks that owed a log
 * on `day` versus the ones that got one.
 */
export function strictLogRate(
  tasks: Task[],
  logs: TaskLog[],
  day: string,
  planned?: readonly string[],
): StrictLogRate {
  const owed = strictLogObligations(tasks, logs, day, planned)
  const total = owed.length
  const done = owed.filter((o) => o.logged).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/**
 * Whether a branch holds a strict leaf the day actually planned.
 *
 * `hasStrictLeafUnder` answers the structural question ("does logging mean
 * anything here"); this answers the day's ("is anything here on today's
 * plan"). The task panel needs the second one to avoid telling someone every
 * strict task under a branch is logged when none of them was planned.
 */
export function plannedStrictLeafUnder(
  tasks: Task[],
  rootId: string,
  planned: Set<string>,
): boolean {
  const children = buildChildrenMap(tasks)
  const ids = new Set([rootId, ...collectDescendants(tasks, rootId)])
  return tasks.some(
    (t) => ids.has(t.id) && planned.has(t.id) && !isArchived(t) && isStrictLeaf(t, children),
  )
}

/**
 * The tasks under `rootId` — itself included — that still owe a log on `day`.
 *
 * Order is the Gantt's: the root first, then its descendants in DFS pre-order
 * (`collectDescendants`), so a list built from this reads as the same tree the
 * user sees. `strictLogObligations` iterates store order instead, which is why
 * the result is assembled by walking the ids rather than by filtering its output
 * in place.
 *
 * A parent is never in the result: `strictProgress` is inert on anything with
 * children, so a parent is not a strict leaf and owes nothing itself.
 */
export function pendingLogsUnder(
  tasks: Task[],
  logs: TaskLog[],
  day: string,
  rootId: string,
  planned?: readonly string[],
): Task[] {
  const owed = new Map(strictLogObligations(tasks, logs, day, planned).map((o) => [o.task.id, o]))
  const out: Task[] = []
  for (const id of [rootId, ...collectDescendants(tasks, rootId)]) {
    const o = owed.get(id)
    if (o && !o.logged) out.push(o.task)
  }
  return out
}

/**
 * The chain to print in front of a row's own name: where it sits, in the order a
 * path is read.
 *
 * `parents` arrives nearest-first, because that is the order the rest of the app
 * spends it in — a path is read top-down, so this is where the reversal happens.
 *
 * A deep row is elided in the middle, `A › (...) › B`, keeping the two ends.
 * Those two are the ones that answer anything: the top says which branch the row
 * came from, and the immediate parent says which of several same-named rows this
 * is. Everything between them is a step nobody was asking about, and the list is
 * drawn in a panel a few hundred pixels wide — a full chain spends the row's
 * width naming places the reader has already walked past.
 */
export function parentPath(parents: string[]): string[] {
  if (parents.length <= 2) return [...parents].reverse()
  return [parents[parents.length - 1], '(...)', parents[0]]
}

export interface DayMilestones {
  /** Leaf tasks beginning on `day`. */
  starts: Task[]
  /** Leaf tasks whose last day is `day`. */
  due: Task[]
}

/**
 * What begins and what lands on `day` — the calendar cell's contents.
 *
 * Leaves only. A parent's start and end are rolled up from its children
 * (`effectiveStates` takes the earliest start and the latest end), so listing a
 * phase alongside the child that produced those dates would spend a row saying
 * the same thing twice. Every other count in the app is taken over leaves too.
 *
 * A task that both begins and ends on `day` is filed under `due` alone: for a
 * one-day task the deadline is the fact worth a row.
 *
 * Status comes from `eff`, which is always *today's* reading — a past day's
 * chip therefore shows the task's current colour, not the colour it had then.
 */
export function milestonesOnDay(
  tasks: Task[],
  // Only the status is ever read, out of either state map: `EffState` from
  // `effectiveStates` (today's reading, for the calendar) or `DayEffState` from
  // `dayStates` (any day, which is what the reminder digest renders ahead of
  // time). Naming what is actually used rather than the wider type is what lets
  // both callers pass what they already have, and it is why `EffState` is no
  // longer imported here.
  eff: Map<string, DayEffState>,
  day: string,
): DayMilestones {
  const children = buildChildrenMap(tasks)
  const starts: Task[] = []
  const due: Task[] = []
  for (const t of tasks) {
    if (t.isTodo) continue
    // A milestone chip is a list of names on a day cell, so it takes the same
    // rule the day's own list does: a filed-away task has no name to print
    // there.
    if (isArchived(t)) continue
    if ((children.get(t.id) ?? []).length > 0) continue
    if (t.endDate === day) due.push(t)
    else if (t.startDate === day) starts.push(t)
  }
  const rank = (t: Task) => STATUS_RANK[eff.get(t.id)?.status ?? 'not-started']
  const by = (a: Task, b: Task) =>
    rank(a) - rank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  return { starts: starts.sort(by), due: due.sort(by) }
}

export type DayCellState =
  | { kind: 'future' }
  | { kind: 'empty' } // 当天什么都没排，不该被评判
  | { kind: 'clear' } //已过去或就是今天，当天有任务、但没有严格任务要写
  | { kind: 'owed'; done: number; total: number } // 有义务，一条没写（done 恒为 0）
  | { kind: 'partial'; pct: number; done: number; total: number }
  | { kind: 'full'; done: number; total: number }

/**
 * Which of the calendar's cell states a day is in.
 *
 * `strictLogRate` is deliberately left untouched: it answers "how much of that
 * day's strict work was logged", and it gives the same answer for a day that has
 * not arrived yet — nothing is logged, so `done` is 0, and every task whose
 * window covers that day counts toward `total`. Whether the day has *happened*
 * is a presentation question, and it is settled here. Without that split, every
 * remaining day of the month would read as work missed.
 *
 * `worked` is the one thing the rate cannot say: whether anything was *on* the
 * day at all. The two are not the same question, and the difference only shows
 * on a day with nothing owed (`total === 0`), which is both "the work was done
 * and accounted for" and "nothing was ever here". Both used to wear the same
 * green ring — which is what a calendar of green boxes on days off was.
 *
 * Deliberately not a gate on this function: `total > 0` days are never 'clear'
 * whatever `worked` says, so the overdue backlog — a strict task that goes on
 * owing past its own end date, when `activeOnDay` is already false — cannot be
 * hidden by this. Filtering the *computation* on "was anything on the day" did
 * exactly that, and worse: a strict leaf owes a log every day from its start
 * until it is finished, so that filter passes every day after the first one.
 */
export function dayCellState(
  day: string,
  today: string,
  rate: StrictLogRate,
  worked: boolean,
): DayCellState {
  // yyyy-MM-dd sorts chronologically as a string.
  if (day > today) return { kind: 'future' }
  if (rate.total === 0) return worked ? { kind: 'clear' } : { kind: 'empty' }
  if (rate.done === 0) return { kind: 'owed', done: 0, total: rate.total }
  if (rate.done === rate.total) return { kind: 'full', done: rate.done, total: rate.total }
  return { kind: 'partial', pct: rate.pct, done: rate.done, total: rate.total }
}

/**
 * The day's task list, in the order the caller asked for. Everything scheduled
 * on the day is listed — long-term goals, paused tasks and completed ones
 * included; the panel decides how to mark them.
 */
export function daySummary(
  tasks: Task[],
  logs: TaskLog[],
  projects: Project[],
  day: string,
  today: string,
  sort: DaySortMode = 'status',
  planned?: readonly string[],
): DaySummary {
  const clipped = logsUpTo(logs, day)
  const states = dayStates(tasks, logs, day)
  const plan = plannedIdSet(tasks, planned)
  const children = buildChildrenMap(tasks)
  const logged = loggedOnDay(logs, day)
  const order = new Map(projects.map((p, i) => [p.id, i]))

  // Numbering restarts per project, matching what the Gantt shows — and is
  // computed over the live tasks for the same reason: a filed-away task has
  // given its number up, exactly as a deleted one has.
  const wbs = computeProjectWbs(liveTasks(tasks))

  // A task that holds nothing but to-dos is a to-do list, not work of its own:
  // it is treated as a to-do here and so stays out of the day's list, exactly
  // as its children do. It keeps its row on the board — this rule is about
  // what the day is asked to account for.
  const todoBucket = (t: Task) => {
    const kids = children.get(t.id) ?? []
    return kids.length > 0 && kids.every((k) => k.isTodo)
  }

  const rows: DayRow[] = []
  for (const t of tasks) {
    // Filed away work is not a day's work: same rule as the board, and for the
    // same reason. Everything below this line — the states, the rates, the
    // parent roll-up the rows are annotated with — still runs over every task,
    // so archiving a finished branch moves no number on any card.
    if (t.isTodo || isArchived(t) || t.startDate == null || todoBucket(t)) continue
    // Already finished when the day began: it belongs to the day it was
    // finished and to no later one. The test is `progressBefore`, so that day
    // still lists it (the number reaches 100 on it) while the rest of the
    // original window — which completing early does not shorten — stops
    // carrying a row for work that is over.
    if (progressBefore(t, clipped, day) >= 100) continue
    const st = states.get(t.id)
    if (!st) continue
    const active = activeOnDay(t, day)
    const strict = isStrictLeaf(t, children)
    const plain = isNonStrictLeaf(t, children)
    const pausedToday = isPausedOnDay(t, day)
    // A task that ran out of window without finishing drops off its own
    // schedule, which would hide the most urgent work of all. It is listed with
    // an overdue badge — and, since `hasComeDue` keeps it owing a log, it is
    // counted in the ring and marked like any other outstanding task.
    // The two agree because they are the same question asked twice. A simplified
    // task gets the same treatment now that the calendar no longer finishes it
    // on its own.
    const overdue = !active && (strict || plain) && st.status === 'delayed'
    if (!active && !overdue) continue
    // The plan narrows what was already the day's work; it never adds a task
    // whose window does not cover the day. Applied after the active/overdue
    // decision for exactly that reason.
    if (plan && !plan.has(t.id)) continue
    rows.push({
      task: t,
      wbs: wbs.get(t.id) ?? '',
      // Filled in once the walk below has settled the order, and only for the
      // rows that survive the leaf filter — a chain walked for a row that is
      // about to be dropped is a walk spent on nothing.
      parents: [],
      progress: st.progress,
      status: st.status,
      strict,
      plain,
      active,
      hasLog: logged.has(t.id),
      confirmedOnDay: (t.confirmedDays ?? []).includes(day),
      // A day can be ticked while it is happening or after the fact — that is
      // how a missed day gets backfilled — but never before it arrives, and
      // never on a day the task was off.
      tickable: plain && active && !pausedToday && day <= today,
      pausedToday,
      overdue,
    })
  }

  const byStatus = (a: DayRow, b: DayRow) => STATUS_RANK[a.status] - STATUS_RANK[b.status]
  const byPriority = (a: DayRow, b: DayRow) => priorityRank(a.task) - priorityRank(b.task)
  // The chosen key first, the other second, so rows sharing a status stay
  // together under "status" and rows sharing a priority stay together under
  // "priority". A log obligation (the `*`) is the third key: it still puts the
  // rows that owe something at the front of their group, but it no longer
  // splits the whole list in two — that split is what kept a status from ever
  // being one run.
  //
  // Finished rows are last in both orders: this is a worklist, and what is done
  // is the record of it, not the next thing to pick up.
  const cmp = (a: DayRow, b: DayRow) =>
    (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0) ||
    (sort === 'priority' ? byPriority(a, b) || byStatus(a, b) : byStatus(a, b) || byPriority(a, b)) ||
    (a.strict ? 0 : 1) - (b.strict ? 0 : 1) ||
    (a.task.endDate ?? '9999-12-31').localeCompare(b.task.endDate ?? '9999-12-31') ||
    (order.get(a.task.projectId) ?? 999) - (order.get(b.task.projectId) ?? 999) ||
    a.wbs.localeCompare(b.wbs, undefined, { numeric: true }) ||
    a.task.name.localeCompare(b.task.name) ||
    a.task.id.localeCompare(b.task.id)

  const ordered = [...rows].sort(cmp)

  let logCount = 0
  for (const l of logs) if (l.date === day) logCount++

  // Only the tasks that do the work.
  //
  // A parent is a container: `effectiveStates` derives its dates from its
  // children, so a row for it was a line of the day spent saying what the rows
  // indented under it were already saying. It is an annotation on them instead —
  // which is also why the count over this list is now "how much is on the day"
  // rather than "how many rows a tree takes to draw it".
  //
  // A child that is itself a to-do does not make a container. To-dos are
  // unscheduled and take no part in the roll-up, so a task whose children are
  // all to-dos keeps its own dates and is a leaf here, exactly as `TaskDialog`
  // treats it when it leaves those dates editable.
  const containers = new Set<string>()
  for (const t of tasks) if (t.parentId != null && !t.isTodo) containers.add(t.parentId)
  const taskById = new Map(tasks.map((t) => [t.id, t]))
  const leaves = ordered.flatMap((r) =>
    containers.has(r.task.id) ? [] : [{ ...r, parents: ancestorNames(r.task, taskById) }],
  )

  return {
    all: leaves,
    strict: leaves.filter((r) => r.strict),
    nonStrict: leaves.filter((r) => !r.strict),
    ring: strictLogRate(tasks, logs, day, planned),
    logCount,
  }
}
