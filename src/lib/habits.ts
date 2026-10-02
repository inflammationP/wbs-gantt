import { Habit } from '../types'
import { toDate, weekdayIndex } from './dates'
import { isPausedOnDay } from './progress'

/**
 * Which habits a day shows.
 *
 * A file of its own rather than a corner of `chores.ts`, although the two answer
 * the same shape of question. The rules are opposites: a chore that is not done
 * carries forward and its `date` keeps saying which day it was meant for, while
 * a habit runs on the days it was set for and carries nothing. `chores.ts` opens
 * with a doc comment about exactly that carrying, so a habit rule living there
 * would sit under a heading that describes the other case.
 *
 * Shared rather than inlined at the places that ask, for the reason the chore
 * module gives: the Today page's two columns and the day panel have to agree
 * about which day a habit belongs to. Written separately they would drift, and
 * the drift would show as a habit one screen has and another does not — which is
 * exactly the bug `runsOn` was extracted to fix.
 */

/** Every day of the week, Monday-first — what "每天" is stored as. */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/**
 * Oldest start date first; within a day, the order they were added. The chore
 * side's `byPlan`, over a `startDate` that is never rewritten.
 */
export function byStart(a: Habit, b: Habit): number {
  return (
    a.startDate.localeCompare(b.startDate) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

/**
 * Whether `habit` runs on `day` — the whole day rule, in one place.
 *
 * Four conditions, all of them about the day and none of them about whether the
 * habit was done:
 *
 *  - **Started.** Strictly `>=` `startDate`, with no carry in either direction.
 *    A habit put on today must not appear in yesterday's record, which is why
 *    `startDate` is stored rather than derived from `createdAt` — an instant,
 *    and not the day anyone chose.
 *  - **Not finished with.** `day <= endDate`, inclusive, matching `Task.endDate`.
 *  - **One of its days.** Membership of `weekdays`, which is never empty and is
 *    Monday-first. A Mon/Wed/Fri habit is simply *not on* Tuesday — it is not
 *    shown greyed, because a line on Tuesday claims Tuesday was a day it was
 *    meant to be done, and it inflates whatever that day counts.
 *  - **Not suspended.** `isPausedOnDay`, so a pause covers the days it actually
 *    covered. This is the one condition that is about a *range* of days rather
 *    than the day itself, which is why `pauses` is kept as history: lift a pause
 *    and the days under it must stay off the list, or they come back reading as
 *    days the habit was skipped.
 *
 * Exported because the store's `toggleHabit` asks it too: a tick on a day the
 * habit does not run is a fact the data should never learn, and asking the same
 * function is what keeps "can this be shown" and "can this be ticked" one answer.
 */
export function runsOn(habit: Habit, day: string): boolean {
  return (
    habit.startDate <= day &&
    (habit.endDate == null || day <= habit.endDate) &&
    habit.weekdays.includes(weekdayIndex(toDate(day))) &&
    !isPausedOnDay(habit, day)
  )
}

/**
 * `day`'s habits, tick state and all — the flat reading, for a board with no
 * routine tree on it.
 *
 * Every habit that runs that day, not only the ticked ones. A day's record has
 * to show a habit that was not done as plainly as one that was — a list of
 * nothing but successes is the version of this that lies.
 *
 * Nothing in `src/` calls this any more: a day's list is `routineRows`, which
 * needs the whole collection to work out which headings belong on the day. It
 * stays because it is the flat answer written independently of the tree, and
 * `check-habits.mjs` holds the two against each other — which is what catches a
 * tree walk that has quietly started filtering, or ordering, differently.
 */
export function habitsOn(habits: Habit[], day: string): Habit[] {
  return habits.filter((h) => runsOn(h, day)).sort(byStart)
}

/** Whether this habit was ticked on `day`. */
export function tickedOn(habit: Habit, day: string): boolean {
  return habit.doneDays.includes(day)
}

/**
 * Every routine under `id`, itself included.
 *
 * What deleting one takes with it, and what the editor's parent picker has to
 * leave out: a routine cannot be filed under itself or under anything it holds.
 * `collectDescendants` is the task side's version of this and is not reusable —
 * it walks `parentId` over `Task`, and a routine's children are a different
 * collection with a different order.
 */
export function habitBranch(habits: Habit[], id: string): Set<string> {
  const out = new Set([id])
  // Repeated sweeps rather than recursion: a cycle in hand-edited data would run
  // a recursive walk forever, while this stops when a pass adds nothing.
  for (let grew = true; grew; ) {
    grew = false
    for (const h of habits) {
      if (h.parentId != null && out.has(h.parentId) && !out.has(h.id)) {
        out.add(h.id)
        grew = true
      }
    }
  }
  return out
}

/**
 * A routine as one line of a list, flattened into the order it is drawn.
 *
 * `hasKids` is the whole difference between the two kinds of line: a routine
 * with a child on this list is a heading whose tick is theirs, and one without
 * is the thing you actually tick.
 */
export interface RoutineRow {
  habit: Habit
  /** How far in to draw it. A routine at the top is 0. */
  depth: number
  /** Whether it has a child on this list, which is what makes it a heading. */
  hasKids: boolean
  /** Whether it counts as done — see `routineRows`. */
  done: boolean
  /**
   * The days of the week this row is on, Monday-first and sorted — the same
   * shape `Habit.weekdays` is stored in.
   *
   * A leaf's own list, and for a heading the **union of everything under it**:
   * it holds no days of its own to be read, exactly as it holds no tick, so
   * "when is this group running" is the answer this has to carry. Printed, not
   * decided by — a day's list still comes from `runsOn` over the children, and
   * this says which days of the week those children cover, with their pauses
   * and end dates left to the same badges a leaf's own row carries.
   */
  weekdays: number[]
  /** Whether the caller's fold state has it open, so the children are below it. */
  open: boolean
}

/**
 * The routines to draw, in order, tree and all.
 *
 * `day` is null on the roster (the Manage page), which asks a different question
 * of the same list: everything is shown and nothing is done. Otherwise the day
 * rules apply, and the three of them are:
 *
 *  - **A routine with no children is a leaf**, and behaves exactly as it did
 *    before there were trees: shown when `runsOn`, done when ticked.
 *  - **A routine with children is a heading.** It is shown when at least one of
 *    its children is, and it counts as done when all of them are. Its own tick
 *    is never consulted, because there is nothing to consult: the UI cannot tick
 *    a heading, so `doneDays` on one is either empty or history that predates
 *    its children. Its own schedule is not consulted either — a parent whose
 *    children run on days it does not would otherwise be a heading whose
 *    schedule contradicts what is under it, and one whose children are all off
 *    would be a row with nothing to open. What it *reports* as its days is the
 *    union of theirs, so the field still says something true.
 *  - **A routine that cannot hang anywhere stands at the top.** A `parentId`
 *    that names nothing, or a cycle somebody hand-edited in, must not take a
 *    routine off the list — that is the one failure here that loses something
 *    rather than misdrawing it.
 *
 * `folded` names the routines whose children are hidden — folded ids rather than
 * open ones, so that everything is open until somebody says otherwise. A folded
 * heading still counts every child it has, folded or not: the count is the
 * answer, and it must not change as branches are opened.
 */
export function routineRows(habits: Habit[], day: string | null, folded: Set<string> = new Set()): RoutineRow[] {
  const byId = new Map(habits.map((h) => [h.id, h]))
  const parentOf = (id: string): string | null => {
    const up = byId.get(id)?.parentId ?? null
    return up != null && byId.has(up) ? up : null
  }
  // Where a routine hangs — with the two broken links repaired here, once,
  // rather than as a sweep after the walk. A parent that is not on the list, and
  // a chain that leads back to the routine itself, both leave it nowhere to
  // hang, so it stands at the top. The sweep this replaces could not tell a
  // routine it had failed to reach from one the day's rules had left out, and
  // put every one of those back on the list.
  const hangsUnder = (h: Habit): string | null => {
    const direct = parentOf(h.id)
    if (direct == null) return null
    // Up from the parent: meeting anything already on the chain — `h` itself
    // included — means this link would close a loop, so it is the one cut.
    const walked = new Set([h.id])
    for (let at: string | null = direct; at != null; at = parentOf(at)) {
      if (walked.has(at)) return null
      walked.add(at)
    }
    return direct
  }

  const kids = new Map<string | null, Habit[]>()
  for (const h of habits) {
    const key = hangsUnder(h)
    const list = kids.get(key)
    if (list) list.push(h)
    else kids.set(key, [h])
  }
  for (const list of kids.values()) list.sort(byStart)

  const kidsOf = (h: Habit) => kids.get(h.id) ?? []
  // Memoised, and seeded empty before the walk below: a cycle would otherwise
  // recurse forever, and what it costs is that the pair shows as two leaves
  // rather than as a tree — see the third rule above.
  const onDay = new Map<string, Habit[]>()
  const shown = (h: Habit): Habit[] => {
    const memo = onDay.get(h.id)
    if (memo) return memo
    onDay.set(h.id, [])
    const list = day === null ? kidsOf(h) : kidsOf(h).filter(isOn)
    onDay.set(h.id, list)
    return list
  }
  const isOn = (h: Habit): boolean => (kidsOf(h).length > 0 ? shown(h).length > 0 : day === null || runsOn(h, day))
  // The days a routine covers, worked out the same way its tick is: a leaf holds
  // its own, and a heading has none to hold, so it is whatever its children
  // cover between them. No cycle guard is needed here — `kids` was built from
  // the forest the broken links above were repaired into, so this recursion
  // always reaches leaves.
  const weekdays = (h: Habit): number[] => {
    const under = kidsOf(h)
    if (under.length === 0) return [...h.weekdays].sort((a, b) => a - b)
    const days = new Set<number>()
    for (const kid of under) for (const d of weekdays(kid)) days.add(d)
    return [...days].sort((a, b) => a - b)
  }
  const done = (h: Habit): boolean => {
    const under = shown(h)
    return under.length > 0 ? under.every(done) : day !== null && tickedOn(h, day)
  }

  const out: RoutineRow[] = []
  const seen = new Set<string>()
  // `open` is the parent's, not this row's: a row is drawn only where everything
  // above it was open, while the walk descends either way so that a folded
  // branch's rows still count as reached.
  const walk = (list: Habit[], depth: number, open: boolean) => {
    for (const h of list) {
      if (seen.has(h.id)) continue
      seen.add(h.id)
      const under = shown(h)
      const openHere = open && !folded.has(h.id)
      if (open) {
        out.push({ habit: h, depth, hasKids: under.length > 0, done: done(h), weekdays: weekdays(h), open: openHere })
      }
      walk(under, depth + 1, openHere)
    }
  }
  walk((kids.get(null) ?? []).filter(isOn), 0, true)
  return out
}

/**
 * The patch that changes a habit's suspended state, or `{}` if it is already
 * what was asked for.
 *
 * A patch rather than a pair of store actions, because suspending is edited in
 * the same dialog as the name and the days, and has to be cancellable: a switch
 * that had already taken effect would make Cancel a lie. It also keeps the logic
 * next to `runsOn`, which is the only thing that reads it back — a store action
 * would put the two halves of one rule in different files.
 *
 * Resuming closes the open segment into `pauses`, which is what makes the days
 * under the pause stay off every later reading of them. A habit paused and
 * lifted on the same day closes a zero-length segment; `isPausedOnDay` is
 * half-open, so it covers nothing, which is correct — it never covered a day.
 */
export function pausePatch(habit: Habit, paused: boolean, day: string): Partial<Habit> {
  if (paused === habit.paused) return {}
  if (paused) return { paused: true, pauseDate: day }
  return {
    paused: false,
    pauseDate: null,
    pauses: [...habit.pauses, { pauseDate: habit.pauseDate ?? day, resumeDate: day }],
  }
}
