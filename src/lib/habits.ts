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
 * `day`'s habits, tick state and all.
 *
 * Every habit that runs that day, not only the ticked ones. A day's record has
 * to show a habit that was not done as plainly as one that was — a list of
 * nothing but successes is the version of this that lies.
 */
export function habitsOn(habits: Habit[], day: string): Habit[] {
  return habits.filter((h) => runsOn(h, day)).sort(byStart)
}

/** Whether this habit was ticked on `day`. */
export function tickedOn(habit: Habit, day: string): boolean {
  return habit.doneDays.includes(day)
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
