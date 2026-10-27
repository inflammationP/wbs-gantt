import { Task } from '../types'

/**
 * The fields that record a postponement, or null when the request is not one.
 *
 * Only ever later, which is what makes this different from editing the end date
 * in the task dialog: a shorter window is a plan change, not a postponement,
 * and saying so in the record would turn it into a reason for something that
 * did not happen. The reason is required for the same reason the record exists.
 */
export function postponePatch(
  task: Task,
  newEnd: string,
  reason: string,
  today: string,
): Pick<Task, 'endDate' | 'postponements'> | null {
  const text = reason.trim()
  if (!text || task.isTodo || task.type === 'long-term' || task.endDate === null) return null
  if (newEnd <= task.endDate) return null
  return {
    endDate: newEnd,
    postponements: [...task.postponements, { date: today, from: task.endDate, to: newEnd, reason: text }],
  }
}
