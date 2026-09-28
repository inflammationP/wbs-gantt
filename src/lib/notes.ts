import { Note } from '../types'

/**
 * Which days the Logs page draws, and what each one holds.
 *
 * The page is a wall of day cards, and both logs and notes are filed under a
 * day — so "what is on this card" is one question with one answer, and it has
 * to be given once. Written into the page instead, the day's card count and the
 * day's contents would be two separate walks over the same two collections, and
 * the first thing to drift would be a day that has a note and no log: it gets a
 * card from one walk and nothing from the other.
 *
 * The union is also what tells the card to draw a second card edge behind it
 * ("this day has both"), so that signal comes from the same place as the
 * contents rather than from a second `notes.some(...)` that could disagree.
 */

/**
 * The notebook for one day, or `null` if nothing has been written.
 *
 * `null` rather than an empty note, because "not written" and "written and then
 * cleared" are the same thing here — a blank body is deleted on the way in, so
 * there is no such state to represent. Every caller wants the same answer:
 * whether to draw the box's contents as text or as somewhere to start writing.
 */
export function noteOn(notes: Note[], day: string): Note | null {
  return notes.find((n) => n.date === day) ?? null
}

/**
 * Every day that has a log or a note, newest day first, with both attached.
 *
 * A day that has only one of the two comes back with `[]` / `null` for the
 * other rather than a missing key, so the caller branches on the value and
 * never on `undefined`. Neither input is modified.
 */
export function withNotes<T>(
  logDays: { date: string; logs: T[] }[],
  notes: Note[],
): { date: string; logs: T[]; note: Note | null }[] {
  const days = new Map<string, { date: string; logs: T[]; note: Note | null }>()
  const at = (date: string) => {
    let day = days.get(date)
    if (!day) {
      day = { date, logs: [], note: null }
      days.set(date, day)
    }
    return day
  }

  for (const d of logDays) at(d.date).logs = d.logs
  for (const n of notes) at(n.date).note = n

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}
