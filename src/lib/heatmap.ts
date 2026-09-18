import { Chore, Task, TaskLog } from '../types'
import { buildChildrenMap, collectDescendants } from './tree'
import { activeOnDay, isPausedOnDay } from './dayTasks'

/**
 * What a heatmap's days are made of.
 *
 * A task is *done* on a day when its work for that day is finished: logged, for
 * a strict task; elapsed, for any other. The question is answered per day and
 * per task, and the counting is left to the caller — the task panel asks "was
 * this day clean" (one task's day is done or it isn't) while Manage asks "how
 * much got done" (a whole board's day has a size).
 *
 * The rule lives on its own rather than inside the panel that draws it because
 * two surfaces ask it, over two different scopes. Two copies would drift, and
 * the drift would show as the same week of the same board shaded two different
 * ways.
 *
 * `activeOnDay` / `isPausedOnDay` are borrowed from the day machinery rather
 * than restated: "was this task on that day" is the same question whichever
 * page is asking it.
 */

/**
 * A leaf that carries a schedule of its own — the unit a day can be done for.
 *
 * Long-term goals are out for the same reason they have no progress anywhere
 * else in the app, and a to-do has no schedule to be active in.
 */
function isScheduledLeaf(task: Task, children: Map<string | null, Task[]>): boolean {
  return !task.isTodo && task.type !== 'long-term' && (children.get(task.id) ?? []).length === 0
}

/** Leaves of `tasks` that a day's completion can be read from. */
function scheduledLeaves(tasks: Task[], children: Map<string | null, Task[]>): Task[] {
  return tasks.filter((t) => isScheduledLeaf(t, children))
}

export interface DayTally {
  /** Tasks scheduled on the day, with paused ones left out. */
  total: number
  /** Of those, the ones finished by the end of that day. */
  done: number
}

/**
 * What each of `days` tallied for `scope`. Every day asked about gets an entry,
 * including the ones nothing was scheduled for, so a caller never has to tell
 * "no answer" from "nothing on".
 *
 * Every log indexed by task in one pass: asking per leaf instead would walk the
 * whole log list once for each of them.
 */
function dayTallies(logs: TaskLog[], today: string, scope: Task[], days: string[]): Map<string, DayTally> {
  const out = new Map<string, DayTally>()

  const logged = new Map<string, Set<string>>()
  for (const l of logs) {
    let s = logged.get(l.taskId)
    if (!s) { s = new Set(); logged.set(l.taskId, s) }
    s.add(l.date)
  }

  for (const day of days) {
    let total = 0
    let done = 0
    for (const t of scope) {
      if (!activeOnDay(t, day) || isPausedOnDay(t, day)) continue
      total++
      // Both kinds of task are done on a day because a person said so: a log for
      // the strict ones, a tick for the rest. The plain case used to read
      // `day < today` — the calendar crediting every elapsed day to a task
      // nobody had touched, which flattened this whole board into one shade on
      // any board carrying a few of them.
      const hit = t.strictProgress
        ? logged.get(t.id)?.has(day) === true
        : (t.confirmedDays ?? []).includes(day)
      if (hit) done++
    }
    out.set(day, { total, done })
  }
  return out
}

/** A day's tally for the branch rooted at `rootId`, itself included. */
export function branchDayTallies(
  tasks: Task[],
  logs: TaskLog[],
  today: string,
  rootId: string,
  days: string[],
): Map<string, DayTally> {
  const children = buildChildrenMap(tasks)
  const ids = new Set([rootId, ...collectDescendants(tasks, rootId)])
  const scope = scheduledLeaves(tasks.filter((t) => ids.has(t.id)), children)
  return dayTallies(logs, today, scope, days)
}

/**
 * A day's tally for the whole board — every scheduled leaf in every project,
 * plus every chore ticked off. Manage's overview reads this.
 *
 * Chores are counted here and only here. `branchDayTallies` is a view down one
 * branch of the task tree, and a chore belongs to no branch — it is not a task,
 * has no project and no parent — so there is nothing to scope one to.
 *
 * A chore is credited to the day it was **ticked**, not the day it was written
 * for. Chores carry their original day through a slip, so counting by `date`
 * would let finishing Monday's chore on Tuesday turn Monday green after the
 * fact — a day that genuinely passed with the work undone.
 *
 * Only `done` moves; `total` stays with the scheduled leaves. The board shades
 * by `done` alone, and giving chores a `total` would mean inventing an answer to
 * "which day was this chore scheduled for" that nothing asks.
 */
export function boardDayTallies(
  tasks: Task[],
  logs: TaskLog[],
  chores: Chore[],
  today: string,
  days: string[],
): Map<string, DayTally> {
  const out = dayTallies(logs, today, scheduledLeaves(tasks, buildChildrenMap(tasks)), days)
  for (const c of chores) {
    // `days` is a window, not all of time: a chore ticked before it starts has
    // no square to land on, and must not fall through to one.
    const hit = c.completedDate !== null ? out.get(c.completedDate) : undefined
    if (hit) hit.done++
  }
  return out
}
