import { Chore } from '../types'
import { diffDays, toDate } from './dates'

/**
 * Which chores a day shows.
 *
 * Gathered here rather than written into each of the two components that ask,
 * because "which day is this chore on" has three answers that have to agree:
 * what the Today page lists under today, what the day panel shows for an
 * arbitrary date, and what the heatmap counts. Written separately, the first
 * two would drift the first time one of them was edited alone, and the drift
 * would show as a chore the page and the panel disagree about.
 *
 * The pivot is that `date` records the day a chore was *put on* and is never
 * rewritten. Carrying work forward is therefore a question asked at read time —
 * "has it come due and is it still open" — rather than a nightly rewrite of the
 * data. A slipped chore keeps saying how long it has slipped, and the day it was
 * originally meant for stays readable.
 */

/** Oldest plan date first; within a day, the order they were added. */
export function byPlan(a: Chore, b: Chore): number {
  return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/**
 * How long ago a chore was put on, in the sign `formatRelativeDay` expects:
 * negative for a day already past, so four days late reads "4 days ago".
 *
 * Given a function of its own because the sign is the entire content of it, and
 * the wrong sign does not look wrong — it reads "in 4 days" on a chore that is
 * four days overdue, which is a plausible sentence about the opposite situation.
 * `diffDays(a, b)` is `b - a`, so the day that has already happened goes first.
 */
export function carriedSince(chore: Chore, today: string): number {
  return diffDays(toDate(today), toDate(chore.date))
}

/**
 * What is on today's plate: everything that has come due and is still open,
 * plus anything finished today.
 *
 * The second clause is what keeps a ticked chore from vanishing under the
 * cursor. It stays for the rest of the day as the day's own tally — the
 * strikethrough is the score — and leaves on its own tomorrow, since by then
 * `completedDate === today` no longer holds.
 *
 * It also catches work finished *early*. A chore written for tomorrow and ticked
 * today is a fact about today; scoping the whole filter to `date <= today` would
 * drop it out of tomorrow's column with nowhere to reappear, so the two clauses
 * are joined by `||` rather than `&&`.
 */
export function todaysChores(chores: Chore[], today: string): Chore[] {
  return chores.filter((c) => (c.date <= today && !c.done) || c.completedDate === today).sort(byPlan)
}

/**
 * What is lined up for `date`, as a plan rather than a history.
 *
 * Strictly `date === date`, unlike today's `<=`: nothing can be carried *into* a
 * day that has not happened yet, and a finished chore is a fact about the past
 * rather than something still lined up.
 */
export function plannedFor(chores: Chore[], date: string): Chore[] {
  return chores.filter((c) => c.date === date && !c.done).sort(byPlan)
}

/**
 * What `day` has to show for itself: the chores put on it, and the ones finished
 * on it — which need not be the same set, since work slips and gets done late.
 *
 * Completions are matched on `completedDate`, not `date`, so that a chore written
 * for Wednesday and ticked off on Thursday belongs to Thursday. That is the same
 * choice the heatmap makes, and for the same reason: crediting the earlier day
 * would light up a date on which nothing was actually finished.
 */
export function choresTouching(chores: Chore[], day: string): Chore[] {
  return chores.filter((c) => c.date === day || c.completedDate === day).sort(byPlan)
}
