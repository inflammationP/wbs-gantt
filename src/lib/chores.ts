import { Chore, ChoreSlot } from '../types'
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

/** The day's slots, in the order a day runs. */
export const CHORE_SLOTS: ChoreSlot[] = ['dawn', 'am', 'pm', 'eve']

/** Whether a value is one of the four. Cheap, and the file is hand-editable. */
export function isChoreSlot(v: unknown): v is ChoreSlot {
  return typeof v === 'string' && (CHORE_SLOTS as string[]).includes(v)
}

/**
 * A chore's slot, with anything unrecognised read as "none".
 *
 * A word nothing knows keeps the chore on the day in the untimed group rather
 * than dropping it off: a chore that vanishes over a typo in a hand-edited file
 * is worse than one filed in the wrong place where it can be seen and fixed.
 */
export function choreSlot(c: Chore): ChoreSlot | null {
  return isChoreSlot(c.slot) ? c.slot : null
}

/**
 * A typed time, read into the `HH:MM` that gets stored — or null when it cannot
 * be read at all.
 *
 * Both clocks are taken, because both are typed: `21:30` on a keyboard set to
 * 24-hour, `9:30pm` by someone who thinks in the other one. `am`/`pm` is the
 * whole difference between them, so it is what decides how the hour is read —
 * and with no suffix the hour is read as it stands, 0–23, since `9:30` meaning
 * nine in the morning is the reading that needs nothing added to it.
 *
 * `点`/`时` and `半` are taken for the same reason as `pm`: this is a text field
 * someone types into, and `9点半` is what a hand reaches for. The field's own
 * placeholder says which shapes are wanted — this is a guess about what someone
 * meant, and a guess belongs behind an example.
 */
/**
 * Full-width forms folded back to half-width: ９ to 9, Ａ to a, ： to :.
 *
 * A Chinese IME in 全角 mode produces these as readily as the half-width ones,
 * and nobody typing a time is watching which mode they are in — the full-width
 * colon was already accepted, and leaving the digits behind it unread was the
 * inconsistent half of that. Unicode's own arithmetic rather than a lookup
 * table: every full-width ASCII form sits exactly 0xFEE0 above its half-width
 * twin, so one subtraction covers digits, letters and punctuation at once.
 *
 * The ideographic space (U+3000) needs none of this — `\s` already matches it,
 * and the fold below strips every space anyway.
 */
function toHalfWidth(s: string): string {
  return s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

export function parseChoreTime(raw: string): string | null {
  // Lower-cased before the suffix is read, so `PM`, `Pm` and `ｐｍ` are one
  // thing; spaces are dropped wherever they are, including around the colon and
  // before `am`, because a space in a time is never a thing anyone means.
  const s = toHalfWidth(raw).toLowerCase().replace(/[\s。.]/g, '')
  if (!s) return null
  // No full-width colon in the class below: `toHalfWidth` has already folded it
  // into the half-width one, and a branch that can never be taken reads as a
  // boundary someone still has to keep in sync.
  const m = /^(\d{1,2})(?:[:点时](\d{1,2}|半)?)?(am|pm)?$/.exec(s)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] === '半' ? 30 : m[2] ? Number(m[2]) : 0
  if (m[3]) {
    // A 1–12 clock: 12am is midnight, 12pm is noon, the other eleven shift.
    if (h < 1 || h > 12) return null
    if (m[3] === 'pm' && h !== 12) h += 12
    if (m[3] === 'am' && h === 12) h = 0
  }
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/**
 * A time as minutes past midnight, for ordering and for the slot boundaries to
 * be read off — or null when there is no time to read.
 *
 * One function rather than two parsers: what `slotOfTime` needs is the hour,
 * what the sort needs is the whole thing, and asking the same lenient question
 * twice is how two answers to "what time is this" get written down.
 */
export function timeMinutes(time: string | null | undefined): number | null {
  const norm = parseChoreTime(time ?? '')
  if (!norm) return null
  return Number(norm.slice(0, 2)) * 60 + Number(norm.slice(3, 5))
}

/**
 * The slot a time of day belongs to.
 *
 * The boundaries are the whole content of this function and are written down
 * here once: 0–7 凌晨, 7–12 上午, 12–18 下午, 18–24 晚上. Each hour belongs to
 * the slot it *starts*, so 07:00 is 上午 and 00:00 is 凌晨 — the only reading
 * that gives every minute of the day exactly one slot.
 */
export function slotOfTime(time: string | null | undefined): ChoreSlot | null {
  const mins = timeMinutes(time)
  if (mins == null) return null
  const h = Math.floor(mins / 60)
  if (h < 7) return 'dawn'
  if (h < 12) return 'am'
  if (h < 18) return 'pm'
  return 'eve'
}

export interface ChoreGroup {
  /** null is "no slot": the chores nobody said anything about. */
  slot: ChoreSlot | null
  chores: Chore[]
}

/**
 * Inside one slot: the chores with a time first, earliest first, and the ones
 * without a time after them.
 *
 * The split is the point rather than a side effect of sorting on a possibly
 * missing field — a chore with a time is one that has said *when*, and it is
 * what the reader is looking for at a glance; the ones with nothing to say
 * about it file in behind, in the order they were added. Sorting on the time
 * alone would do the same thing by accident here and stop doing it the moment
 * a time could sort as zero, which is midnight.
 */
function byTimeThenPlan(a: Chore, b: Chore): number {
  const am = timeMinutes(a.time)
  const bm = timeMinutes(b.time)
  if (am == null || bm == null) {
    return (am == null ? 1 : 0) - (bm == null ? 1 : 0) || byPlan(a, b)
  }
  return am - bm || byPlan(a, b)
}

/**
 * One list of chores, gathered into the day's slots.
 *
 * The slot is the chore's own `slot`, the one chosen when it was created — not
 * something read back off its time. A time typed later is a refinement of a
 * decision already made, and it is allowed to disagree with it (`ChoreDialog`
 * asks which wins when it does), so the decision is what the blocks are drawn
 * from and the time only settles the order inside one.
 *
 * With no slot anywhere, the whole list comes back as one unnamed group, which
 * is the section's cue to draw the flat list it has always drawn. That question
 * is `groups.length > 1 || groups[0].slot !== null` — one block of morning
 * chores is still worth its heading, while one block of unslotted ones is not
 * a division at all.
 */
export function choreGroups(chores: Chore[]): ChoreGroup[] {
  const order: (ChoreSlot | null)[] = [...CHORE_SLOTS, null]
  return order
    .map((slot) => ({ slot, chores: chores.filter((c) => choreSlot(c) === slot).sort(byTimeThenPlan) }))
    .filter((g) => g.chores.length > 0)
}
