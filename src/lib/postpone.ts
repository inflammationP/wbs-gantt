import { Postponement, Task } from '../types'
import { addDays, diffDays, toDate, toISO } from './dates'

/**
 * The fields that record a postponement, or null when the request is not one.
 *
 * Only ever later, which is what makes this different from editing the end date
 * in the task dialog: a shorter window is a plan change, not a postponement,
 * and saying so in the record would turn it into a reason for something that
 * did not happen. The reason is a memo and optional.
 */
export function postponePatch(
  task: Task,
  newEnd: string,
  reason: string,
  today: string,
): Pick<Task, 'endDate' | 'postponements'> | null {
  const text = reason.trim()
  if (task.isTodo || task.type === 'long-term' || task.endDate === null) return null
  if (newEnd <= task.endDate) return null
  return {
    endDate: newEnd,
    postponements: [...task.postponements, { date: today, from: task.endDate, to: newEnd, reason: text }],
  }
}

/**
 * Rewrite the latest record, or drop it when `record` is null.
 *
 * Only the latest: an older record's `to` is the next one's `from`, so rewriting
 * it would leave the chain saying the end moved to two places at once. The task
 * follows the record, not the other way round — the end moves by the same number
 * of days the record moved it, which keeps a pause that came after the
 * postponement intact. Dropping a record takes its shift back out.
 */
export function editPostponePatch(
  task: Task,
  record: Postponement | null,
): Pick<Task, 'endDate' | 'postponements'> | null {
  const last = task.postponements[task.postponements.length - 1]
  if (!last || task.isTodo || task.type === 'long-term' || task.endDate === null) return null
  if (record === null) {
    return {
      endDate: toISO(addDays(toDate(task.endDate), diffDays(toDate(last.to), toDate(last.from)))),
      postponements: task.postponements.slice(0, -1),
    }
  }
  const text = record.reason.trim()
  if (!record.date || record.to <= record.from) return null
  return {
    endDate: toISO(addDays(toDate(task.endDate), diffDays(toDate(last.to), toDate(record.to)))),
    postponements: [...task.postponements.slice(0, -1), { ...record, reason: text }],
  }
}
