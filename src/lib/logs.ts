import { TaskLog } from '../types'
import { pad } from './dates'

export interface LogItem {
  /** A divider is the line that separates two writes made on the same day. */
  kind: 'item' | 'divider'
  depth: number
  text: string
}

/**
 * The line that separates two writes made on the same day.
 *
 * A day is one entry, so writing to a task again appends to the entry that is
 * already there — which means the two writes have to be told apart inside the
 * one box. The clock time is what tells them apart.
 *
 * It goes into the content rather than being kept beside it because the content
 * is the user's text: they can edit around it, delete it, or type one in by
 * hand. That also makes it the same kind of thing as the auto-written "marked
 * as completed" entry, which is likewise written in the language of the day it
 * was written and never re-translated — this line needs no translating at all,
 * being a clock reading.
 */
export function editDivider(at: Date): string {
  return `— ${pad(at.getHours())}:${pad(at.getMinutes())} —`
}

/** Matches what `editDivider` writes, and nothing much else. */
const DIVIDER = /^—\s*(\d{1,2}:\d{2})\s*—$/

// Parse raw log text into a bullet list: newline = item, leading tabs = nesting.
// A divider comes back as itself rather than as an item, so nothing downstream
// has to guess from the text.
export function parseLogContent(content: string): LogItem[] {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(\t*)(.*)$/)
      const depth = (m?.[1] ?? '').length
      const text = (m?.[2] ?? '').trimEnd()
      const divider = text.trim().match(DIVIDER)
      return divider
        ? { kind: 'divider' as const, depth: 0, text: divider[1] }
        : { kind: 'item' as const, depth, text }
    })
    .filter((it) => it.text.trim() !== '')
}

// Group logs by date (descending).
export function groupLogsByDate(logs: TaskLog[]): { date: string; logs: TaskLog[] }[] {
  const m = new Map<string, TaskLog[]>()
  for (const l of logs) {
    if (!m.has(l.date)) m.set(l.date, [])
    m.get(l.date)!.push(l)
  }
  return [...m.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({ date, logs: list }))
}

// Logs for a given task, newest first.
export function logsForTask(logs: TaskLog[], taskId: string): TaskLog[] {
  return logs.filter((l) => l.taskId === taskId).sort((a, b) => b.date.localeCompare(a.date))
}
