import { Chore, Habit, ItemLog, Note } from '../types'

/**
 * Reading the entries written about routines and chores.
 *
 * A file of its own rather than a corner of `logs.ts`, which is the task side's
 * and opens with the rules about figures and days — a routine's entry has
 * neither, and the one thing the two have in common is the shape of the text.
 * And its own file rather than a corner of `habits.ts` or `chores.ts` for the
 * same reason those two are separate: it is about both at once, so either home
 * would put it under a heading describing the other case.
 *
 * The writers are `addItemLog` and the two delete sweeps in the store; the
 * readers are the day's record — the Logs page's day card and `DayLogsModal`.
 * Nothing else in the app knows this collection exists, which is the whole point
 * of it (see `ItemLog` in types.ts).
 */

/** The order two entries are listed in for one day: routines, then chores. */
const KIND_ORDER: Record<ItemLog['kind'], number> = { habit: 0, chore: 1 }

/**
 * `day`'s entries, in a stable order.
 *
 * By kind and then by owner id rather than by the order the items sit in on
 * screen: that order is the day board's answer to a different question (which
 * routines are on today, folds and all), and a day's record is read as a record.
 * Sorting here is what keeps two entries written minutes apart from swapping
 * places on the next render.
 */
export function itemLogsOn(itemLogs: ItemLog[], day: string): ItemLog[] {
  return itemLogs
    .filter((l) => l.date === day)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.ownerId.localeCompare(b.ownerId))
}

/**
 * What an entry is about, as the one line the day's record draws it under.
 *
 * `null` when nothing answers to the id, and the caller draws nothing: the app
 * sweeps an item's entries when the item is deleted (`deleteHabit` and
 * `deleteChore`), so an entry naming a stranger comes from a hand-edited file —
 * and a line under the title "undefined" would be worse than no line at all.
 */
export function itemLogSubject(log: ItemLog, habits: Habit[], chores: Chore[]): string | null {
  return (
    (log.kind === 'habit'
      ? habits.find((h) => h.id === log.ownerId)
      : chores.find((c) => c.id === log.ownerId)
    )?.title ?? null
  )
}

/**
 * The Logs page's days, with the day's entries attached.
 *
 * The same union `withNotes` makes one layer up, for the same reason and with
 * the same consequence: a day whose only entry is about a routine has to get a
 * card, and the only way it can is if the day exists in a list built from every
 * collection that files itself under a date.
 *
 * Wrapped around `withNotes` rather than folded into it: that function is the
 * notebook's, and it is generic over the log half only. Taking the day rows as
 * they come and adding a field keeps each function about one collection, which
 * is also what keeps a third one from being a fourth branch inside either.
 */
export function withItemLogs<T>(
  days: { date: string; logs: T[]; note: Note | null }[],
  itemLogs: ItemLog[],
): { date: string; logs: T[]; note: Note | null; itemLogs: ItemLog[] }[] {
  const out = days.map((d) => ({ ...d, itemLogs: itemLogsOn(itemLogs, d.date) }))
  const known = new Set(out.map((d) => d.date))
  for (const day of [...new Set(itemLogs.map((l) => l.date))]) {
    if (!known.has(day)) out.push({ date: day, logs: [], note: null, itemLogs: itemLogsOn(itemLogs, day) })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}
